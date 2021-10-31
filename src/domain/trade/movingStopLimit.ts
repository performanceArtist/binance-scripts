import { array, either } from 'fp-ts';
import { Either } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import { BehaviorSubject } from 'rxjs';
import { CurrencyPair } from '../data/currencyPair';
import {
  Candle,
  Interval,
  ObservableEither,
  Spot,
  StopLossOrder
} from '../types';
import { StopLoss } from './stopLoss';
import * as rxo from 'rxjs/operators';
import { switchMapEither } from '../../utils/switchMapEither';
import { splitStream } from '../../utils/splitStream';
import { observableEither } from 'fp-ts-rxjs';
import * as rx from 'rxjs';
import { GetClosedCurrentCandle } from './market';

export type MovingStopParams = {
  order: StopLossOrder;
  symbol: CurrencyPair;
  interval: Interval;
  count: number;
  getStop: (candles: Candle[], prevStop: StopLoss) => Either<Error, StopLoss>;
};

export const movingStopLossFromCandles = (deps: {
  getClosedCurrentCandle: GetClosedCurrentCandle;
  spot: Spot;
}) => ({ order, symbol, interval, count, getStop }: MovingStopParams) => {
  const { spot, getClosedCurrentCandle } = deps;

  return makeMovingStopLoss({
    spot,
    getRestop: current =>
      pipe(
        getClosedCurrentCandle({
          symbol,
          interval
        }),
        splitStream(count),
        rxo.map(array.sequence(either.either)),
        rxo.map(either.chain(candles => getStop(candles, current.getValue())))
      )
  })({ order, symbol });
};

export type MovingStopLossFromCandles = ReturnType<
  typeof movingStopLossFromCandles
>;

export const makeMovingStopLoss = (deps: {
  spot: Spot;
  getRestop: (
    current: BehaviorSubject<StopLossOrder>
  ) => ObservableEither<Error, StopLoss>;
}) => ({ order, symbol }: { order: StopLossOrder; symbol: CurrencyPair }) => {
  const { spot, getRestop } = deps;

  const current = new BehaviorSubject(order);

  const filled$ = pipe(
    current.asObservable(),
    rxo.switchMap(current => current.filled$)
  );

  const closed = new rx.Subject<void>();
  const closed$ = closed.asObservable();

  const stopLoss$ = pipe(
    getRestop(current),
    rxo.takeUntil(rx.merge(filled$, closed$)),
    switchMapEither(({ stop, limit }) =>
      pipe(
        current.getValue().cancel(),
        switchMapEither(() =>
          spot.stopLossLimit({
            symbol,
            quantity: order.quantity,
            stop,
            limit
          })
        ),
        observableEither.map(stopLoss => ({
          ...stopLoss,
          stop,
          limit
        }))
      )
    ),
    observableEither.map(newStop =>
      current.next({ ...current.getValue(), ...newStop })
    )
  );

  return {
    stopLoss$,
    current,
    close: () => {
      closed.next();
      return current.getValue().cancel();
    }
  };
};
