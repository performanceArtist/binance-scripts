import { container } from '@performance-artist/fp-ts-adt';
import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { makeMarketAPI } from '../../binance';
import { CurrencyPair } from '../../domain/data/currencyPair';
import {
  makeMockSpot,
  makeSplitCandleStreams,
  SplitCandleStreamsParams
} from '../../domain/simulation';
import { spotMarketStopLimit } from '../../domain/trade/marketStopLimit';
import { makeScript, ScriptParams } from './make';

export type SimulationParams = {
  symbol: CurrencyPair;
  splitStreams: Omit<SplitCandleStreamsParams, 'symbol'>;
  script: Omit<ScriptParams, 'symbol' | 'candleStreams'>;
};

export const makeTestScript = pipe(
  makeSplitCandleStreams,
  container.map(makeSplitCandleStreams => (params: SimulationParams) => {
    const streams = makeSplitCandleStreams({
      symbol: params.symbol,
      ...params.splitStreams
    });
    const price$ = pipe(
      streams.current$,
      observableEither.map(candle => candle.low)
    );
    const { spot, action$ } = makeMockSpot({ price$ });

    const script = pipe(
      makeScript,
      container.base,
      container.inject('spotMarketStopLimit', spotMarketStopLimit),
      container.inject(
        'getBalance',
        container.of((asset: string) => observableEither.of(1000))
      ),
      container.inject('spot', container.of(spot)),
      container.resolve
    )({})({
      symbol: params.symbol,
      candleStreams: streams,
      ...params.script
    });

    return { ...script, action$ };
  }),
  container.base,
  container.inject('market', makeMarketAPI),
  container.resolve
);
