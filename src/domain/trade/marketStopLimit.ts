import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { ObservableEither, Spot, StopLossOrder } from '../types';
import { switchMapEither } from '../../utils/switchMapEither';
import { CurrencyPair } from '../data/currencyPair';
import { container } from '@performance-artist/fp-ts-adt';

export type MarketStopLimitParams = {
  symbol: CurrencyPair;
  getBudget: (balance: number) => number;
  getStop: (price: number) => { stop: number; limit: number };
};

export type SpotMarketStopLimit = (
  params: MarketStopLimitParams
) => ObservableEither<Error, StopLossOrder>;

export const spotMarketStopLimit = pipe(
  container.create<{
    spot: Spot;
    getBalance: (asset: string) => ObservableEither<Error, number>;
  }>()('spot', 'getBalance'),
  container.map(
    ({ spot, getBalance }): SpotMarketStopLimit => ({
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
      )
  )
);
