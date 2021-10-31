import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { makeMarketAPI } from '../../binance';
import { config } from '../../config';
import ws from 'ws';
import { either, option } from 'fp-ts';
import {
  defaultGetCurrentCandle,
  makeSplitCandleStreams
} from '../../domain/simulation';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const market = makeMarketAPI({ httpClient, socketClient });

const streams = makeSplitCandleStreams({ market })({
  symbol: {
    base: 'BTC',
    quote: 'USDT'
  },
  startTime: option.none,
  total: 1000,
  historicalTotal: 500,
  interval: '1m',
  getCurrentCandle: defaultGetCurrentCandle,
  intervalDelay: 1000,
  updatesInInterval: 5
});

streams.currentClosed$.subscribe(either.fold(console.error, console.log));
streams.current$.subscribe(
  either.fold(console.error, e => console.log('current', e))
);
