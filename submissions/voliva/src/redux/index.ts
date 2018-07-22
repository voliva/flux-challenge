import { defaultTo, prop } from 'ramda';
import createCachedSelector from 're-reselect';
import { combineReducers } from "redux";
import { combineEpics, ofType } from "redux-observable";
import { createSelector } from 'reselect';
import { empty, merge, never, Observable } from "rxjs";
import websocketConnect from 'rxjs-websockets';
import { filter, flatMap, map, withLatestFrom } from 'rxjs/operators';
import { observableFetch } from './observableFetch';
import { ActionsUnion, createAction, createEmptyNormalizedState, ModelMap, NormalizedModelState } from "./typeUtils";

/// State
export interface ApplicationState {
    currentPlanet: string,
    jediWindow: JediWindow,
    idxToId: IdxToId,
    darkJedis: NormalizedModelState<DarkJedi>
}

/// Selectors
export const planetName = prop('currentPlanet');
export const getJediWindow = prop('jediWindow');
export const getJediWindowArray = createSelector<ApplicationState, JediWindow, number[]>(getJediWindow, window => {
    const ret = [];
    for(let i=window.start; i<=window.end; i++) {
        ret.push(i);
    }
    return ret;
});
export const getReversedWindowArray = createSelector(getJediWindowArray, arr => [
    ...arr
].reverse());

// TODO Careful with caching... we should not cache jedis when they're out.
export const getSithByIndex = createCachedSelector(
    (state:ApplicationState) => state.darkJedis.byId,
    (state:ApplicationState, idx: number) => state.idxToId[idx],
    (byId: ModelMap<DarkJedi>, id: string) => byId[id],
)((state:ApplicationState, idx: number) => idx);

/// Reducers
const currentPlanet = (planet: string = '', action: Action) => {
    if(action.type === ActionType.PLANET_CHANGED) {
        return action.payload.planet
    }
    return planet;
}

const jediWindow = (jediWindow: JediWindow = {start:0, end: 4}, action: Action) => {
    if(action.type === ActionType.SCROLL_UP) {
        return {
            start: jediWindow.start - 1,
            end: jediWindow.end - 1
        };
    }
    if(action.type === ActionType.SCROLL_DOWN) {
        return {
            start: jediWindow.start + 1,
            end: jediWindow.end + 1
        };
    }
    return jediWindow;
}

const idxToId = (idxToId: IdxToId = {}, action: Action) => {
    if(action.type === ActionType.DARK_JEDI_LOADED) {
        // TODO Don't store if it's not relevant anymore => dependent reducers
        return {
            ...idxToId,
            [action.payload.idx]: action.payload.id
        }
    }
    return idxToId;
}

const darkJedis = (jedis: NormalizedModelState<DarkJedi> = createEmptyNormalizedState(), action: Action) => {
    if(action.type === ActionType.DARK_JEDI_LOADED) {
        const jedi = action.payload;
        return {
            byId: {
                ...jedis.byId,
                [jedi.id]: jedi
            },
            allIds: [
                ...jedis.allIds,
                jedi.id
            ]
        }
    }
    return jedis;
}

export const createRootReducer = () => combineReducers({
    currentPlanet,
    jediWindow,
    darkJedis,
    idxToId
});

/// Action creators
export enum ActionType {
    PLANET_CHANGED = 'PLANET_CHANGED',
    SCROLL_UP = 'SCROLL_UP',
    SCROLL_DOWN = 'SCROLL_DOWN',
    DARK_JEDI_LOADED = 'DARK_JEDI_LOADED'
}

export const planetChanged = (planet: string) =>
    createAction(ActionType.PLANET_CHANGED, {
        planet
    });
export const scrollUp = () => createAction(ActionType.SCROLL_UP);
export const scrollDown = () => createAction(ActionType.SCROLL_DOWN);
export const darkJediLoaded = (jedi: DarkJedi) => createAction(ActionType.DARK_JEDI_LOADED, jedi);

const ActionCreator = {
    planetChanged,
    scrollUp,
    scrollDown,
    darkJediLoaded
}

type Action = ActionsUnion<typeof ActionCreator>;

/// Epics
const { messages } = websocketConnect('ws://localhost:4000', never());

const planetEpic = () => messages
    .pipe(
        map(msg => JSON.parse(msg)),
        map(res => planetChanged(res.name))
    );


const requestJedi = (id: string, idx: number) => observableFetch(`http://localhost:3000/dark-jedis/${id}`)
    .pipe(
        map(res => ({
            res,
            idx
        }))
    );

const mapResult = ({res,idx}: {res: Response, idx: number}) => res.json()
    .then(res => ({
        idx,
        id: `${res.id}`,
        name: res.name,
        homeWorld: res.homeworld.name,
        master: res.master.id && `${res.master.id}`,
        apprentice: res.apprentice.id && `${res.apprentice.id}`
    }));

const initialRequestEpic = () => requestJedi('3616', 0).pipe(
    flatMap(mapResult),
    map(darkJediLoaded)
);


interface ScrollEpicParams {
    firstJediIdx: (state: ApplicationState) => number | undefined,
    hasNext: (jedi: DarkJedi) => boolean,
    requestNext: (jedi: DarkJedi) => ReturnType<typeof requestJedi>,
    loadedJediTriggersNext: (state: ApplicationState, jedi: DarkJedi) => boolean,
    nextScrollAction: ActionType,
    scrollTriggersLoad: (state: ApplicationState) => boolean

}

