import { prop } from 'ramda';
import { combineReducers } from "redux";
import { combineEpics, ofType } from "redux-observable";
import { merge, never, Observable } from "rxjs";
import websocketConnect from 'rxjs-websockets';
import { filter, flatMap, map, withLatestFrom } from 'rxjs/operators';
import { observableFetch } from './observableFetch';
import { ActionsUnion, createAction, createEmptyNormalizedState, NormalizedModelState, ModelMap } from "./typeUtils";
import { createSelector } from 'reselect';
import createCachedSelector from 're-reselect';

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

const scrollDownEpic = (action$: Observable<Action>, state$: Observable<ApplicationState>) => {
    const request = (id: string, idx: number) => observableFetch(`http://localhost:3000/dark-jedis/${id}`)
        .pipe(
            map(res => ({
                res,
                idx
            }))
        );

    const initialRequest = request('3616', 0);
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
        initialRequest,
        action$.pipe(
            ofType<Action, ReturnType<typeof darkJediLoaded>>(ActionType.DARK_JEDI_LOADED),
            map(action => action.payload),
            filter(jedi => !!jedi.apprentice),
            withLatestFrom(state$),
            filter(([jedi, state]) => state.jediWindow.end > jedi.idx),
            flatMap(([jedi,]) => request(jedi.apprentice, jedi.idx+1))
        ),
        // action$.pipe(
        //     ofType(ActionType.SCROLL_DOWN),
        //     combineLatest(
        //         state$.pipe(map(isLoading))
        //     ),
        //     filter(([,isLoading]) => !isLoading),
        //     flatMap(() => loadNext)
        // )
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

    const mapResult = ({res,idx}: {res: Response, idx: number}) => res.json()
        .then(res => ({
            idx,
            id: `${res.id}`,
            name: res.name,
            homeWorld: res.homeworld.name,
            master: `${res.master.id}`,
            apprentice: res.apprentice.id && `${res.apprentice.id}`
        }));

    return load.pipe(
        flatMap(mapResult),
        map(darkJediLoaded)
    );
};

export const rootEpic = combineEpics(
    planetEpic,
    scrollDownEpic
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