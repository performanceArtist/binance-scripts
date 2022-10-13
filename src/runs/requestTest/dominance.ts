import { makeMarketAPI } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { either } from 'fp-ts';
import {
  makeGetAverageBTCDominance,
  makeGetBTCDominance
} from 'trading-indicators-streams';
import ws from 'ws';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const market = makeMarketAPI.value.run({ httpClient, socketClient });

const getBTCDominance = makeGetBTCDominance.value.run({ market });
const getAverageBTCDominance = makeGetAverageBTCDominance.value.run({ market });

const dominance = getAverageBTCDominance({
  symbol: {
    base: 'ADA',
    quote: 'USDT'
  },
  interval: '5m',
  startTime: new Date(2021, 10, 5).getTime(),
  candleTotal: 1000,
  repeat: 5
});

dominance.subscribe(either.fold(console.error, console.log));
