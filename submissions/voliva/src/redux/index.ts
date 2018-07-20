import { prop } from 'ramda';
import { combineReducers } from "redux";
import { combineEpics } from "redux-observable";
import { never } from "rxjs";
import websocketConnect from 'rxjs-websockets';
import { map } from 'rxjs/operators';
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

const ActionCreator = {
    planetChanged
}

type Action = ActionsUnion<typeof ActionCreator>;

export enum ActionType {
    PLANET_CHANGED = 'PLANET_CHANGED'
}

const { messages } = websocketConnect('ws://localhost:4000', never());

const planetEpic = () => messages
    .pipe(
        map(msg => JSON.parse(msg)),
        map(res => planetChanged(res.name))
    );

export const rootEpic = combineEpics(planetEpic);
