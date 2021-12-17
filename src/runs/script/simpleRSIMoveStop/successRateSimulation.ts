import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { makeMarketAPI } from '../../../binance';
import { config } from '../../../config';
import ws from 'ws';
import { makeTestScript } from '../../../scripts/simpleRSIMoveStop/test';
import { flow, identity, pipe } from 'fp-ts/lib/function';
import * as rx from 'rxjs';
import * as rxo from 'rxjs/operators';
import { array, either, option } from 'fp-ts';
import { logObservable } from '../../../domain/simulation';
import { sequenceT } from 'fp-ts/lib/Apply';
import { fromLimit, fromLossPercent } from '../../../domain/trade/stopLoss';
import { CurrencyPair, pairToString } from '../../../domain/data/currencyPair';
import { SpotAction } from '../../../domain/types';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const socketClient = makeBinanceWebSocketClient(config.baseWebSocketURL, ws);

const market = makeMarketAPI({ httpClient, socketClient });

const testScript = makeTestScript({ market });

type Report = {
  inProfit: number;
  atLoss: number;
  profit: number;
  loss: number;
};

const testPeriods = ({
  symbol,
  periods
}: {
  symbol: CurrencyPair;
  periods: number[];
}) =>
  pipe(
    periods,
    array.map(period => ({
      period,
      result: testScript({
        symbol,
        splitStreams: {
          startTime: option.some(period),
          total: 1000,
          historicalTotal: 500,
          interval: '5m',
          getCurrentCandle: () => identity,
          intervalDelay: 25,
          updatesInInterval: 1
        },
        script: {
          getBudget: () => 1000,
          getStop: fromLossPercent(0.01, 0.001),
          rerun: state => !state.inPosition,
          RSI: {
            params: {
              period: 14,
              fromCandle: candle => candle.close
            },
            buyThreshold: 30,
            sellThreshold: 70
          },
          restop: {
            interval: '5m',
            count: 20,
            getStop: (candles, prevStop) =>
              pipe(
                sequenceT(option.option)(
                  array.head(candles),
                  array.last(candles)
                ),
                either.fromOption(() => new Error('Insufficient data')),
                either.map(([first, last]) =>
                  fromLimit(0.001)(first.close + (last.close - first.close) / 3)
                ),
                either.filterOrElse(
                  newStop => newStop.stop > prevStop.stop,
                  () =>
                    new Error(
                      'Stop loss should be moved towards the profit side'
                    )
                )
              )
          }
        }
      })
    })),
    scripts => {
      scripts.forEach(({ result: { script$ } }) => script$.subscribe());

      const combinedState$ = pipe(
        scripts,
        array.map(({ period, result: { state } }) =>
          pipe(
            state.asObservable(),
            rxo.map(state => ({ state, period }))
          )
        ),
        os => rx.combineLatest(os)
      );

      logObservable(`logs/${pairToString(symbol)}.state.json`)(combinedState$);

      const combinedActions$ = pipe(
        scripts,
        array.map(({ period, result: { action$ } }) =>
          pipe(
            action$,
            rxo.scan((acc: SpotAction[], cur) => acc.concat(cur), []),
            rxo.map(actions => ({ actions, period })),
            rxo.startWith({ actions: [], period })
          )
        ),
        os => rx.combineLatest(os)
      );

      logObservable(`logs/${pairToString(symbol)}.json`)(combinedActions$);

      const report$ = pipe(
        combinedState$,
        rxo.map(
          flow(
            array.chain(({ state }) => state.triggers),
            array.reduce(
              { inProfit: 0, atLoss: 0, profit: 0, loss: 0 } as Report,
              (acc, trigger) => {
                switch (trigger.type) {
                  case 'PROFIT_TAKEN':
                    return {
                      ...acc,
                      inProfit: acc.inProfit + 1,
                      profit: acc.profit + trigger.profit
                    };
                  case 'STOP_LOSS_TRIGGERED':
                    return trigger.side === 'profit'
                      ? {
                          ...acc,
                          inProfit: acc.inProfit + 1,
                          profit: acc.profit + trigger.diff
                        }
                      : {
                          ...acc,
                          atLoss: acc.atLoss + 1,
                          loss: acc.loss + trigger.diff
                        };
                }
              }
            )
          )
        )
      );

      logObservable(`logs/${pairToString(symbol)}.report.json`)(report$);
    }
  );

const symbols = [
  {
    base: 'BTC',
    quote: 'USDT'
  },
  {
    base: 'SOL',
    quote: 'USDT'
  },
  {
    base: 'ALGO',
    quote: 'USDT'
  },
  {
    base: 'ATOM',
    quote: 'USDT'
  },
  {
    base: 'AXS',
    quote: 'USDT'
  },
  {
    base: 'REN',
    quote: 'USDT'
  },
  {
    base: 'ONE',
    quote: 'USDT'
  },
  {
    base: 'BNB',
    quote: 'USDT'
  },
  {
    base: 'MANA',
    quote: 'USDT'
  },
  {
    base: 'ENJ',
    quote: 'USDT'
  },
  {
    base: 'MATIC',
    quote: 'USDT'
  },
  {
    base: 'ICP',
    quote: 'USDT'
  }
];

const periods = pipe(
  Array(10)
    .fill(null)
    .map((_, i) => i),
  array.map(index => new Date(2021, 10, index + 2).getTime())
);

symbols.forEach(symbol => testPeriods({ symbol, periods }));
