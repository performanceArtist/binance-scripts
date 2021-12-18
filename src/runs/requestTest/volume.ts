import { makeMarketAPI } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { array, either } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { volumeLevels, volumeToMax } from 'trading-indicators';
import { getXLastCandles } from '../../domain/trade/market';
import ws from 'ws';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const market = makeMarketAPI({ httpClient, socketClient });

const volumeLevels$ = pipe(
  getXLastCandles({ market })({
    symbol: {
      base: 'BTC',
      quote: 'USDT'
    },
    interval: '1h',
    total: 1000
  }),
  rxo.map(
    either.map(
      flow(
        array.map(c => ({ volume: c.volume, price: c.close })),
        volumeLevels(200),
        volumeToMax
      )
    )
  )
);

volumeLevels$.subscribe(either.fold(console.error, console.log));
