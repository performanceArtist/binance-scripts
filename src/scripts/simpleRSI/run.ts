import { nonEmptyArray, reader } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { makeCandleStreams } from '../../domain/data';
import { makeRSIStreams } from '../../domain/indicators';
import { getBalanceOf, makeSpot } from '../../binance';
import { makeScript, ScriptRSIParams } from './make';
import { spotMarketStopLimit } from '../../domain/trade/marketStopLimit';
import { inject } from '../../utils/partial';

const getRSI = pipe(
  makeCandleStreams,
  reader.map(makeCandleStreams => (params: ScriptRSIParams) =>
    pipe(
      makeCandleStreams(params),
      makeRSIStreams(params.rsiFromCandle, params.period),
      rsi => pipe(rsi.currentClosed$, observableEither.map(nonEmptyArray.last))
    )
  )
);

export const runScript = pipe(
  makeScript,
  inject('spotMarketStopLimit', spotMarketStopLimit),
  inject('getRSI', getRSI),
  inject('getBalance', getBalanceOf),
  inject('spot', makeSpot)
);
