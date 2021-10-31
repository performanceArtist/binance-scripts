import { Candle, Spot, Interval, ObservableEither } from '../../domain/types';
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

export type ScriptDeps = {
  spot: Spot;
  getRSI: (params: ScriptRSIParams) => ObservableEither<Error, number>;
  spotMarketStopLimit: SpotMarketStopLimit;
};

export type ScriptRSIParams = {
  symbol: CurrencyPair;
  interval: Interval;
  period: number;
  lookbehind: number;
  rsiFromCandle: (candle: Candle) => number;
};

export type ScriptState = {
  inPosition: boolean;
  triggers: ScriptTrigger[];
};

export type ScriptTrigger =
  | {
      type: 'STOP_LOSS_TRIGGERED';
      loss: number;
    }
  | { type: 'PROFIT_TAKEN'; profit: number };

export type ScriptParams = {
  symbol: CurrencyPair;
  getBudget: MarketStopLimitParams['getBudget'];
  getStop: MarketStopLimitParams['getStop'];
  rerun: (state: ScriptState) => boolean;
  RSI: {
    interval: Interval;
    period: number;
    fromCandle: (candle: Candle) => number;
    lookbehind: number;
    buyThreshold: number;
    sellThreshold: number;
  };
};

export const makeScript = (deps: ScriptDeps) => (params: ScriptParams) => {
  const { spot, spotMarketStopLimit, getRSI } = deps;
  const { symbol, getBudget, getStop, RSI, rerun } = params;

  const rsi$ = getRSI({ symbol, ...RSI, rsiFromCandle: RSI.fromCandle });
  const state = new rx.BehaviorSubject<ScriptState>({
    inPosition: false,
    triggers: []
  });

  const script$ = pipe(
    rsi$, // open phase
    rxo.filter(
      either.exists(rsi => rsi < RSI.buyThreshold && rerun(state.getValue()))
    ),
    rxo.tap(() => state.next({ ...state.getValue(), inPosition: true })),
    switchMapEither(() =>
      // execution phase
      spotMarketStopLimit({ symbol, getBudget, getStop })
    ),
    observableEither.chain(stopLossOrder => {
      // manage phase
      const profitTaken = new rx.Subject<{ profit: number }>();

      const positionClosed$ = pipe(
        profitTaken.asObservable(),
        rxo.tap(({ profit }) =>
          state.next({
            inPosition: false,
            triggers: state
              .getValue()
              .triggers.concat({ type: 'PROFIT_TAKEN', profit })
          })
        )
      );
      const stopFilled$ = pipe(
        stopLossOrder.filled$,
        observableEither.map(result =>
          state.next({
            inPosition: false,
            triggers: state.getValue().triggers.concat({
              type: 'STOP_LOSS_TRIGGERED',
              loss: Math.abs(
                stopLossOrder.quantity * stopLossOrder.price -
                  result.price * result.quantity
              )
            })
          })
        )
      );

      return pipe(
        rsi$,
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
    })
  );

  return { script$, state };
};
