import { option } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { identity, pipe } from 'fp-ts/lib/function';
import {
  logObservableToArray,
  makeMockSpot,
  makeSplitCandleStreams,
  getHighLowStop,
  thresholdStopLoss,
  spotMarketStopLimit,
  fromLossPercent,
  CurrencyPair,
  Interval
} from 'trading-indicators-streams';
import { config } from '../../config';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { makeMarketAPI } from '../../binance';
import { switchMapEither } from '../../utils/switchMapEither';
import ws from 'ws';
import { selector } from '@performance-artist/fp-ts-adt';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const market = makeMarketAPI.value.run({ httpClient, socketClient });

const getStreams = pipe(makeSplitCandleStreams.value.run({ market }), f =>
  pipe(
    selector.keys<{ symbol: CurrencyPair; interval: Interval }>()(
      'symbol',
      'interval'
    ),
    selector.map(rest =>
      f({
        startTime: option.some(new Date(2021, 11, 6).getTime()),
        total: 1000,
        historicalTotal: 200,
        getCurrentCandle: () => identity,
        intervalDelay: 25,
        updatesInInterval: 1,
        ...rest
      })
    )
  )
);

const symbol = { base: 'BTC', quote: 'USDT' };

const interval: Interval = '5m';

const { action$, spot } = makeMockSpot({
  getCurrentPrice: symbol =>
    pipe(
      getStreams.run({ symbol, interval }).current$,
      observableEither.map(candle => candle.low)
    )
});

const manageStop = thresholdStopLoss.value.run({
  getClosedCurrentCandle: params => getStreams.run(params).currentClosed$,
  spot
});

const order$ = pipe(
  spotMarketStopLimit.value.run({
    spot,
    getBalance: () => observableEither.of(10000)
  }),
  initialOrder =>
    initialOrder({
      symbol,
      getBudget: () => 1000,
      getStop: fromLossPercent(0.01, 0.001)
    }),
  switchMapEither(
    order =>
      manageStop({
        symbol,
        order,
        interval,
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
