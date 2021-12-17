import { Spot, StopLossOrder } from '../../domain/types';
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
import { makeRSIStreams, RSIParams } from '../../domain/indicators';
import { CandleStreams } from '../../domain/data';

export type ScriptDeps = {
  spotMarketStopLimit: SpotMarketStopLimit;
  movingStopLossFromCandles: MovingStopLossFromCandles;
  spot: Spot;
};

export type ScriptParams = {
  symbol: CurrencyPair;
  candleStreams: CandleStreams;
  getBudget: MarketStopLimitParams['getBudget'];
  getStop: MarketStopLimitParams['getStop'];
  RSI: {
    params: RSIParams;
    buyThreshold: number;
    sellThreshold: number;
  };
  restop: Omit<MovingStopParams, 'order' | 'symbol'>;
  rerun: (state: ScriptState<ScriptTrigger>) => boolean;
};

export type ScriptTrigger =
  | {
      type: 'STOP_LOSS_TRIGGERED';
      diff: number;
      side: 'loss' | 'profit';
    }
  | { type: 'PROFIT_TAKEN'; profit: number };

export const makeScript = (deps: ScriptDeps) => (params: ScriptParams) => {
  const { spot, movingStopLossFromCandles, spotMarketStopLimit } = deps;
  const {
    symbol,
    candleStreams,
    getBudget,
    RSI,
    rerun,
    restop,
    getStop
  } = params;
  const rsi = makeRSIStreams(RSI.params)(candleStreams);

  return frame<number, StopLossOrder, void, ScriptTrigger>({
    rerun,
    open$: pipe(
      rsi.currentClosed$,
      rxo.filter(either.exists(rsi => rsi < RSI.buyThreshold))
    ),
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
        rsi.currentClosed$,
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
