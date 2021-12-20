import { array, either, option, reader } from 'fp-ts';
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
import { fromLimit, StopLoss } from './stopLoss';
import * as rxo from 'rxjs/operators';
import { switchMapEither } from '../../utils/switchMapEither';
import { splitStream } from '../../utils/splitStream';
import { observableEither } from 'fp-ts-rxjs';
import * as rx from 'rxjs';
import { GetClosedCurrentCandle } from './market';
import { container } from '@performance-artist/fp-ts-adt';

export type MovingStopParams = {
  order: StopLossOrder;
  symbol: CurrencyPair;
  interval: Interval;
  count: number;
  getStop: (
    candles: Candle[],
    prevStop: StopLoss,
    order: StopLossOrder
  ) => Either<Error, StopLoss>;
};

export type MovingStopLossFromCandles = (
  params: MovingStopParams
) => {
  stopLoss$: ObservableEither<Error, void>;
  current: BehaviorSubject<StopLossOrder>;
  close: () => ObservableEither<Error, void>;
};

export const movingStopLossFromCandles = pipe(
  container.create<{
    getClosedCurrentCandle: GetClosedCurrentCandle;
    spot: Spot;
  }>()('getClosedCurrentCandle', 'spot'),
  container.map(
    (deps): MovingStopLossFromCandles => ({
      order,
      symbol,
      interval,
      count,
      getStop
    }) => {
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
            rxo.map(
              either.chain(candles =>
                getStop(candles, current.getValue(), order)
              )
            )
          )
      })({ order, symbol });
    }
  )
);

export type ThresholdStopLoss = (
  params: MovingStopParams & {
    maxLimit: (base: number) => number;
  }
) => {
  stopLoss$: ObservableEither<Error, void>;
  current: BehaviorSubject<StopLossOrder>;
  close: () => ObservableEither<Error, void>;
};

export const thresholdStopLoss = pipe(
  movingStopLossFromCandles,
  container.map(
    (movingStopLossFromCandles): ThresholdStopLoss => params =>
      movingStopLossFromCandles({
        ...params,
        getStop: (candles, prevStop, order) =>
          pipe(
            params.getStop(candles, prevStop, order),
            either.chain(newStop => {
              const max = params.maxLimit(order.price);
              const isTargetReached = prevStop.limit >= max;

              if (isTargetReached) {
                return either.left(new Error('Target reached'));
              } else {
                const finalStop =
                  newStop.limit >= max
                    ? fromLimit(1 - newStop.limit / newStop.stop)(max)
                    : newStop;
                return either.right(finalStop);
              }
            }),
            either.filterOrElse(
              newStop => newStop.stop > prevStop.stop,
              () =>
                new Error('Stop loss should be moved towards the profit side')
            )
          )
      })
  )
);

export const getHighLowStop = ({
  getLimit,
  fromCandle,
  stopOffsetPercent
}: {
  getLimit: (current: Candle, highLow: { high: number; low: number }) => number;
  fromCandle: (candle: Candle) => number;
  stopOffsetPercent: number;
}): MovingStopParams['getStop'] => candles =>
  pipe(
    candles,
    array.last,
    option.map(last =>
      fromLimit(stopOffsetPercent)(
        getLimit(last, getHighLow(fromCandle)(candles))
      )
    ),
    either.fromOption(() => new Error('Failed to calculate stop loss'))
  );

export const getHighLow = (fromCandle: (candle: Candle) => number) => (
  candles: Candle[]
) =>
  pipe(candles, array.map(fromCandle), prices => ({
    high: Math.max(...prices),
    low: Math.min(...prices)
  }));

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
