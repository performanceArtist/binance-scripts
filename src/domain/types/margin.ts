import { ObservableEither, OrderResponse } from '.';
import { CurrencyPair, CurrencyType } from '../data/currencyPair';
import { MarketOrderFill } from './order';

export type IsolatedMargin = {
  put: (params: {
    symbol: CurrencyPair;
    asset: CurrencyType;
    amount: number;
  }) => ObservableEither<Error, unknown>;
  take: (params: {
    symbol: CurrencyPair;
    asset: CurrencyType;
    amount: number;
  }) => ObservableEither<Error, unknown>;
  marketBuy: (params: {
    symbol: CurrencyPair;
    budget: number;
    multiplier: number;
  }) => ObservableEither<Error, MarketOrderFill>;
  marketSell: (params: {
    symbol: CurrencyPair;
    budget: number;
    multiplier: number;
  }) => ObservableEither<Error, MarketOrderFill>;
  limitBuy: (params: {
    symbol: CurrencyPair;
    price: number;
    budget: number;
    multiplier: number;
  }) => ObservableEither<Error, OrderResponse>;
  limitSell: (params: {
    symbol: CurrencyPair;
    price: number;
    budget: number;
    multiplier: number;
  }) => ObservableEither<Error, OrderResponse>;
  stopLossLimit: (params: {
    symbol: CurrencyPair;
    quantity: number;
    stop: number;
    limit: number;
    side: 'BUY' | 'SELL';
  }) => ObservableEither<Error, OrderResponse>;
};
