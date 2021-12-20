import {
  MarketStopLimitParams,
  spotMarketStopLimit
} from '../../domain/trade/marketStopLimit';
import { CurrencyPair } from '../../domain/data/currencyPair';
import { Candle, Interval, MarketAPI } from '../../domain/types';
import { observableEither } from 'fp-ts-rxjs';
import { identity, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { array, either } from 'fp-ts';
import { container } from '@performance-artist/fp-ts-adt';

export const makeCandleBuyTrigger = pipe(
  container.combine(
    container.create<{ market: MarketAPI }>()('market'),
    spotMarketStopLimit
  ),
  container.map(
    ([{ market }, spotMarketStopLimit]) => ({
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
            pipe(orders, array.map(spotMarketStopLimit))
          )
        )
      )
  )
);
