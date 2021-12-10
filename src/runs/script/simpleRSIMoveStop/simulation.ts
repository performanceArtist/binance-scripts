import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { makeMarketAPI } from '../../../binance';
import { config } from '../../../config';
import ws from 'ws';
import { makeTestScript } from '../../../scripts/simpleRSIMoveStop/test';
import { identity, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { array, either, option } from 'fp-ts';
import { logObservable } from '../../../domain/simulation';
import { sequenceT } from 'fp-ts/lib/Apply';
import { fromLimit, fromLossPercent } from '../../../domain/trade/stopLoss';
import { pairToString } from '../../../domain/data/currencyPair';
import { SpotAction } from '../../../domain/types';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const market = makeMarketAPI({ httpClient, socketClient });

const testScript = makeTestScript({ market });

const symbols = [
  {
    base: 'BTC',
    quote: 'USDT'
  },
  {
    base: 'SOL',
    quote: 'USDT'
  },
  {
    base: 'ALGO',
    quote: 'USDT'
  },
  {
    base: 'ATOM',
    quote: 'USDT'
  },
  {
    base: 'AXS',
    quote: 'USDT'
  },
  {
    base: 'REN',
    quote: 'USDT'
  },
  {
    base: 'ONE',
    quote: 'USDT'
  },
  {
    base: 'BNB',
    quote: 'USDT'
  },
  {
    base: 'MANA',
    quote: 'USDT'
  },
  {
    base: 'ENJ',
    quote: 'USDT'
  },
  {
    base: 'MATIC',
    quote: 'USDT'
  },
  {
    base: 'ICP',
    quote: 'USDT'
  }
];

symbols.forEach(symbol => {
  const { script$, action$, state } = testScript({
    symbol,
    splitStreams: {
      startTime: option.some(Date.parse('2021-10-29T00:00:00.000+00:00')),
      total: 1000,
      historicalTotal: 500,
      interval: '5m',
      getCurrentCandle: () => identity,
      intervalDelay: 25,
      updatesInInterval: 1
    },
    script: {
      getBudget: () => 1000,
      getStop: fromLossPercent(0.01, 0.001),
      rerun: state => !state.inPosition,
      RSI: {
        params: {
          interval: '5m',
          period: 14,
          fromCandle: candle => candle.close,
          lookbehind: 500
        },
        buyThreshold: 30,
        sellThreshold: 70
      },
      restop: {
        interval: '5m',
        count: 20,
        getStop: (candles, prevStop) =>
          pipe(
            sequenceT(option.option)(array.head(candles), array.last(candles)),
            either.fromOption(() => new Error('Insufficient data')),
            either.map(([first, last]) =>
              fromLimit(0.001)(first.close + (last.close - first.close) / 3)
            ),
            either.filterOrElse(
              newStop => newStop.stop > prevStop.stop,
              () =>
                new Error('Stop loss should be moved towards the profit side')
            )
          )
      }
    }
  });

  script$.subscribe();

  logObservable(`logs/${pairToString(symbol)}.json`)(
    pipe(
      action$,
      rxo.scan((acc, cur) => acc.concat(cur), [] as SpotAction[])
    )
  );
  logObservable(`logs/${pairToString(symbol)}.state.json`)(
    state.asObservable()
  );
});
