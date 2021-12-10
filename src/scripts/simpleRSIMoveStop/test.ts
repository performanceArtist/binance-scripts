import { observableEither } from 'fp-ts-rxjs';
import { CurrencyPair } from '../../domain/data/currencyPair';
import {
  makeMockSpot,
  makeSplitCandleStreams,
  SplitCandleStreamsParams
} from '../../domain/simulation';
import { makeScript, ScriptParams } from './make';
import { pipe } from 'fp-ts/lib/function';
import { reader } from 'fp-ts';
import { movingStopLossFromCandles } from '../../domain/trade/movingStopLimit';
import { spotMarketStopLimit } from '../../domain/trade/marketStopLimit';
import { makeRSIStreams } from '../../domain/indicators';
import { inject } from '../../utils/partial';

export type SimulationParams = {
  symbol: CurrencyPair;
  splitStreams: Omit<SplitCandleStreamsParams, 'symbol'>;
  script: Omit<ScriptParams, 'symbol'>;
};

export const makeTestScript = pipe(
  makeScript,
  inject('spotMarketStopLimit', spotMarketStopLimit),
  inject('movingStopLossFromCandles', movingStopLossFromCandles),
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
          getClosedCurrentCandle: () => streams.currentClosed$,
          getCurrentRSIStreams: params => pipe(streams, makeRSIStreams(params)),
          spot
        })({ symbol: params.symbol, ...params.script });

        return { ...script, action$ };
      })
    )
);
