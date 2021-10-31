import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { makeMarketAPI, makeSpot } from '../../../binance';
import { runScript } from '../../../scripts/simpleRSIMoveStop/run';
import { config } from '../../../config';
import ws from 'ws';
import { tradeController } from '../../../../generated/spot_api.yaml/paths/TradeController';
import { streamController } from '../../../../generated/spot_api.yaml/paths/StreamController';
import { fromLimit, fromLossPercent } from '../../../domain/trade/stopLoss';
import { pipe } from 'fp-ts/lib/function';
import { sequenceT } from 'fp-ts/lib/Apply';
import { array, either, option } from 'fp-ts';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const runRSIScript = runScript({
  market: makeMarketAPI({ httpClient, socketClient }),
  trade: tradeController({ httpClient }),
  stream: streamController({ httpClient }),
  socketClient,
  signQuery
});

const { script$, state } = runRSIScript({
  symbol: {
    base: 'BTC',
    quote: 'USDT'
  },
  restop: {
    interval: '5m',
    count: 20,
    getStop: (candles, prevStop) =>
      pipe(
        sequenceT(option.option)(array.head(candles), array.last(candles)),
        either.fromOption(() => new Error('Insufficient data')),
        either.map(([first, last]) =>
          fromLimit(0.001)(first.close + (last.close - first.close) / 3)
        ),
        either.filterOrElse(
          newStop => newStop.stop > prevStop.stop,
          () => new Error('Stop loss should be moved towards the profit side')
        )
      )
  },
  getBudget: () => 100,
  getStop: fromLossPercent(0.015, 0.0025),
  rerun: state => state.triggers.length === 0,
  RSI: {
    interval: '5m',
    period: 14,
    fromCandle: candle => candle.close,
    lookbehind: 500,
    buyThreshold: 30,
    sellThreshold: 70
  }
});
