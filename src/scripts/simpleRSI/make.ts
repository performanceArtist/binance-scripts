import { Spot, StopLossOrder } from '../../domain/types';
import { either } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import * as rx from 'rxjs';
import { switchMapEither } from '../../utils/switchMapEither';
import {
  MarketStopLimitParams,
  SpotMarketStopLimit
} from '../../domain/trade/marketStopLimit';
import { CurrencyPair } from '../../domain/data/currencyPair';
import { makeRSIStreams, RSIParams } from '../../domain/indicators';
import { CandleStreams } from '../../domain/data';
import { container } from '@performance-artist/fp-ts-adt';
import { script, ScriptState } from '../shared/script';

export type ScriptDeps = {
  spot: Spot;
  spotMarketStopLimit: SpotMarketStopLimit;
};

export type ScriptParams = {
  symbol: CurrencyPair;
  candleStreams: CandleStreams;
  getBudget: MarketStopLimitParams['getBudget'];
  getStop: MarketStopLimitParams['getStop'];
  rerun: (state: ScriptState<ScriptTrigger>) => boolean;
  RSI: {
    params: RSIParams;
    buyThreshold: number;
    sellThreshold: number;
  };
};

export type ScriptTrigger =
  | {
      type: 'STOP_LOSS_TRIGGERED';
      loss: number;
    }
  | { type: 'PROFIT_TAKEN'; profit: number };

export const makeScript = pipe(
  container.create<ScriptDeps>()('spot', 'spotMarketStopLimit'),
  container.map(deps => (params: ScriptParams) => {
    const { spot, spotMarketStopLimit } = deps;
    const { symbol, candleStreams, getBudget, getStop, RSI, rerun } = params;
    const rsi = makeRSIStreams(RSI.params)(candleStreams);

    return script<number, StopLossOrder, void, ScriptTrigger>({
      rerun,
      open$: pipe(
        rsi.currentClosed$,
        rxo.filter(either.exists(rsi => rsi < RSI.buyThreshold))
      ),
      execute: () => spotMarketStopLimit({ symbol, getBudget, getStop }),
      manage: (stopLossOrder, onClose) => {
        const profitTaken = new rx.Subject<{ profit: number }>();

        const positionClosed$ = pipe(
          profitTaken.asObservable(),
          rxo.tap(({ profit }) => onClose({ type: 'PROFIT_TAKEN', profit }))
        );

        const stopFilled$ = pipe(
          stopLossOrder.filled$,
          observableEither.map(result =>
            onClose({
              type: 'STOP_LOSS_TRIGGERED',
              loss: Math.abs(
                stopLossOrder.quantity * stopLossOrder.price -
                  result.price * result.quantity
              )
            })
          )
        );

        return pipe(
          rsi.currentClosed$,
          rxo.takeUntil(rx.merge(stopFilled$, positionClosed$)),
          rxo.filter(either.exists(rsi => rsi > RSI.sellThreshold)),
          rxo.take(1),
          switchMapEither(() =>
            pipe(
              stopLossOrder.cancel(),
              switchMapEither(() =>
                spot.marketSell({ symbol, quantity: stopLossOrder.quantity })
              ),
              observableEither.map(result =>
                profitTaken.next({
                  profit: Math.abs(
                    result.averagePrice * result.quantity -
                      stopLossOrder.quantity * stopLossOrder.price
                  )
                })
              )
            )
          )
        );
      }
    });
  })
);
