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
} from '../../domain/indicators/dominance';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL);

const market = makeMarketAPI({ httpClient, socketClient });

const getBTCDominance = makeGetBTCDominance({ market });
const getAverageBTCDominance = makeGetAverageBTCDominance({ market });

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
