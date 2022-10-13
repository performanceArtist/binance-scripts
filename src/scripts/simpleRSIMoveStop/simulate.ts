import { observableEither } from 'fp-ts-rxjs';
import {
  CurrencyPair,
  makeSplitCandleStreams,
  SplitCandleStreamsParams,
  movingStopLossFromCandles,
  spotMarketStopLimit,
  GetClosedCurrentCandle,
  Interval,
  makeMockSpot
} from 'trading-indicators-streams';
import { makeScript, ScriptParams } from './make';
import { pipe } from 'fp-ts/lib/function';
import { container, selector } from '@performance-artist/fp-ts-adt';
import { makeMarketAPI } from '../../binance';

export type SimulationParams = {
  symbol: CurrencyPair;
  interval: Interval;
  splitStreams: Omit<SplitCandleStreamsParams, 'symbol' | 'interval'>;
  script: Omit<ScriptParams, 'symbol' | 'candleStreams'>;
};

export const makeTestScript = pipe(
  makeSplitCandleStreams,
  container.map(makeSplitCandleStreams => (params: SimulationParams) => {
    const getStreams = pipe(
      selector.keys<{ symbol: CurrencyPair; interval: Interval }>()(
        'symbol',
        'interval'
      ),
      selector.map(rest =>
        makeSplitCandleStreams({ ...params.splitStreams, ...rest })
      )
    );

    const { spot, action$ } = makeMockSpot({
      getCurrentPrice: symbol =>
        pipe(
          getStreams.run({ symbol, interval: params.interval }).current$,
          observableEither.map(candle => candle.low)
        )
    });

    const script = pipe(
      makeScript,
      container.base,
      container.inject('spotMarketStopLimit', spotMarketStopLimit),
      container.inject('movingStopLossFromCandles', movingStopLossFromCandles),
      container.inject(
        'getBalance',
        container.of((asset: string) => observableEither.of(1000))
      ),
      container.inject('spot', container.of(spot)),
      container.inject(
        'getClosedCurrentCandle',
        container.of<GetClosedCurrentCandle>(
          ({ symbol, interval }) =>
            getStreams.run({ symbol, interval }).currentClosed$
        )
      ),
      container.resolve
    )({})({
      symbol: params.symbol,
      candleStreams: getStreams.run({
        symbol: params.symbol,
        interval: params.interval
      }),
      ...params.script
    });

    return { ...script, action$ };
  }),
  container.base,
  container.inject('market', makeMarketAPI),
  container.resolve
);
