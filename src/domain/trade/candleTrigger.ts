import {
  MarketStopLimitParams,
  spotMarketStopLimit
} from '../../domain/trade/marketStopLimit';
import { CurrencyPair } from '../../domain/data/currencyPair';
import { Candle, Interval, MarketAPI } from '../../domain/types';
import { observableEither } from 'fp-ts-rxjs';
import { identity, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { array, either, reader } from 'fp-ts';
import { readerUtils } from '@performance-artist/fp-ts-adt';
import { getBalanceOf } from '../../binance';

export const makeCandleBuyTrigger = pipe(
  readerUtils.combine(
    reader.ask<{ market: MarketAPI }>(),
    readerUtils.defer(spotMarketStopLimit, 'getBalance'),
    getBalanceOf
  ),
  reader.map(
    ([{ market }, spotMarketStopLimit, getBalance]) => ({
      baseSymbol,
      baseInterval,
      trigger,
      orders
    }: {
      baseSymbol: CurrencyPair;
      baseInterval: Interval;
      trigger: (candle: Candle) => boolean;
      orders: MarketStopLimitParams[];
    }) =>
      pipe(
        market.getCurrentCandle({
          symbol: baseSymbol,
          interval: baseInterval
        }),
        observableEither.map(trigger),
        rxo.filter(either.exists(identity)),
        observableEither.chain(() =>
          array.sequence(observableEither.observableEither)(
            pipe(orders, array.map(spotMarketStopLimit({ getBalance })))
          )
        )
      )
  )
);
