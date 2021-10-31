import { either } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { intervalTimestamps } from '../utils';
import { Interval } from '../types/shared';
import { MarketAPI } from '../types/market';
import { ObservableEither, Candle } from '../types';
import { CurrencyPair } from '../data/currencyPair';

export const getXCandles = ({ market }: { market: MarketAPI }) => ({
  symbol,
  interval,
  startTime,
  total
}: {
  symbol: CurrencyPair;
  interval: Interval;
  startTime: number;
  total: number;
}) =>
  pipe(
    market.getCandles({
      symbol,
      interval,
      startTime,
      endTime: startTime + intervalTimestamps[interval] * (total - 1),
      limit: total
    }),
    rxo.map(
      either.filterOrElse(
        candles => candles.length === total,
        candles =>
          new Error(`Expected ${total} candles, received ${candles.length}`)
      )
    )
  );

export type GetXCandles = ReturnType<typeof getXCandles>;

export const getXLastCandles = ({ market }: { market: MarketAPI }) => ({
  symbol,
  interval,
  total
}: {
  symbol: CurrencyPair;
  interval: Interval;
  total: number;
}) =>
  pipe(
    market.getCandles({
      symbol,
      interval,
      startTime: Date.now() - intervalTimestamps[interval] * (total + 1),
      endTime: Date.now(),
      limit: total
    }),
    rxo.map(
      either.filterOrElse(
        candles => candles.length === total,
        candles =>
          new Error(`Expected ${total} candles, received ${candles.length}`)
      )
    )
  );

export type GetXLastCandles = ReturnType<typeof getXLastCandles>;

// no need to include isClosed property here
export type GetClosedCurrentCandle = (params: {
  symbol: CurrencyPair;
  interval: Interval;
}) => ObservableEither<Error, Candle>;

export const getClosedCurrentCandle = ({ market }: { market: MarketAPI }): GetClosedCurrentCandle =>
  flow(
    market.getCurrentCandle,
    rxo.filter(either.exists(candle => candle.isClosed))
  );

// const toEndTime = (market: MarketAPI) => (params: { symbol: CurrencyPair, interval: Interval, limit: number, endTime: number }) =>
