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
import { observableEither } from 'fp-ts-rxjs';
import { getXCandles } from '../../domain/trade/market';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL);

const market = makeMarketAPI({ httpClient, socketClient });

const volumeLevels$ = pipe(
  getXCandles({ market })({
    symbol: {
      base: 'AVAX',
      quote: 'USDT'
    },
    startTime: new Date(2021, 9).getTime(),
    interval: '1h',
    total: 1000
  }),
  rxo.map(
    either.map(
      flow(
        array.map(c => ({ volume: c.volume, price: c.close })),
        volumeLevels(0.25),
        volumeToMax
      )
    )
  ),
  observableEither.map(array.filter(candle => candle.weight > 0.7))
);

volumeLevels$.subscribe(either.fold(console.error, console.log));