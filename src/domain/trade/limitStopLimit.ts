import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { ObservableEither, Spot, StopLossOrder } from '../types';
import { switchMapEither } from '../../utils/switchMapEither';
import { CurrencyPair } from '../data/currencyPair';
import { IsolatedMargin } from '../types/margin';

export type LimitStopLimitParams = {
  symbol: CurrencyPair;
  price: number;
  getBudget: (balance: number) => number;
  getStop: (price: number) => { stop: number; limit: number };
};

export const makeSpotLimitStopLimit = ({
  spot,
  getBalance
}: {
  spot: Spot;
  getBalance: (asset: string) => ObservableEither<Error, number>;
}) => ({
  symbol,
  price,
  getBudget,
  getStop
}: LimitStopLimitParams): ObservableEither<Error, StopLossOrder> =>
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
  );

export type MarginLimitStopLimitParams = {
  symbol: CurrencyPair;
  price: number;
  multiplier: number;
  getBudget: (balance: number) => number;
  getStop: (price: number) => { stop: number; limit: number };
};

export const makeMarginLimitStopLimit = ({
  margin,
  getBalance
}: {
  margin: IsolatedMargin;
  getBalance: (asset: string) => ObservableEither<Error, number>;
}) => ({
  symbol,
  price,
  multiplier,
  getBudget,
  getStop
}: MarginLimitStopLimitParams): ObservableEither<Error, StopLossOrder> =>
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
  );
