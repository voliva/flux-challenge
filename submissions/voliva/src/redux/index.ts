import { prop } from 'ramda';
import { combineReducers } from "redux";
import { combineEpics, ofType } from "redux-observable";
import { merge, never, Observable } from "rxjs";
import websocketConnect from 'rxjs-websockets';
import { combineLatest, filter, flatMap, map, take, tap } from 'rxjs/operators';
import { observableFetch } from './observableFetch';
import { ActionsUnion, createAction, createEmptyNormalizedState, NormalizedModelState } from "./typeUtils";

export interface ApplicationState {
    currentPlanet: string,
    jediWindow: string[],
    darkJedis: NormalizedModelState<DarkJedi>
}

export const planetName = prop('currentPlanet');

const currentPlanet = (planet: string = '', action: Action) => {
    if(action.type === ActionType.PLANET_CHANGED) {
        return action.payload.planet
    }
    return planet;
}

const jediWindow = (jediWindow: string[] = new Array(5), action: Action) => {
    if(action.type === ActionType.DARK_JEDI_LOADED) {
        const jediId = action.payload.id;
        const newJediWindow = [...jediWindow];
        if(jediWindow.every(j => j == undefined)) {
            newJediWindow[0] = jediId;
            return newJediWindow;
        }
        for(let i=0; i<newJediWindow.length; i++) {
            if(newJediWindow[i] == undefined) {
                newJediWindow[i] = jediId;
                return newJediWindow;
            }
        }
    }
    return jediWindow;
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
    darkJedis
});

interface DarkJedi {
    id: string,
    name: string,
    homeWorld: string,
    master: string,
    apprentice: string
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

export enum ActionType {
    PLANET_CHANGED = 'PLANET_CHANGED',
    SCROLL_UP = 'SCROLL_UP',
    SCROLL_DOWN = 'SCROLL_DOWN',
    DARK_JEDI_LOADED = 'DARK_JEDI_LOADED'
}

const { messages } = websocketConnect('ws://localhost:4000', never());

const planetEpic = () => messages
    .pipe(
        map(msg => JSON.parse(msg)),
        map(res => planetChanged(res.name))
    );

const scrollDownEpic = (action$: Observable<Action>, state$: Observable<ApplicationState>) => {
    const request = (id: string) => observableFetch(`http://localhost:3000/dark-jedis/${id}`);

    const initialRequest = request('3616');
    const getNextId = (state: ApplicationState) => {
        for(let i=state.jediWindow.length-1; i>=0; i--) {
            if(state.jediWindow[i]) {
                const darkJedi = state.darkJedis.byId[state.jediWindow[i]];
                return darkJedi.apprentice;
            }
        }
        return null;
    }
    const loadNext = state$.pipe(
        take(1),
        map(getNextId),
        filter(id => !!id),
        tap(id => console.log(id, typeof id, !!id)),
        flatMap(request)
    );
    // const ofTypeJediLoaded = (stream: Observable<Action>) => ofType<Action, ReturnType<typeof darkJediLoaded>>(ActionType.DARK_JEDI_LOADED)(stream);

    /* 3 posible causes to load a dark jedi:
    1. initial load: 3616
    2. When scroll and not loading: This is, when scroll down && jediWindow[n-2] !== undefined (n-2 because epic runs after reducers, and it has already shifted)
    3. When loaded and we still need more: This is, when loaded && jediWindow[n-1] === undefined
    */
    const isLoading = (state: ApplicationState) => state.jediWindow[state.jediWindow.length - 2] == undefined;
    const needsToLoadMore = (state: ApplicationState) => {
        // debugger;
        return state.jediWindow[state.jediWindow.length - 1] == undefined;
    }

    const load = merge(
        initialRequest,
        action$.pipe(
            ofType(ActionType.SCROLL_DOWN),
            combineLatest(
                state$.pipe(map(isLoading))
            ),
            filter(([,isLoading]) => !isLoading),
            flatMap(() => loadNext)
        ),
        action$.pipe(
            ofType(ActionType.DARK_JEDI_LOADED),
            tap(a => console.log(a)),
            combineLatest(
                state$.pipe(take(1), map(needsToLoadMore))
            ),
            filter(([,needsToLoadMore]) => needsToLoadMore),
            flatMap(() => loadNext)
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
        flatMap(res => res.json()),
        map(res => ({
            id: `${res.id}`,
            name: res.name,
            homeWorld: res.homeworld.name,
            master: `${res.master.id}`,
            apprentice: res.apprentice.id && `${res.apprentice.id}`
        } as DarkJedi)),
        map(darkJediLoaded)
    );
};

export const rootEpic = combineEpics(
    planetEpic,
    scrollDownEpic
);
