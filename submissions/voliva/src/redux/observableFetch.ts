import { empty, from, Observable, Observer } from "rxjs";
import { catchError } from "rxjs/operators";

export function observableFetch(input?: Request | string, init: RequestInit = {})
    :Observable<Response> {
    return Observable.create((obs: Observer<Response>) => {
        const controller = new AbortController();
        init.signal = controller.signal;

        const subscription = from(fetch(input, init))
            .pipe(
                catchError(ex => {
                    console.warn(ex);
                    return empty();
                })
            )
            .subscribe(obs);

        return () => {
            if(!subscription.closed) {
                subscription.unsubscribe();
                controller.abort();
            }
        }
    });
}
