import { Action } from "redux";
import { combineEpics } from "redux-observable";

export interface ApplicationState {
}

export const rootReducer = (state:ApplicationState, action: Action) => state;

export const rootEpic = combineEpics();
