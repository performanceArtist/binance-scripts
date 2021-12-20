import { getBalanceOf, makeMarketAPI, makeSpot } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { tradeController } from '../../../generated/spot_api.yaml/paths/TradeController';
import { streamController } from '../../../generated/spot_api.yaml/paths/StreamController';
import { fromLossPercent } from '../../domain/trade/stopLoss';
import { makeCandleBuyTrigger } from '../../domain/trade/candleTrigger';
import ws from 'ws';
import { container } from '@performance-artist/fp-ts-adt';
import { pipe } from 'fp-ts/lib/function';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

export const candleBuyTrigger = pipe(
  makeCandleBuyTrigger,
  container.base,
  container.inject('market', makeMarketAPI),
  container.inject('spot', makeSpot),
  container.inject('getBalance', getBalanceOf),
  container.resolve
)({
  httpClient,
  trade: tradeController({ httpClient }),
  stream: streamController({ httpClient }),
  socketClient,
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
