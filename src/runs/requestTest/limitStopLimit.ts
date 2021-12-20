import { makeSpot } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { makeSpotLimitStopLimit } from '../../domain/trade/limitStopLimit';
import { streamController } from '../../../generated/spot_api.yaml/paths/StreamController';
import { tradeController } from '../../../generated/spot_api.yaml/paths/TradeController';
import { getBalanceOf } from '../../binance/account';
import { fromLossPercent } from '../../domain/trade/stopLoss';
import ws from 'ws';
import { pipe } from 'fp-ts/lib/function';
import { container } from '@performance-artist/fp-ts-adt';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const trade = tradeController({ httpClient });

const spotLimitStopLimit = pipe(
  makeSpotLimitStopLimit,
  container.base,
  container.inject('spot', makeSpot),
  container.inject('getBalance', getBalanceOf),
  container.resolve
)({
  trade,
  stream: streamController({ httpClient }),
  socketClient,
  signQuery
});

const order$ = spotLimitStopLimit({
  symbol: { base: 'BTC', quote: 'USDT' },
  price: 53000,
  getBudget: balance => balance * 0.2,
  getStop: fromLossPercent(0.01, 0.025)
});

const noBalanceOrder$ = spotLimitStopLimit({
  symbol: { base: 'BTC', quote: 'USDT' },
  price: 53000,
  getBudget: () => 200,
  getStop: fromLossPercent(0.01, 0.025)
});
