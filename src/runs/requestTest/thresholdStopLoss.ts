import { option } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { identity, pipe } from 'fp-ts/lib/function';
import {
  logObservableToArray,
  makeMockSpot,
  makeSplitCandleStreams
} from '../../domain/simulation';
import {
  getHighLowStop,
  thresholdStopLoss
} from '../../domain/trade/movingStopLimit';
import { config } from '../../config';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { makeMarketAPI } from '../../binance';
import { spotMarketStopLimit } from '../../domain/trade/marketStopLimit';
import { fromLossPercent } from '../../domain/trade/stopLoss';
import { switchMapEither } from '../../utils/switchMapEither';
import ws from 'ws';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const market = makeMarketAPI.value.run({ httpClient, socketClient });

const streams = makeSplitCandleStreams.value.run({ market })({
  symbol: { base: 'BTC', quote: 'USDT' },
  startTime: option.some(new Date(2021, 11, 6).getTime()),
  total: 1000,
  historicalTotal: 200,
  interval: '5m',
  getCurrentCandle: () => identity,
  intervalDelay: 25,
  updatesInInterval: 1
});

const { action$, spot } = pipe(
  streams.current$,
  observableEither.map(candle => candle.low),
  price$ => makeMockSpot({ price$ })
);

const manageStop = thresholdStopLoss.value.run({
  getClosedCurrentCandle: () => streams.currentClosed$,
  spot
});

const order$ = pipe(
  spotMarketStopLimit.value.run({
    spot,
    getBalance: () => observableEither.of(10000)
  }),
  initialOrder =>
    initialOrder({
      symbol: { base: 'BTC', quote: 'USDT' },
      getBudget: () => 1000,
      getStop: fromLossPercent(0.01, 0.001)
    }),
  switchMapEither(
    order =>
      manageStop({
        symbol: { base: 'BTC', quote: 'USDT' },
        order,
        interval: '5m',
        count: 20,
        maxLimit: base => base,
        getStop: getHighLowStop({
          fromCandle: candle => candle.close,
          stopOffsetPercent: 0.001,
          getLimit: (current, { high, low }) => {
            const optimistic = high + (high - low) / 3;
            const pessimistic = low + (current.close - low) / 3;
            return current.close > optimistic ? optimistic : pessimistic;
          }
        })
      }).stopLoss$
  )
);

order$.subscribe(console.log);

logObservableToArray('logs/thresholdStopLoss.json')(action$);
