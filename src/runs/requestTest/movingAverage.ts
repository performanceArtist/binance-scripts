import { makeMarketAPI } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { array, either } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { getExponentialMA, getSimpleMA } from 'trading-indicators';
import { getXLastCandles } from '../../domain/trade/market';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL);

const market = makeMarketAPI({ httpClient, socketClient });

const candles$ = getXLastCandles({ market })({
  symbol: {
    base: 'BTC',
    quote: 'USDT'
  },
  interval: '1h',
  total: 50
});

const simpleMA$ = pipe(
  candles$,
  rxo.map(
    either.chain(
      flow(
        array.map(c => c.close),
        getSimpleMA(20),
        either.fromOption(() => new Error('Insufficient data'))
      )
    )
  )
);

simpleMA$.subscribe(
  either.fold(console.error, r => console.log('Simple MA:', r))
);

const exponentialMA$ = pipe(
  candles$,
  rxo.map(
    either.chain(
      flow(
        array.map(c => c.close),
        getExponentialMA(20),
        either.fromOption(() => new Error('Insufficient data'))
      )
    )
  )
);

exponentialMA$.subscribe(
  either.fold(console.error, r => console.log('Exponential MA:', r))
);
