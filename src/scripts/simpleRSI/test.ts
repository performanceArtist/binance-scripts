import { reader } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { CurrencyPair } from '../../domain/data/currencyPair';
import {
  makeMockSpot,
  makeSplitCandleStreams,
  SplitCandleStreamsParams
} from '../../domain/simulation';
import { spotMarketStopLimit } from '../../domain/trade/marketStopLimit';
import { inject } from '../../utils/partial';
import { makeScript, ScriptParams } from './make';

export type SimulationParams = {
  symbol: CurrencyPair;
  splitStreams: Omit<SplitCandleStreamsParams, 'symbol'>;
  script: Omit<ScriptParams, 'symbol' | 'candleStreams'>;
};

export const makeTestScript = pipe(
  makeScript,
  inject('spotMarketStopLimit', spotMarketStopLimit),
  inject('getBalance', () => (asset: string) => observableEither.of(1000)),
  makeScript =>
    pipe(
      makeSplitCandleStreams,
      reader.map(makeSplitCandleStreams => (params: SimulationParams) => {
        const streams = makeSplitCandleStreams({
          symbol: params.symbol,
          ...params.splitStreams
        });
        const price$ = pipe(
          streams.current$,
          observableEither.map(candle => candle.low)
        );
        const { spot, action$ } = makeMockSpot({ price$ });

        const script = makeScript({
          spot
        })({ symbol: params.symbol, candleStreams: streams, ...params.script });

        return { ...script, action$ };
      })
    )
);
