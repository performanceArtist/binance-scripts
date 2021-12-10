import { makeScript } from './make';
import { pipe } from 'fp-ts/lib/function';
import { movingStopLossFromCandles } from '../../domain/trade/movingStopLimit';
import { spotMarketStopLimit } from '../../domain/trade/marketStopLimit';
import { getBalanceOf, makeSpot } from '../../binance';
import { getCurrentRSIStreams } from '../../domain/indicators';
import { getClosedCurrentCandle } from '../../domain/trade/market';
import { inject } from '../../utils/partial';

export const runScript = pipe(
  makeScript,
  inject('spotMarketStopLimit', spotMarketStopLimit),
  inject('movingStopLossFromCandles', movingStopLossFromCandles),
  inject('getBalance', getBalanceOf),
  inject('getCurrentRSIStreams', getCurrentRSIStreams),
  inject('getClosedCurrentCandle', getClosedCurrentCandle),
  inject('spot', makeSpot)
);
