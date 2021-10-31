import { makeMarketAPI, makeSpot } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { tradeController } from '../../../generated/spot_api.yaml/paths/TradeController';
import { streamController } from '../../../generated/spot_api.yaml/paths/StreamController';
import { fromLossPercent } from '../../domain/trade/stopLoss';
import { makeCandleBuyTrigger } from '../../domain/trade/candleTrigger';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL);

const market = makeMarketAPI({ httpClient, socketClient });

const trade = tradeController({ httpClient });

const spot = makeSpot({
  trade,
  stream: streamController({ httpClient }),
  socketClient,
  signQuery
});

export const candleBuyTrigger = makeCandleBuyTrigger({
  market,
  spot,
  trade,
  signQuery
});

const order$ = candleBuyTrigger({
  baseSymbol: { base: 'BTC', quote: 'USDT' },
  baseInterval: '1m',
  trigger: candle => candle.close < 53000,
  orders: [
    {
      symbol: { base: 'ALGO', quote: 'USDT' },
      getBudget: () => 1000,
      getStop: fromLossPercent(0.01, 0.001)
    }
  ]
});
