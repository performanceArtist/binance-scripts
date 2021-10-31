import { makeMarketAPI } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { array, either } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { getSmoothStochRSI } from 'trading-indicators';
import { getXLastCandles } from '../../domain/trade/market';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL);

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
        getSmoothStochRSI(14)
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
