import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../../config';
import ws from 'ws';
import { makeTestScript } from '../../../scripts/simpleRSI/test';
import { identity, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { option } from 'fp-ts';
import { logObservable } from '../../../domain/simulation';
import { pairToString } from '../../../domain/data/currencyPair';
import { fromLossPercent } from '../../../domain/trade/stopLoss';
import { SpotAction } from '../../../domain/types';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const testScript = makeTestScript({ httpClient, socketClient });

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

symbols.map(symbol => {
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
          period: 14,
          fromCandle: candle => candle.close
        },
        buyThreshold: 30,
        sellThreshold: 70
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
