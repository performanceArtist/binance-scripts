import { makeScript, ScriptParams } from './make';
import { pipe } from 'fp-ts/lib/function';
import {
  movingStopLossFromCandles,
  spotMarketStopLimit,
  getClosedCurrentCandle,
  CandleStreamsParams,
  makeCandleStreams
} from 'trading-indicators-streams';
import { getBalanceOf, makeMarketAPI, makeSpot } from '../../binance';
import { container } from '@performance-artist/fp-ts-adt';

export const runScript = pipe(
  container.combine(makeScript, makeCandleStreams),
  container.map(
    ([makeScript, makeCandleStreams]) => (
      params: Omit<ScriptParams, 'candleStreams'> & CandleStreamsParams
    ) => makeScript({ ...params, candleStreams: makeCandleStreams(params) })
  ),
  container.base,
  container.inject('spotMarketStopLimit', spotMarketStopLimit),
  container.inject('movingStopLossFromCandles', movingStopLossFromCandles),
  container.inject('getBalance', getBalanceOf),
  container.inject('getClosedCurrentCandle', getClosedCurrentCandle),
  container.inject('spot', makeSpot),
  container.inject('market', makeMarketAPI),
  container.resolve
);
