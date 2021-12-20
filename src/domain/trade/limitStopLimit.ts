import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { ObservableEither, Spot, StopLossOrder } from '../types';
import { switchMapEither } from '../../utils/switchMapEither';
import { CurrencyPair } from '../data/currencyPair';
import { IsolatedMargin } from '../types/margin';
import { container } from '@performance-artist/fp-ts-adt';

export type LimitStopLimitParams = {
  symbol: CurrencyPair;
  price: number;
  getBudget: (balance: number) => number;
  getStop: (price: number) => { stop: number; limit: number };
};

export type SpotLimitStopLimit = (
  params: LimitStopLimitParams
) => ObservableEither<Error, StopLossOrder>;

export const makeSpotLimitStopLimit = pipe(
  container.create<{
    spot: Spot;
    getBalance: (asset: string) => ObservableEither<Error, number>;
  }>()('spot', 'getBalance'),
  container.map(
    ({ spot, getBalance }): SpotLimitStopLimit => ({
      symbol,
      price,
      getBudget,
      getStop
    }) =>
      pipe(
        getBalance(symbol.base),
        observableEither.map(getBudget),
        switchMapEither(budget => spot.limitBuy({ symbol, budget, price })),
        switchMapEither(res => res.filled$),
        observableEither.chain(({ price, quantity }) =>
          pipe(
            spot.stopLossLimit({
              symbol,
              quantity,
              ...getStop(price)
            }),
            observableEither.map(order => ({
              price,
              quantity,
              ...order,
              ...getStop(price)
            }))
          )
        )
      )
  )
);

export type MarginLimitStopLimitParams = {
  symbol: CurrencyPair;
  price: number;
  multiplier: number;
  getBudget: (balance: number) => number;
  getStop: (price: number) => { stop: number; limit: number };
};

export type MarginLimitStopLimit = (
  params: MarginLimitStopLimitParams
) => ObservableEither<Error, StopLossOrder>;

export const makeMarginLimitStopLimit = pipe(
  container.create<{
    margin: IsolatedMargin;
    getBalance: (asset: string) => ObservableEither<Error, number>;
  }>()('margin', 'getBalance'),
  container.map(
    ({ margin, getBalance }): MarginLimitStopLimit => ({
      symbol,
      price,
      multiplier,
      getBudget,
      getStop
    }) =>
      pipe(
        getBalance(symbol.base),
        observableEither.map(getBudget),
        switchMapEither(budget =>
          margin.limitBuy({ symbol, budget, price, multiplier })
        ),
        switchMapEither(res => res.filled$),
        observableEither.chain(({ price, quantity }) =>
          pipe(
            margin.stopLossLimit({
              symbol,
              side: 'SELL',
              quantity,
              ...getStop(price)
            }),
            observableEither.map(order => ({
              price,
              quantity,
              ...order,
              ...getStop(price)
            }))
          )
        )
      )
  )
);
