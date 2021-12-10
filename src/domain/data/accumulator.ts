import { Candle } from '../types';
import { either } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import * as rx from 'rxjs';
import { sequenceT } from 'fp-ts/lib/Apply';
import { Either } from 'fp-ts/lib/Either';
import { CandleStreams } from './candles';

export type AccStreams<A> = {
  closed$: rx.Observable<Either<Error, A>>;
  current$: rx.Observable<Either<Error, A>>;
};

export const makeAccStreams = <A>(
  init: (candles: Candle[]) => Either<Error, A>,
  next: (acc: A, cur: Candle) => Either<Error, A>
) => (data: CandleStreams): AccStreams<A> => {
  const closed$ = pipe(
    data.historical$,
    rxo.map(either.chain(init)),
    rxo.switchMap(initial =>
      pipe(
        data.currentClosed$,
        rxo.scan(
          (acc, cur) =>
            pipe(
              sequenceT(either.either)(acc, cur),
              either.chain(([acc, cur]) => next(acc, cur))
            ),
          initial
        ),
        rxo.startWith(initial)
      )
    ),
    rxo.shareReplay(1)
  );

  const current$ = pipe(
    rx.combineLatest([closed$, data.current$]),
    rxo.map(([acc, cur]) =>
      pipe(
        sequenceT(either.either)(acc, cur),
        either.chain(([acc, cur]) => next(acc, cur))
      )
    ),
    rxo.shareReplay(1)
  );

  return { closed$, current$ };
};
