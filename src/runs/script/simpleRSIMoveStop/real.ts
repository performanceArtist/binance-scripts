import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { runScript } from '../../../scripts/simpleRSIMoveStop/run';
import { config } from '../../../config';
import ws from 'ws';
import { tradeController } from '../../../../generated/spot_api.yaml/paths/TradeController';
import { streamController } from '../../../../generated/spot_api.yaml/paths/StreamController';
import { fromLimit, fromLossPercent } from '../../../domain/trade/stopLoss';
import { pipe } from 'fp-ts/lib/function';
import { sequenceT } from 'fp-ts/lib/Apply';
import { array, either, option } from 'fp-ts';
import { once } from '../../../scripts/shared/rerun';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const runRSIScript = runScript({
  trade: tradeController({ httpClient }),
  stream: streamController({ httpClient }),
  socketClient,
  httpClient,
  signQuery
});

const symbol = {
  base: 'BTC',
  quote: 'USDT'
};

const { script$, state } = runRSIScript({
  symbol: {
    base: 'BTC',
    quote: 'USDT'
  },
  interval: '5m',
  lookbehind: 500,
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
  rerun: once,
  RSI: {
    params: {
      period: 14,
      fromCandle: candle => candle.close
    },
    buyThreshold: 30,
    sellThreshold: 70
  }
});
