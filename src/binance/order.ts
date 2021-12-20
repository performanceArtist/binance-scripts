import { container } from '@performance-artist/fp-ts-adt';
import { SignQuery } from 'binance-typescript-api';
import { option } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import { Int } from 'io-ts';
import { TradeController2 } from '../../generated/spot_api.yaml/paths/TradeController';
import { ObservableEither, OrderResponse } from '../domain/types';
import { getOrderPrice } from './userData';

export const getNewOrderResponse = pipe(
  container.combine(
    container.create<{
      trade: TradeController2<'ObservableEither'>;
      signQuery: SignQuery;
    }>()('trade', 'signQuery'),
    getOrderPrice
  ),
  container.map(([deps, getOrderPrice]) => {
    const { trade, signQuery } = deps;

    return (listenKey$: ObservableEither<Error, string>) => (response: {
      symbol: string;
      orderId: Int;
    }): OrderResponse => ({
      cancel: () =>
        pipe(
          trade.DELETE__api_v3_order({
            query: signQuery({
              symbol: response.symbol,
              orderId: option.some(response.orderId),
              origClientOrderId: option.none,
              newClientOrderId: option.none,
              recvWindow: option.none
            })
          }),
          observableEither.map(() => undefined)
        ),
      filled$: getOrderPrice(listenKey$)(response.orderId)
    });
  })
);

export const getFilledOrderInfo = (
  fills: Array<{ price: string; qty: string }>
) => {
  const quantity = fills.reduce((acc, cur) => acc + parseFloat(cur.qty), 0);
  const averagePrice =
    fills.reduce(
      (acc, cur) => acc + parseFloat(cur.price) * parseFloat(cur.qty),
      0
    ) /
    (quantity / (fills.length + 1));

  return { quantity, averagePrice };
};
