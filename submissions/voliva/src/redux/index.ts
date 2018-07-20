import { prop } from 'ramda';
import { combineReducers } from "redux";
import { combineEpics } from "redux-observable";
import { never, Observable } from "rxjs";
import websocketConnect from 'rxjs-websockets';
import { filter, map } from 'rxjs/operators';
import { ActionsUnion, createAction, createEmptyNormalizedState, NormalizedModelState } from "./typeUtils";

export interface ApplicationState {
    currentPlanet: string,
    darkJedis: NormalizedModelState<DarkJedi>
}

export const planetName = prop('currentPlanet');

const currentPlanet = (planet: string = '', action: Action) => {
    if(action.type === ActionType.PLANET_CHANGED) {
        return action.payload.planet
    }
    return planet;
}

const darkJedis = (jedis: NormalizedModelState<DarkJedi> = createEmptyNormalizedState(), action: Action) => {
    return jedis;
}

export const createRootReducer = () => combineReducers({
    currentPlanet,
    darkJedis
});

interface DarkJedi {
    id: string,
    name: string,
    homeWorld: string,
    hasMaster: boolean,
    hasApprentice: boolean
}

export const planetChanged = (planet: string) =>
    createAction(ActionType.PLANET_CHANGED, {
        planet
    });
export const scrollUp = () => createAction(ActionType.SCROLL_UP);
export const scrollDown = () => createAction(ActionType.SCROLL_DOWN);

const ActionCreator = {
    planetChanged,
    scrollUp,
    scrollDown
}

type Action = ActionsUnion<typeof ActionCreator>;

export enum ActionType {
    PLANET_CHANGED = 'PLANET_CHANGED',
    SCROLL_UP = 'SCROLL_UP',
    SCROLL_DOWN = 'SCROLL_DOWN'
}

const { messages } = websocketConnect('ws://localhost:4000', never());

const planetEpic = () => messages
    .pipe(
        map(msg => JSON.parse(msg)),
        map(res => planetChanged(res.name))
    );

const scrollDownEpic = (action$: Observable<Action>) => {
    return action$.pipe(
        filter(() => false)
    )
};

export const rootEpic = combineEpics(
    planetEpic,
    scrollDownEpic
);
