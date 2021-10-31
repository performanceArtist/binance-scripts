import { CurrentCandle } from '.';
import { CurrencyPair } from '../data/currencyPair';
import { Candle, Interval, ObservableEither } from './shared';

export type MarketAPI = {
  getCandles: (params: {
    symbol: CurrencyPair;
    interval: Interval;
    startTime: number;
    endTime: number;
    limit: number;
  }) => ObservableEither<Error, Candle[]>;
  getCurrentCandle: (params: {
    symbol: CurrencyPair;
    interval: Interval;
  }) => ObservableEither<Error, CurrentCandle>;
};
