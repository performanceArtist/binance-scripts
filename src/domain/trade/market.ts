import { either } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { intervalTimestamps } from '../utils';
import { Interval } from '../types/shared';
import { MarketAPI } from '../types/market';
import { ObservableEither, Candle } from '../types';
import { CurrencyPair } from '../data/currencyPair';
import { container } from '@performance-artist/fp-ts-adt';

export type GetXCandles = (params: {
  symbol: CurrencyPair;
  interval: Interval;
  startTime: number;
  total: number;
}) => ObservableEither<Error, Candle[]>;

export const getXCandles = pipe(
  container.create<{ market: MarketAPI }>()('market'),
  container.map(
    ({ market }): GetXCandles => ({ symbol, interval, startTime, total }) =>
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
      )
  )
);

export type GetXLastCandles = (params: {
  symbol: CurrencyPair;
  interval: Interval;
  total: number;
}) => ObservableEither<Error, Candle[]>;

export const getXLastCandles = pipe(
  container.create<{ market: MarketAPI }>()('market'),
  container.map(
    ({ market }): GetXLastCandles => ({ symbol, interval, total }) =>
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
      )
  )
);

// no need to include isClosed property here
export type GetClosedCurrentCandle = (params: {
  symbol: CurrencyPair;
  interval: Interval;
}) => ObservableEither<Error, Candle>;

export const getClosedCurrentCandle = pipe(
  container.create<{ market: MarketAPI }>()('market'),
  container.map(
    ({ market }): GetClosedCurrentCandle =>
      flow(
        market.getCurrentCandle,
        rxo.filter(either.exists(candle => candle.isClosed))
      )
  )
);
