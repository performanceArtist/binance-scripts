import { observableEither } from 'fp-ts-rxjs';
import { CurrencyPair } from '../../domain/data/currencyPair';
import {
  makeMockSpot,
  makeSplitCandleStreams,
  SplitCandleStreamsParams
} from '../../domain/simulation';
import { makeScript, ScriptParams } from './make';
import { pipe } from 'fp-ts/lib/function';
import { container, selector } from '@performance-artist/fp-ts-adt';
import { makeMarketAPI } from '../../binance';
import { Interval } from '../../domain/types';

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

    const script = pipe(makeScript, container.base, container.resolve)({})({
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
