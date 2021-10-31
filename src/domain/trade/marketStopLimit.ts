import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { ObservableEither, Spot, StopLossOrder } from '../types';
import { switchMapEither } from '../../utils/switchMapEither';
import { CurrencyPair } from '../data/currencyPair';

export type MarketStopLimitParams = {
  symbol: CurrencyPair;
  getBudget: (balance: number) => number;
  getStop: (price: number) => { stop: number; limit: number };
};

export const spotMarketStopLimit = ({
  spot,
  getBalance
}: {
  spot: Spot;
  getBalance: (asset: string) => ObservableEither<Error, number>;
}) => ({
  symbol,
  getBudget,
  getStop
}: MarketStopLimitParams): ObservableEither<Error, StopLossOrder> =>
  pipe(
    getBalance(symbol.base),
    observableEither.map(getBudget),
    switchMapEither(budget => spot.marketBuy({ symbol, budget })),
    switchMapEither(({ quantity, averagePrice }) =>
      pipe(
        spot.stopLossLimit({
          symbol,
          quantity,
          ...getStop(averagePrice)
        }),
        observableEither.map(res => ({
          price: averagePrice,
          quantity,
          ...res,
          ...getStop(averagePrice)
        }))
      )
    )
  );

export type SpotMarketStopLimit = ReturnType<typeof spotMarketStopLimit>;
