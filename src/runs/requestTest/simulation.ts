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
import { container } from '@performance-artist/fp-ts-adt';
import { pipe } from 'fp-ts/lib/function';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const makeStreams = pipe(
  makeSplitCandleStreams,
  container.base,
  container.inject('market', makeMarketAPI),
  container.resolve
)({
  httpClient,
  socketClient
});

const streams = makeStreams({
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
