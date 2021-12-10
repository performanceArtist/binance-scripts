import { array, either, nonEmptyArray, reader } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { flow, pipe } from 'fp-ts/lib/function';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import {
  getRSIAcc,
  nextRSI,
  toPricePoint,
  withNextArrayQueue
} from 'trading-indicators';
import {
  CandleStreamsParams,
  makeAccStreams,
  makeCandleStreams
} from '../data';
import { Candle, IndicatorStreams } from '../types';

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

export type RSIIndicatorStreams = IndicatorStreams<
  NonEmptyArray<number>,
  number
>;

export const makeRSIStreams = ({
  fromCandle,
  period
}: {
  fromCandle: (candle: Candle) => number;
  period: number;
}) =>
  flow(
    makeRSIAccStreams(fromCandle, period),
    ({
      closed$,
      current$
    }): IndicatorStreams<NonEmptyArray<number>, number> => {
      const closedRSI$ = pipe(
        closed$,
        observableEither.map(acc =>
          pipe(
            acc.rsi,
            nonEmptyArray.map(rsi => rsi.rsi)
          )
        )
      );

      return {
        closed$: closedRSI$,
        currentClosed$: pipe(
          closedRSI$,
          observableEither.map(nonEmptyArray.last)
        ),
        current$: pipe(
          current$,
          observableEither.map(acc =>
            pipe(acc.rsi, nonEmptyArray.last, rsi => rsi.rsi)
          )
        )
      };
    }
  );

export type RSIParams = {
  fromCandle: (candle: Candle) => number;
  period: number;
};

export type CurrentRSIStreamsParams = RSIParams & CandleStreamsParams;

export const getCurrentRSIStreams = pipe(
  makeCandleStreams,
  reader.map(makeCandleStreams => (params: CurrentRSIStreamsParams) =>
    pipe(makeCandleStreams(params), makeRSIStreams(params))
  )
);

export type GetCurrentRSIStreams = ReturnType<typeof getCurrentRSIStreams>;
