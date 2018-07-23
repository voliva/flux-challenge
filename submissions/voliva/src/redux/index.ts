import { defaultTo, prop } from 'ramda';
import createCachedSelector from 're-reselect';
import { combineReducers } from "redux";
import { combineEpics, ofType } from "redux-observable";
import { createSelector } from 'reselect';
import { merge, never, Observable } from "rxjs";
import websocketConnect from 'rxjs-websockets';
import { filter, flatMap, map, takeUntil, withLatestFrom } from 'rxjs/operators';
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

const idxToId = (idxToId: IdxToId = {}, jediWindow: JediWindow, action: Action) => {
    if(action.type === ActionType.DARK_JEDI_LOADED) {
        const jediLoaded = action.payload;
        if(jediLoaded.idx < jediWindow.start || jediLoaded.idx > jediWindow.end) {
            return idxToId;
        }

        return {
            ...idxToId,
            [jediLoaded.idx]: jediLoaded.id
        }
    }
    if([ActionType.SCROLL_DOWN, ActionType.SCROLL_UP].indexOf(action.type) >= 0) {
        const idxToRemove = Object.keys(idxToId)
            .map(idx => parseInt(idx, 10))
            .filter(idx => idx < jediWindow.start || idx > jediWindow.end);
        
        if(idxToRemove.length === 0) {
            return idxToId;
        }

        const ret = {...idxToId};
        idxToRemove.forEach(idx => delete ret[idx]);
        return ret;
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

const createRootCombinedReducer = () => combineReducers({
    currentPlanet,
    jediWindow,
    darkJedis
});

export const createRootReducer = () => {
    const combinedReducer = createRootCombinedReducer();

    return (state: ApplicationState, action: Action): ApplicationState => {
        const { idxToId: idxToIdState, ...restState } = state || {} as any;

        const combinedReducerState = combinedReducer(restState, action);
        return {
            ...combinedReducerState,
            idxToId: idxToId(
                idxToIdState,
                combinedReducerState.jediWindow,
                action
            )
        }
    }
}

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
    // requestNext: (jedi: DarkJedi) => ReturnType<typeof requestJedi>,
    getNextJediToRequest: (jedi: DarkJedi) => { id: string, idx: number },
    jediContinuesLoad: (state: ApplicationState, jedi: DarkJedi) => boolean,
    nextScrollAction: ActionType,
    opositeScrollAction: ActionType,
    onlyNextIsUnloaded: (state: ApplicationState) => boolean

}

const scrollEpic = 
({
    firstJediIdx,
    hasNext,
    getNextJediToRequest,
    jediContinuesLoad,
    nextScrollAction,
    opositeScrollAction,
    onlyNextIsUnloaded,
}: ScrollEpicParams) =>
(action$: Observable<Action>, state$: Observable<ApplicationState>) => {
    const requestNextUntilAbort = (jedi: DarkJedi) => {
        /*
            Abort when there's an oposite direction AND
            it's not relevant anymore.
        */

        const jediToRequest = getNextJediToRequest(jedi);
        return requestJedi(jediToRequest.id, jediToRequest.idx).pipe(
            takeUntil(
                action$.pipe(
                    ofType(opositeScrollAction),
                    withLatestFrom(state$),
                    // TODO: I'll have to make a specific case for scroll up/down as well - Now if I scroll all the way up until no jedi is visible, then back down, it will abort the request, preventing the load of any other jedi.
                    filter(([,state]) => jediToRequest.idx < state.jediWindow.start || jediToRequest.idx > state.jediWindow.end)
                )
            )
        );
    }

    const load = merge(
        action$.pipe(
            ofType<Action, ReturnType<typeof darkJediLoaded>>(ActionType.DARK_JEDI_LOADED),
            map(action => action.payload),
            filter(hasNext), // loaded jedi has next jedi to be loaded
            // tap(jedi => console.log(nextScrollAction, 'jedi has next', jedi)),
            withLatestFrom(state$),
            filter(([jedi, state]) => jediContinuesLoad(state, jedi)),
            // tap(([jedi, state]) => console.log(nextScrollAction, 'trigger next', jedi, state)),
            flatMap(([jedi,]) => requestNextUntilAbort(jedi))
        ),
        action$.pipe(
            ofType(nextScrollAction),
            withLatestFrom(
                state$
            ),
            map(([,state]) => state),
            filter(onlyNextIsUnloaded), // This means that we were not loading anything.
            map(state => {
                const idx = firstJediIdx(state) as number; // We are sure we have at least 1 loaded because onlyNextIsUnloaded
                return state.darkJedis.byId[state.idxToId[idx]];
            }),
            filter(hasNext),
            flatMap(requestNextUntilAbort)
        )
    );

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
    jediContinuesLoad: (state, jedi) =>
        jedi.idx <= defaultTo(Number.MAX_SAFE_INTEGER, firstJediIdx(state)) &&
        jedi.idx > state.jediWindow.start,
    nextScrollAction: ActionType.SCROLL_UP,
    opositeScrollAction: ActionType.SCROLL_DOWN,
    getNextJediToRequest: jedi => ({id: jedi.master, idx: jedi.idx-1}),
    onlyNextIsUnloaded: state =>
        state.idxToId[state.jediWindow.start+1] != undefined && 
        state.idxToId[state.jediWindow.start] == undefined
});

const scrollDownEpic = scrollEpic({
    firstJediIdx: lastJediIdx,
    hasNext: jedi => !!jedi.apprentice,
    jediContinuesLoad: (state, jedi) =>
        jedi.idx >= defaultTo(-Number.MAX_SAFE_INTEGER, lastJediIdx(state)) &&
        jedi.idx < state.jediWindow.end,
    nextScrollAction: ActionType.SCROLL_DOWN,
    opositeScrollAction: ActionType.SCROLL_UP,
    getNextJediToRequest: jedi => ({id: jedi.apprentice, idx: jedi.idx+1}),
    onlyNextIsUnloaded: state =>
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