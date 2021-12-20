import { pipe } from 'fp-ts/lib/function';
import { getBalanceOf, makeSpot } from '../../binance';
import { makeScript } from './make';
import { spotMarketStopLimit } from '../../domain/trade/marketStopLimit';
import { container } from '@performance-artist/fp-ts-adt';

export const runScript = pipe(
  makeScript,
  container.base,
  container.inject('spotMarketStopLimit', spotMarketStopLimit),
  container.inject('getBalance', getBalanceOf),
  container.inject('spot', makeSpot),
  container.resolve
);
