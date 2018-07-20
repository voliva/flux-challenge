import { from, Observable, Observer } from "rxjs";

export function observableFetch(input?: Request | string, init: RequestInit = {}) {
    return Observable.create((obs: Observer<Response>) => {
        const controller = new AbortController();
        init.signal = controller.signal;

        from(fetch(input, init)).subscribe(obs);

        return () => {
            controller.abort();
        }
    });
}
