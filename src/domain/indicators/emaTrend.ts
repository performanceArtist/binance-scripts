import { makeMarketAPI } from '../../binance';
import {
  makeBinanceHttpClient,
  makeBinanceWebSocketClient
} from 'binance-typescript-api';
import { config } from '../../config';
import { array, either, nonEmptyArray, option, reader } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import {
  generalizeTrend,
  initTrendAcc,
  getHighLows,
  higherHighsHigherLows,
  higherHighsHigherLowsRatio,
  nextExponentialMA,
  Curve,
  nextTrendAcc
} from 'trading-indicators';
import { getExponentialMA, mapInterval } from 'trading-indicators';
import { logObservable } from '../../domain/simulation';
import { observableEither } from 'fp-ts-rxjs';
import {
  getXLastCandles,
  getClosedCurrentCandle
} from '../../domain/trade/market';
import { switchMapEither } from '../../utils/switchMapEither';
import { Candle, IndicatorStreams } from '../../domain/types';
import {
  CandleStreamsParams,
  makeAccStreams,
  makeCandleStreams
} from '../../domain/data';
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray';
import {
  makeSplitCandleStreams,
  SplitCandleStreamsParams
} from '../simulation/data';
import { container } from '@performance-artist/fp-ts-adt';

type EMATrendParams = {
  emaPeriod: number;
  fromCandle: (candle: Candle) => number;
};

export const makeEMATrendAcc = ({ emaPeriod, fromCandle }: EMATrendParams) =>
  makeAccStreams(
    flow(
      array.map(fromCandle),
      getExponentialMA(emaPeriod),
      option.chain(maAcc =>
        pipe(
          initTrendAcc(maAcc),
          option.map(trendAcc => ({ trendAcc, maAcc }))
        )
      ),
      either.fromOption(() => new Error('Failed to build a trend'))
    ),
    (acc, cur) => {
      const nextMA = nextExponentialMA(emaPeriod)(acc.maAcc, fromCandle(cur));
      const nextTrend = nextTrendAcc(acc.trendAcc, nonEmptyArray.last(nextMA));

      return either.right({
        maAcc: nextMA,
        trendAcc: nextTrend
      });
    }
  );

export type CurrentEMATrendParams = EMATrendParams & CandleStreamsParams;

export const getCurrentEMATrend = pipe(
  makeCandleStreams,
  container.map(makeCandleStreams => (params: CurrentEMATrendParams) =>
    pipe(makeCandleStreams(params), makeEMATrendAcc(params))
  )
);

export type SplitEMATrendParams = EMATrendParams & SplitCandleStreamsParams;

export const getSplitEMATrend = pipe(
  makeSplitCandleStreams,
  container.map(makeSplitCandleStreams => (params: SplitEMATrendParams) =>
    pipe(makeSplitCandleStreams(params), makeEMATrendAcc(params))
  )
);

/*
export const makeEMATrendStreams = flow(makeEMATrendAcc, makeEMATrendAcc =>
  flow(
    makeEMATrendAcc,
    (
      acc
    ): IndicatorStreams<
      { trend: NonEmptyArray<Curve>; ma: NonEmptyArray<number> },
      { trend: number; ma: number }
    > => {
      const closed$ = pipe(
        acc.closed$,
        observableEither.map(acc => ({
          trend: acc.trendAcc.result,
          ma: acc.maAcc
        }))
      );

      return {
        closed$,
        currentClosed$: pipe(closed$, observableEither.map(acc => ({ trend: nonEmptyArray.last(acc.trend) }))),
        current$: pipe(
          acc.current$,
          observableEither.map(acc => ({
            trend: 0,
            ma: nonEmptyArray.last(acc.maAcc)
          }))
        )
      };
    }
  )
);
*/
