import { makeMarketAPI, makeSpot } from '../../binance';
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

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL);

const trade = tradeController({ httpClient });

const spot = makeSpot({
  trade,
  stream: streamController({ httpClient }),
  socketClient,
  signQuery
});

const spotLimitStopLimit = makeSpotLimitStopLimit({
  spot,
  getBalance: getBalanceOf({ trade, signQuery })
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
