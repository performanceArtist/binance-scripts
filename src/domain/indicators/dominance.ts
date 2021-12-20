import { array, reader } from 'fp-ts';
import { flow, pipe } from 'fp-ts/lib/function';
import { getDominance } from 'trading-indicators';
import { Interval } from '../types';
import { observableEither } from 'fp-ts-rxjs';
import { sequenceT } from 'fp-ts/lib/Apply';
import { intervalTimestamps } from '../utils';
import { CurrencyPair } from '../data/currencyPair';
import { partialf } from '../../utils/partial';
import { getXCandles } from '../trade/market';
import { container } from '@performance-artist/fp-ts-adt';

export const makeGetDominance = pipe(
  getXCandles,
  container.map(
    getXCandles => ({
      symbol,
      baseSymbol,
      interval,
      startTime,
      candleTotal
    }: {
      interval: Interval;
      startTime: number;
      symbol: CurrencyPair;
      baseSymbol: CurrencyPair;
      candleTotal: number;
    }) =>
      pipe(
        sequenceT(observableEither.observableEither)(
          getXCandles({
            symbol: baseSymbol,
            total: candleTotal,
            interval,
            startTime
          }),
          getXCandles({
            symbol,
            total: candleTotal,
            interval,
            startTime
          })
        ),
        observableEither.map(([btc, derived]) => getDominance(btc, derived))
      )
  )
);

export const makeGetBTCDominance = pipe(
  makeGetDominance,
  container.map(partialf({ baseSymbol: { base: 'BTC', quote: 'USDT' } }))
);

export const makeGetAverageDominance = pipe(
  makeGetDominance,
  container.map(
    makeGetDominance => ({
      symbol,
      baseSymbol,
      interval,
      repeat,
      startTime,
      candleTotal
    }: {
      interval: Interval;
      startTime: number;
      candleTotal: number;
      repeat: number;
      symbol: CurrencyPair;
      baseSymbol: CurrencyPair;
    }) =>
      pipe(
        [...Array(repeat).keys()],
        array.traverse(observableEither.observableEither)(period =>
          makeGetDominance({
            symbol,
            baseSymbol,
            interval,
            startTime: startTime + period * 1000 * intervalTimestamps[interval],
            candleTotal
          })
        ),
        observableEither.map(results =>
          pipe(
            results,
            array.reduce(0, (acc, cur) => acc + cur),
            sum => sum / results.length
          )
        )
      )
  )
);

export const makeGetAverageBTCDominance = pipe(
  makeGetAverageDominance,
  container.map(partialf({ baseSymbol: { base: 'BTC', quote: 'USDT' } }))
);
