import { makeMarketAPI } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { array, either, option } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { getExponentialMA, getStochRSI } from 'trading-indicators';
import { getXLastCandles } from '../../domain/trade/market';
import ws from 'ws';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const market = makeMarketAPI({ httpClient, socketClient });

const stochRSI$ = pipe(
  getXLastCandles({ market })({
    symbol: {
      base: 'BTC',
      quote: 'USDT'
    },
    interval: '1h',
    total: 500
  }),
  rxo.map(
    either.map(
      flow(
        array.map(c => c.close),
        getStochRSI(14),
        option.chain(getExponentialMA(5))
      )
    )
  ),
  rxo.map(either.chain(either.fromOption(() => new Error('Insufficient data'))))
);

stochRSI$.subscribe(e =>
  pipe(
    e,
    either.fold(console.error, e => console.log(e.slice(-20)))
  )
);
