import { makeIsolatedMargin } from '../../binance';
import { makeMarketAPI } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { array, either } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { exponentialMA, simpleMA } from 'trading-indicators';
import { marginController } from '../../../generated/spot_api.yaml/paths/MarginController';
import { switchMapEither } from '../../utils/switchMapEither';
import { isolatedMarginStreamController } from '../../../generated/spot_api.yaml/paths/IsolatedMarginStreamController';
import { tradeController } from '../../../generated/spot_api.yaml/paths/TradeController';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL);

const m = makeIsolatedMargin({
  signQuery,
  margin: marginController({ httpClient }),
  trade: tradeController({ httpClient }),
  isolatedMargin: isolatedMarginStreamController({ httpClient }),
  socketClient
});

/*
const action$ = pipe(
  m.put({
    asset: 'USDT',
    symbol: 'BTCUSDT',
    amount: 100
  }),
  switchMapEither(() =>
    m.take({
      asset: 'USDT',
      symbol: 'BTCUSDT',
      amount: 50
    })
  )
);

action$.subscribe(either.fold(e => console.error('error', e), console.log));
*/
