import {
  Candle,
  Spot,
  Interval,
  ObservableEither,
  StopLossOrder
} from '../../domain/types';
import { either } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import * as rx from 'rxjs';
import { switchMapEither } from '../../utils/switchMapEither';
import { frame, ScriptState } from '../shared/frame';
import { CurrencyPair } from '../../domain/data/currencyPair';
import {
  MarketStopLimitParams,
  SpotMarketStopLimit
} from '../../domain/trade/marketStopLimit';
import {
  MovingStopLossFromCandles,
  MovingStopParams
} from '../../domain/trade/movingStopLimit';

export type ScriptTrigger =
  | {
      type: 'STOP_LOSS_TRIGGERED';
      diff: number;
      side: 'loss' | 'profit';
    }
  | { type: 'PROFIT_TAKEN'; profit: number };

export type ScriptStopDeps = {
  getRSI: (params: ScriptRSIParams) => ObservableEither<Error, number>;
  spotMarketStopLimit: SpotMarketStopLimit;
  movingStopLossFromCandles: MovingStopLossFromCandles;
  spot: Spot;
};

export type ScriptRSIParams = {
  symbol: CurrencyPair;
  interval: Interval;
  period: number;
  lookbehind: number;
  rsiFromCandle: (candle: Candle) => number;
};

export type ScriptStopParams = {
  symbol: CurrencyPair;
  getBudget: MarketStopLimitParams['getBudget'];
  getStop: MarketStopLimitParams['getStop'];
  RSI: {
    interval: Interval;
    period: number;
    fromCandle: (candle: Candle) => number;
    lookbehind: number;
    buyThreshold: number;
    sellThreshold: number;
  };
  restop: Omit<MovingStopParams, 'order' | 'symbol'>;
  rerun: (state: ScriptState<ScriptTrigger>) => boolean;
};

export const makeScript = (deps: ScriptStopDeps) => (
  params: ScriptStopParams
) => {
  const { spot, getRSI, movingStopLossFromCandles, spotMarketStopLimit } = deps;
  const { symbol, getBudget, RSI, rerun, restop, getStop } = params;
  const rsi$ = getRSI({ symbol, ...RSI, rsiFromCandle: RSI.fromCandle });

  return frame<number, StopLossOrder, void, ScriptTrigger>({
    rerun,
    open$: pipe(rsi$, rxo.filter(either.exists(rsi => rsi < RSI.buyThreshold))),
    execute: () => spotMarketStopLimit({ symbol, getBudget, getStop }),
    manage: (stopLossOrder, onClose) => {
      const stopLoss = movingStopLossFromCandles({
        symbol,
        order: stopLossOrder,
        ...restop
      });

      const profitTaken = new rx.Subject<{ profit: number }>();

      const positionClosed$ = pipe(
        profitTaken.asObservable(),
        rxo.tap(({ profit }) => onClose({ type: 'PROFIT_TAKEN', profit }))
      );

      const stopFilled$ = pipe(
        stopLoss.current.asObservable(),
        rxo.switchMap(stopLoss => stopLoss.filled$),
        observableEither.map(result =>
          onClose({
            type: 'STOP_LOSS_TRIGGERED',
            side: stopLossOrder.price > result.price ? 'loss' : 'profit',
            diff: Math.abs(
              stopLossOrder.quantity * stopLossOrder.price -
                result.price * result.quantity
            )
          })
        )
      );

      const position$ = pipe(
        rsi$,
        rxo.takeUntil(rx.merge(stopFilled$, positionClosed$)),
        rxo.filter(either.exists(rsi => rsi > RSI.sellThreshold)),
        rxo.take(1),
        switchMapEither(() =>
          pipe(
            stopLoss.close(),
            switchMapEither(() =>
              spot.marketSell({ symbol, quantity: stopLossOrder.quantity })
            ),
            observableEither.map(result =>
              profitTaken.next({
                profit: Math.abs(
                  stopLossOrder.quantity * stopLossOrder.price -
                    result.averagePrice * result.quantity
                )
              })
            )
          )
        )
      );

      return rx.merge(stopLoss.stopLoss$, position$);
    }
  });
};
