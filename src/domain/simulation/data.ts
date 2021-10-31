import { array, either, nonEmptyArray, option, reader } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { Option } from 'fp-ts/lib/Option';
import { Interval, Candle, ObservableEither } from '../types';
import * as rxo from 'rxjs/operators';
import { CandleStreams } from '../data';
import { observableEither } from 'fp-ts-rxjs';
import { switchMapEither } from '../../utils/switchMapEither';
import * as rx from 'rxjs';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import { CurrencyPair } from '../data/currencyPair';
import { getXCandles, getXLastCandles } from '../trade/market';
import { readerUtils } from '@performance-artist/fp-ts-adt';

export type SplitCandleStreamsParams = {
  symbol: CurrencyPair;
  startTime: Option<number>;
  total: number;
  historicalTotal: number;
  interval: Interval;
  intervalDelay: number;
  updatesInInterval: number;
  getCurrentCandle: (
    open: Candle,
    close: Candle
  ) => (lastOpen: Candle) => Candle;
};

export const defaultGetCurrentCandle = (open: Candle, close: Candle) => (
  lastOpen: Candle
) => {
  const isUp = Math.random() > 0.5;
  const change = Math.random() / 20;
  const newPrice = isUp
    ? lastOpen.close * (1 + change)
    : lastOpen.close * (1 - change);
  const volumeChange = Math.random() / 10;

  return {
    open: open.close,
    high: Math.max(lastOpen.high, newPrice),
    low: Math.min(lastOpen.low, newPrice),
    close: newPrice,
    volume: lastOpen.volume * (1 + volumeChange),
    timestamp: close.timestamp
  };
};

export const makeSplitCandleStreams = pipe(
  readerUtils.combine(getXLastCandles, getXCandles),
  reader.map(
    ([getXLastCandles, getXCandles]) => (
      params: SplitCandleStreamsParams
    ): CandleStreams => {
      const {
        startTime,
        total,
        symbol,
        interval,
        historicalTotal,
        getCurrentCandle,
        intervalDelay,
        updatesInInterval
      } = params;

      const total$ = pipe(
        startTime,
        option.fold(
          () =>
            pipe(
              getXLastCandles({
                symbol,
                interval,
                total
              })
            ),
          startTime => getXCandles({ symbol, interval, startTime, total })
        )
      );

      return makeMockCandleStreams({
        total$,
        historicalTotal,
        getCurrentCandle,
        intervalDelay,
        updatesInInterval
      });
    }
  )
);

export type MockCandleStreamsParams = {
  total$: ObservableEither<Error, Candle[]>;
  historicalTotal: number;
  intervalDelay: number;
  updatesInInterval: number;
  getCurrentCandle: (
    open: Candle,
    close: Candle
  ) => (lastOpen: Candle) => Candle;
};

export const makeMockCandleStreams = (
  params: MockCandleStreamsParams
): CandleStreams => {
  const {
    total$,
    historicalTotal,
    getCurrentCandle,
    intervalDelay,
    updatesInInterval
  } = params;

  const historical$ = pipe(
    total$,
    observableEither.map(total => total.slice(0, historicalTotal))
  );

  const all$ = pipe(
    total$,
    rxo.map(
      either.chain(total =>
        pipe(
          total.slice(historicalTotal - 1, total.length),
          array.chunksOf(2),
          nonEmptyArray.fromArray,
          either.fromOption(() => new Error('Not enough data'))
        )
      )
    ),
    switchMapEither(pairs =>
      pipe(
        rx.from(nonEmptyArray.tail(pairs)),
        rxo.concatMap(pair => pipe(rx.of(pair), rxo.delay(intervalDelay))),
        rxo.filter(pair => pair.length === 2),
        rxo.map(pair => either.right(pair)),
        rxo.startWith(
          either.right<Error, NonEmptyArray<Candle>>(nonEmptyArray.head(pairs))
        )
      )
    ),
    switchMapEither(([open, close]) => {
      const next = getCurrentCandle(open, close);

      return pipe(
        rx.from(
          [...Array(updatesInInterval)]
            .map(_ => 0)
            .reduce(
              acc => pipe(acc, array.append(next(nonEmptyArray.last(acc)))),
              nonEmptyArray.of(next(open))
            )
        ),
        rxo.map(current => either.right({ current, currentClosed: close }))
      );
    }),
    rxo.shareReplay(1)
  );

  const currentClosed$ = pipe(
    all$,
    observableEither.map(all => all.currentClosed),
    rxo.distinctUntilChanged(
      (a, b) => a._tag === 'Right' && b._tag === 'Right' && a.right === b.right
    )
  );

  const current$ = pipe(
    all$,
    observableEither.map(all => all.current)
  );

  return {
    historical$,
    currentClosed$,
    current$
  };
};
