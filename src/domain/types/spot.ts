import { CurrencyPair } from '../data/currencyPair';
import { MarketOrderFill, OrderResponse } from './order';
import { ObservableEither } from './shared';

export type Spot = {
  marketBuy: (params: {
    symbol: CurrencyPair;
    budget: number;
  }) => ObservableEither<Error, MarketOrderFill>;
  marketSell: (params: {
    symbol: CurrencyPair;
    quantity: number;
  }) => ObservableEither<Error, MarketOrderFill>;
  limitBuy: (params: {
    symbol: CurrencyPair;
    budget: number;
    price: number;
  }) => ObservableEither<Error, OrderResponse>;
  limitSell: (params: {
    symbol: CurrencyPair;
    quantity: number;
    price: number;
  }) => ObservableEither<Error, OrderResponse>;
  stopLossLimit: (params: {
    symbol: CurrencyPair;
    quantity: number;
    stop: number;
    limit: number;
  }) => ObservableEither<Error, OrderResponse>;
};
