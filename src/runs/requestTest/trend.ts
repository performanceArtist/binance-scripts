import { makeMarketAPI } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { array, either, nonEmptyArray, option, reader } from 'fp-ts';
import { flow, identity, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { generalizeTrend } from 'trading-indicators';
import {
  logObservable,
  makeSplitCandleStreams,
  SplitCandleStreamsParams
} from '../../domain/simulation';
import { observable, observableEither } from 'fp-ts-rxjs';
import {
  getXLastCandles,
  getClosedCurrentCandle
} from '../../domain/trade/market';
import { switchMapEither } from '../../utils/switchMapEither';
import { Candle } from '../../domain/types';
import {
  CandleStreamsParams,
  makeAccStreams,
  makeCandleStreams
} from '../../domain/data';
import { openCloseHighLowAverage } from '../../domain/utils';
import { makeEMATrendAcc } from '../../domain/indicators/emaTrend';
import ws from 'ws';
import { Either } from 'fp-ts/lib/Either';
import { makeRSIStreams } from '../../domain/indicators';
import { sequenceT } from 'fp-ts/lib/Apply';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const market = makeMarketAPI.value.run({ httpClient, socketClient });

const getStreams = (period: number) =>
  makeSplitCandleStreams.value.run({ market })({
    symbol: { base: 'BTC', quote: 'USDT' },
    startTime: option.some(period),
    total: 1000,
    historicalTotal: 500,
    interval: '5m',
    getCurrentCandle: () => identity,
    intervalDelay: 25,
    updatesInInterval: 1
  });

const trendSim$ = flow(
  getStreams,
  makeEMATrendAcc({ emaPeriod: 14, fromCandle: openCloseHighLowAverage }),
  e => e.closed$,
  rxo.map(
    either.chain(acc =>
      pipe(
        generalizeTrend(acc.trendAcc.result),
        either.fromOption(() => new Error('Failed to generalize')),
        either.map(general => ({ general, raw: acc.trendAcc.result }))
      )
    )
  )
);

const rsi = flow(
  getStreams,
  makeRSIStreams({
    fromCandle: openCloseHighLowAverage,
    period: 14
  })
);

type Signal<M> = {
  side: 'buy' | 'sell';
  meta: M;
};

type Meta = {
  price: number;
  rsi: number;
};

const entryExit$ = (period: number) =>
  pipe(
    sequenceT(observableEither.observableEither)(
      trendSim$(period),
      rsi(period).closed$
    ),
    rxo.map(
      either.chain(
        ([trend, rsi]): Either<Error, Signal<Meta>> => {
          const lastRaw = nonEmptyArray.last(trend.raw);

          if (
            nonEmptyArray.last(trend.general).type === 'falling' &&
            lastRaw.type === 'rising' &&
            lastRaw.data.length === 3 &&
            nonEmptyArray.last(rsi) < 50
          ) {
            return either.right({
              side: 'buy',
              meta: {
                price: nonEmptyArray.last(lastRaw.data),
                rsi: nonEmptyArray.last(rsi)
              }
            });
          }

          if (
            nonEmptyArray.last(trend.general).type === 'rising' &&
            lastRaw.type === 'falling' &&
            lastRaw.data.length === 3 &&
            nonEmptyArray.last(rsi) > 50
          ) {
            return either.right({
              side: 'sell',
              meta: {
                price: nonEmptyArray.last(lastRaw.data),
                rsi: nonEmptyArray.last(rsi)
              }
            });
          }

          return either.left(new Error('Nothing'));
        }
      )
    ),
    rxo.filter(either.isRight),
    rxo.scan((acc, cur) => acc.concat(cur.right), [] as Signal<Meta>[]),
    rxo.startWith(either.right([]))
  );

/*
logObservable('logs/trend.json')(trendSim$);
logObservable('logs/entryExit.json')(entryExit$);
*/

const periods = pipe(
  Array(10)
    .fill(null)
    .map((_, i) => i),
  array.map(index => new Date(2021, 10, index + 2).getTime())
);

const hmm = pipe(
  periods,
  array.traverse(observable.observable)(period =>
    pipe(
      entryExit$(period),
      rxo.map(result => ({ result, period }))
    )
  )
);

logObservable('logs/entryExit.json')(hmm);

/*
periods.forEach(period => {
  const s$ = entryExit$(period);
  logObservable('logs/trend.json')(trendSim$);
  logObservable('logs/entryExit.json')(entryExit$);
})
*/
