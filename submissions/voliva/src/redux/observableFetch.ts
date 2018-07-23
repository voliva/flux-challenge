import { from, Observable, Observer } from "rxjs";

export function observableFetch(input?: Request | string, init: RequestInit = {})
    :Observable<Response> {
    return Observable.create((obs: Observer<Response>) => {
        const controller = new AbortController();
        init.signal = controller.signal;

        const subscription = from(fetch(input, init))
            .subscribe(obs);

        return () => {
            subscription.unsubscribe();
            setTimeout(() => controller.abort()); // Breaks the stream with DOMException: User aborted request for some reason... I don't know where can I catch this exception, as I want to abort it!
        }
    });
}
