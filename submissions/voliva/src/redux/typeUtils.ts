/// Actions based on https://medium.com/@martin_hotell/improved-redux-type-safety-with-typescript-2-8-2c11a8062575
interface Action<T extends string> {
    type: T;
}
interface ActionWithPayload<T extends string, P> extends Action<T> {
    payload: P;
}

export function createAction<TAction extends string>(
    type: TAction
): Action<TAction>;
export function createAction<
    TAction extends string,
    TPayload extends object | number
>(type: TAction, payload: TPayload): ActionWithPayload<TAction, TPayload>;
export function createAction<
    TAction extends string,
    TPayload extends object | number
>(type: TAction, payload?: TPayload) {
    return payload === undefined ? { type } : { type, payload };
}

type ActionCreator = (...args: any[]) => Action<any>;
interface ActionCreatorMap { [key: string]: ActionCreator };
export type ActionsUnion<A extends ActionCreatorMap> = ReturnType<A[keyof A]>;

/// Reducers
interface ModelMap<TModel> {
    [id: string]: TModel;
};
export interface NormalizedModelState<TModel> {
    byId: ModelMap<TModel>;
    allIds: string[];
}

export function createEmptyNormalizedState<TModel>(): NormalizedModelState<
    TModel
> {
    return {
        allIds: [],
        byId: {}
    };
}
export function createNormalizedStateFromArray<
    TModel,
    TKey extends keyof TModel
>(arr: TModel[], idKey: TKey): NormalizedModelState<TModel> {
    const ret = createEmptyNormalizedState<TModel>();

    arr.forEach(m => {
        const id = `${m[idKey]}`;
        ret.byId[id] = m;
        ret.allIds.push(id);
    });

    return ret;
}