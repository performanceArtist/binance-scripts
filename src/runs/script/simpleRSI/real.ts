import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { makeMarketAPI } from '../../../binance';
import { runScript } from '../../../scripts/simpleRSI/run';
import { config } from '../../../config';
import ws from 'ws';
import { tradeController } from '../../../../generated/spot_api.yaml/paths/TradeController';
import { streamController } from '../../../../generated/spot_api.yaml/paths/StreamController';
import { fromLossPercent } from '../../../domain/trade/stopLoss';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const runRSIScript = runScript({
  market: makeMarketAPI({ httpClient, socketClient }),
  socketClient,
  signQuery,
  trade: tradeController({ httpClient }),
  stream: streamController({ httpClient })
});

const script$ = runRSIScript({
  symbol: {
    base: 'BTC',
    quote: 'USDT'
  },
  getBudget: () => 100,
  getStop: fromLossPercent(0.015, 0.0025),
  rerun: state => state.triggers.length === 0,
  RSI: {
    interval: '1m',
    period: 14,
    fromCandle: candle => candle.close,
    lookbehind: 500,
    buyThreshold: 30,
    sellThreshold: 70
  }
});
