import { Candle, Interval, MarketAPI } from '../types';
import * as rx from 'rxjs';
import { Either } from 'fp-ts/lib/Either';
import { CurrencyPair } from './currencyPair';
import { pipe } from 'fp-ts/lib/function';
import { container } from '@performance-artist/fp-ts-adt';
import { getClosedCurrentCandle, getXLastCandles } from '../trade/market';

export type CandleStreams = {
  historical$: rx.Observable<Either<Error, Candle[]>>;
  current$: rx.Observable<Either<Error, Candle>>;
  currentClosed$: rx.Observable<Either<Error, Candle>>;
};

export type CandleStreamsParams = {
  symbol: CurrencyPair;
  interval: Interval;
  lookbehind: number;
};

export const makeCandleStreams = pipe(
  container.combine(
    container.create<{ market: MarketAPI }>()('market'),
    getClosedCurrentCandle,
    getXLastCandles
  ),
  container.map(
    ([{ market }, getClosedCurrentCandle, getXLastCandles]) => ({
      symbol,
      interval,
      lookbehind
    }: CandleStreamsParams) => ({
      historical$: getXLastCandles({
        symbol,
        interval,
        total: lookbehind
      }),
      current$: market.getCurrentCandle({ symbol, interval }),
      currentClosed$: getClosedCurrentCandle({ symbol, interval })
    })
  )
);
