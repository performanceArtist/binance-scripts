import * as rxo from 'rxjs/operators';
import * as rx from 'rxjs';
import { observableEither } from 'fp-ts-rxjs';
import { ObservableEither } from 'trading-indicators-streams';
import { pipe } from 'fp-ts/lib/function';

export type KeyStreamParams = {
  getKey: () => ObservableEither<Error, string>;
  putKey: (listenKey: string) => ObservableEither<Error, unknown>;
};

export const makeListenKeyStream = (params: KeyStreamParams) => {
  const { getKey, putKey } = params;

  const ping = (listenKey: string) =>
    pipe(
      rx.interval(1000 * 60 * 58),
      rxo.switchMap(() => putKey(listenKey))
    );

  return pipe(
    getKey(),
    observableEither.chain(listenKey =>
      pipe(
        ping(listenKey),
        observableEither.map(() => listenKey)
      )
    ),
    rxo.distinctUntilChanged(
      (a, b) => a._tag === 'Right' && b._tag === 'Right' && a.right === b.right
    ),
    rxo.shareReplay(1)
  );
};
