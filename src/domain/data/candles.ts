import { Candle, Interval, MarketAPI } from '../types';
import * as rx from 'rxjs';
import { Either } from 'fp-ts/lib/Either';
import { CurrencyPair } from './currencyPair';
import { pipe } from 'fp-ts/lib/function';
import { readerUtils } from '@performance-artist/fp-ts-adt';
import { reader } from 'fp-ts';
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
  readerUtils.combine(
    reader.ask<{ market: MarketAPI }>(),
    getClosedCurrentCandle,
    getXLastCandles
  ),
  reader.map(
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
