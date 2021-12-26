import { container } from '@performance-artist/fp-ts-adt';
import { pipe } from 'fp-ts/lib/function';
import { CandleStreamsParams, makeCandleStreams } from '../../domain/data';
import { makeScript, ScriptParams } from './make';

export const runScript = pipe(
  container.combine(makeScript, makeCandleStreams),
  container.map(
    ([makeScript, makeCandleStreams]) => (
      params: Omit<ScriptParams, 'candleStreams'> & CandleStreamsParams
    ) => makeScript({ ...params, candleStreams: makeCandleStreams(params) })
  ),
  container.base,
  container.resolve
);
