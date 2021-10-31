import { makeMarketAPI } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { array, either, nonEmptyArray, option } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import {
  generalizeTrend,
  getTrendAcc,
  getHighLows,
  higherHighsHigherLows,
  higherHighsHigherLowsRatio
} from 'trading-indicators';
import { exponentialMA, mapInterval } from 'trading-indicators';
import { logObservable } from '../../domain/simulation';
import { observableEither } from 'fp-ts-rxjs';
import { getXLastCandles } from '../../domain/trade/market';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL);

const market = makeMarketAPI({ httpClient, socketClient });

const trend$ = pipe(
  getXLastCandles({ market })({
    symbol: {
      base: 'BTC',
      quote: 'USDT'
    },
    interval: '5m',
    total: 600
  }),
  rxo.map(
    either.chain(
      flow(
        array.map(c => (c.open + c.close + c.low + c.high) / 4),
        exponentialMA(14),
        option.chain(getTrendAcc),
        option.chain(acc => generalizeTrend(acc.result)),
        either.fromOption(() => new Error('Failed to build a trend'))
      )
    )
  ),
  observableEither.map(e => {
    const highLows = getHighLows(e);
    console.log(highLows);
    console.log(higherHighsHigherLowsRatio(highLows));
    return e;
  })
);

logObservable('log.json')(trend$);
