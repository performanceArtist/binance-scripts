import { pipe } from 'fp-ts/lib/function';
import { getCurrentRSIStreams } from '../../domain/indicators';
import { getBalanceOf, makeSpot } from '../../binance';
import { makeScript } from './make';
import { spotMarketStopLimit } from '../../domain/trade/marketStopLimit';
import { inject } from '../../utils/partial';

export const runScript = pipe(
  makeScript,
  inject('spotMarketStopLimit', spotMarketStopLimit),
  inject('getCurrentRSIStreams', getCurrentRSIStreams),
  inject('getBalance', getBalanceOf),
  inject('spot', makeSpot)
);
