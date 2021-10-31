import { observableEither } from 'fp-ts-rxjs';
import { makeScript, ScriptRSIParams } from './make';
import { pipe } from 'fp-ts/lib/function';
import { nonEmptyArray, reader } from 'fp-ts';
import { movingStopLossFromCandles } from '../../domain/trade/movingStopLimit';
import { spotMarketStopLimit } from '../../domain/trade/marketStopLimit';
import { getBalanceOf, makeSpot } from '../../binance';
import { makeCandleStreams } from '../../domain/data';
import { makeRSIStreams } from '../../domain/indicators';
import { getClosedCurrentCandle } from '../../domain/trade/market';
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
  inject('movingStopLossFromCandles', movingStopLossFromCandles), // first level ends
  inject('getBalance', getBalanceOf),
  inject('getRSI', getRSI),
  inject('getClosedCurrentCandle', getClosedCurrentCandle), // second level ends
  inject('spot', makeSpot)
);

/*
export const runScript = pipe(
  readerUtils.combine(
    readerUtils.defer(
      makeScript,
      'movingStopLossFromCandles',
      'spotMarketStopLimit'
    ),
    movingStopLossFromCandles,
    spotMarketStopLimit
  ),
  reader.map(([makeScript, movingStopLossFromCandles, spotMarketStopLimit]) =>
    makeScript({ movingStopLossFromCandles, spotMarketStopLimit })
  ),
  withImplementation =>
    pipe(
      readerUtils.combine(
        readerUtils.defer(
          withImplementation,
          'getBalance',
          'getClosedCurrentCandle',
          'getRSI'
        ),
        getBalanceOf,
        getClosedCurrentCandle,
        getRSI
      ),
      reader.map(
        ([withImplementation, getBalance, getClosedCurrentCandle, getRSI]) =>
          withImplementation({
            getBalance,
            getClosedCurrentCandle,
            getRSI
          })
      )
    ),
  withData =>
    pipe(
      readerUtils.combine(readerUtils.defer(withData, 'spot'), makeSpot),
      reader.map(([withData, spot]) => withData({ spot }))
    )
);
*/