const scrollEpic = 
({
    firstJediIdx,
    hasNext,
    requestNext,
    loadedJediTriggersNext,
    nextScrollAction,
    scrollTriggersLoad,
}: ScrollEpicParams) =>
(action$: Observable<Action>, state$: Observable<ApplicationState>) => {

    // const nextRequest = (state: ApplicationState) => {
    //     const needsLoad = state.idxToId[state.jediWindow.end];
    //     if(!needsLoad) return empty();

    //     for(let i=state.jediWindow.end; i>=state.jediWindow.start; i--) {
    //         if(state.jediWindow[i]) {
    //             const darkJedi = state.darkJedis.byId[state.jediWindow[i]];
    //             return request(darkJedi.apprentice, darkJedi.idx + 1);
    //         }
    //     }
    //     return empty();
    // }
    // For nextRequest, I can take a more functional approach wtith something like this instead
    // const loadNext = state$.pipe(
    //     take(1),
    //     map(getNeixtId),
    //     filter(id => !!id),
    //     flatMap(request)
    // );

    /* 3 posible causes to load a dark jedi:
    1. Initial load: 3616, 0
    2. On load, checking that window.end > loaded.idx
    3. On scroll down, checking that only window.end is not loaded
    */

    const load = merge(
        action$.pipe(
            ofType<Action, ReturnType<typeof darkJediLoaded>>(ActionType.DARK_JEDI_LOADED),
            map(action => action.payload),
            filter(hasNext), // loaded jedi has next jedi to be loaded
            // tap(jedi => console.log(nextScrollAction, 'jedi has next', jedi)),
            withLatestFrom(state$),
            filter(([jedi, state]) => loadedJediTriggersNext(state, jedi)),
            // tap(([jedi, state]) => console.log(nextScrollAction, 'trigger next', jedi, state)),
            flatMap(([jedi,]) => requestNext(jedi))
        ),
        action$.pipe(
            ofType(nextScrollAction),
            withLatestFrom(
                state$
            ),
            map(([,state]) => state),
            filter(scrollTriggersLoad),
            flatMap(state => {
                const idx = firstJediIdx(state);
                if(idx == undefined) {
                    return empty();
                }
                const firstJedi = state.darkJedis.byId[state.idxToId[idx]];

                if(!hasNext(firstJedi)) {
                    return empty();
                }
                return requestNext(firstJedi);
            })
        )
    );

    // const abort$ = merge(
    //     down$.pipe(map(() => 1)),
    //     up$.pipe(map(() => -1))
    // ).pipe(
    //     scan((t:number, v:number) => t+v, 0),
    //     filter(v => v < 0)
    // );

    // const request$ = observableFetch(`http://localhost:3000/dark-jedis/3616`)
    //     .pipe(
    //         takeUntil(abort$)
    //     )

    // TODO check if flatMap waits for the previous to finish. Else I'll need to check the state (maybe?)
    // return down$.pipe(
    //     flatMap(() => request$),
    //     map(res => console.log(res) || null as any),
    //     filter(() => false)
    // )

    return load.pipe(
        flatMap(mapResult),
        map(darkJediLoaded)
    );
};

// TODO move this to selectors
const firstJediIdx = (state: ApplicationState) =>
    getJediWindowArray(state).find(idx => state.idxToId[idx] != undefined);
const lastJediIdx = (state: ApplicationState) => 
    getReversedWindowArray(state).find(idx => state.idxToId[idx] != undefined);

const scrollUpEpic = scrollEpic({
    firstJediIdx,
    hasNext: jedi => !!jedi.master,
    loadedJediTriggersNext: (state, jedi) =>
        jedi.idx <= defaultTo(Number.MAX_SAFE_INTEGER, firstJediIdx(state)) &&
        jedi.idx > state.jediWindow.start,
    nextScrollAction: ActionType.SCROLL_UP,
    requestNext: jedi => requestJedi(jedi.master, jedi.idx-1),
    scrollTriggersLoad: state =>
        state.idxToId[state.jediWindow.start+1] != undefined && 
        state.idxToId[state.jediWindow.start] == undefined
});

const scrollDownEpic = scrollEpic({
    firstJediIdx: lastJediIdx,
    hasNext: jedi => !!jedi.apprentice,
    loadedJediTriggersNext: (state, jedi) =>
        jedi.idx >= defaultTo(-Number.MAX_SAFE_INTEGER, lastJediIdx(state)) &&
        jedi.idx < state.jediWindow.end,
    nextScrollAction: ActionType.SCROLL_DOWN,
    requestNext: jedi => requestJedi(jedi.apprentice, jedi.idx+1),
    scrollTriggersLoad: state =>
        state.idxToId[state.jediWindow.end-1] != undefined && 
        state.idxToId[state.jediWindow.end] == undefined
});

export const rootEpic = combineEpics(
    planetEpic,
    initialRequestEpic,
    scrollDownEpic,
    scrollUpEpic
);

/// Substates
interface DarkJedi {
    idx: number,
    id: string,
    name: string,
    homeWorld: string,
    master: string,
    apprentice: string
}
export interface JediWindow {
    start: number,
    end: number
}
interface IdxToId {
    [key: number]: string
}