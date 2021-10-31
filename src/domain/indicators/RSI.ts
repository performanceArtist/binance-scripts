import { array, either, nonEmptyArray } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { flow, pipe } from 'fp-ts/lib/function';
import {
  getRSIAcc,
  nextRSI,
  toPricePoint,
  withNextArrayQueue
} from 'trading-indicators';
import { makeAccStreams } from '../data';
import { Candle } from '../types';

export const getCandleRSIAcc = (fromCandle: (candle: Candle) => number) => (
  period: number
) => (candles: Candle[]) =>
  pipe(candles, array.map(fromCandle), getRSIAcc(period));

export const makeRSIAccStreams = (
  fromCandle: (candle: Candle) => number,
  period: number
) =>
  makeAccStreams(
    flow(
      getCandleRSIAcc(fromCandle)(period),
      either.fromOption(() => new Error('Failed to calculate RSI'))
    ),
    (acc, cur) => {
      const nextAcc = withNextArrayQueue(toPricePoint)(acc.acc, cur.close);
      const newPrice = nonEmptyArray.last(nextAcc.result);
      const newRSI = nextRSI(period)(acc.rsi, newPrice);

      return either.right({
        acc: nextAcc,
        rsi: newRSI
      });
    }
  );

export const makeRSIStreams = (
  fromCandle: (candle: Candle) => number,
  period: number
) =>
  flow(
    makeRSIAccStreams(fromCandle, period),
    ({ currentClosed$, current$ }) => ({
      currentClosed$: pipe(
        currentClosed$,
        observableEither.map(acc =>
          pipe(
            acc.rsi,
            nonEmptyArray.map(rsi => rsi.rsi)
          )
        )
      ),
      current$: pipe(
        current$,
        observableEither.map(acc =>
          pipe(acc.rsi, nonEmptyArray.last, rsi => rsi.rsi)
        )
      )
    })
  );
