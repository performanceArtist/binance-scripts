import { array, either, nonEmptyArray } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { flow, pipe } from 'fp-ts/lib/function';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { fromRSIAcc, initRSIAcc, nextRSIAcc } from 'trading-indicators';
import { CandleStreams, makeAccStreams } from '../data';
import { Candle, IndicatorStreams } from '../types';

export const getCandleRSIAcc = (fromCandle: (candle: Candle) => number) => (
  period: number
) => (candles: Candle[]) =>
  pipe(candles, array.map(fromCandle), initRSIAcc(period));

export type RSIParams = {
  fromCandle: (candle: Candle) => number;
  period: number;
};

export const makeRSIAccStreams = ({ fromCandle, period }: RSIParams) =>
  makeAccStreams(
    flow(
      getCandleRSIAcc(fromCandle)(period),
      either.fromOption(() => new Error('Failed to calculate RSI'))
    ),
    (acc, cur) => either.right(nextRSIAcc(period)(acc, fromCandle(cur)))
  );

export const makeRSIStreams = (params: RSIParams) =>
  flow(
    makeRSIAccStreams(params),
    ({
      closed$,
      current$
    }): IndicatorStreams<NonEmptyArray<number>, number> => {
      const closedRSI$ = pipe(closed$, observableEither.map(fromRSIAcc));

      return {
        closed$: closedRSI$,
        currentClosed$: pipe(
          closedRSI$,
          observableEither.map(nonEmptyArray.last)
        ),
        current$: pipe(
          current$,
          observableEither.map(([_, rsi]) =>
            pipe(rsi, nonEmptyArray.last, rsi => rsi.rsi)
          )
        )
      };
    }
  );
