import { pipe } from 'fp-ts/lib/function';
import { getBalanceOf, makeMarketAPI, makeSpot } from '../../binance';
import { makeScript, ScriptParams } from './make';
import {
  spotMarketStopLimit,
  CandleStreamsParams,
  makeCandleStreams
} from 'trading-indicators-streams';
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
  container.inject('getBalance', getBalanceOf),
  container.inject('spot', makeSpot),
  container.inject('market', makeMarketAPI),
  container.resolve
);
