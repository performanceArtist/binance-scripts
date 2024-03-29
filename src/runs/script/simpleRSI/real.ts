import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { runScript } from '../../../scripts/simpleRSI/run';
import { config } from '../../../config';
import ws from 'ws';
import { tradeController } from '../../../../generated/spot_api.yaml/paths/TradeController';
import { streamController } from '../../../../generated/spot_api.yaml/paths/StreamController';
import { fromLossPercent } from 'trading-indicators-streams';
import { once } from '../../../scripts/shared/rerun';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const runRSIScript = runScript({
  socketClient,
  signQuery,
  trade: tradeController({ httpClient }),
  stream: streamController({ httpClient }),
  httpClient
});

const symbol = {
  base: 'BTC',
  quote: 'USDT'
};

const script$ = runRSIScript({
  symbol,
  interval: '1m',
  lookbehind: 500,
  getBudget: () => 100,
  getStop: fromLossPercent(0.015, 0.0025),
  rerun: once,
  RSI: {
    params: {
      period: 14,
      fromCandle: candle => candle.close
    },
    buyThreshold: 30,
    sellThreshold: 70
  }
});
