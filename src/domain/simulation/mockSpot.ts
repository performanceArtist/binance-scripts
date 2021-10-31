import { LimitOrderAction, ObservableEither, Spot, SpotAction } from '../types';
import * as rx from 'rxjs';
import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import { either } from 'fp-ts';

export type MockSpotParams = {
  price$: ObservableEither<Error, number>;
};

export const makeMockSpot = (params: MockSpotParams) => {
  const actionEvent = new rx.Subject<SpotAction>();
  const { price$ } = params;
  let pendingOrderIds: number[] = [];

  const getLimitFilled = (action: LimitOrderAction) => {
    switch (action.type) {
      case 'STOP_LOSS_LIMIT': {
        const { stop, limit, quantity } = action;

        return pipe(
          price$,
          rxo.filter(either.exists(price => price < stop)),
          observableEither.map(() => ({ price: limit, quantity }))
        );
      }
      case 'LIMIT_ORDER': {
        switch (action.side) {
          case 'BUY': {
            return pipe(
              price$,
              rxo.filter(either.exists(price => price < action.price)),
              observableEither.map(() => ({
                price: action.price,
                quantity: action.quantity
              }))
            );
          }
          case 'SELL': {
            return pipe(
              price$,
              rxo.filter(either.exists(price => price > action.price)),
              observableEither.map(() => ({
                price: action.price,
                quantity: action.quantity
              }))
            );
          }
        }
      }
    }
  };

  const spot: Spot = {
    marketBuy: ({ symbol, budget }) =>
      pipe(
        price$,
        rxo.take(1),
        observableEither.map(price => {
          actionEvent.next({
            type: 'MARKET_ORDER',
            symbol,
            side: 'BUY',
            price,
            quantity: budget / price
          });

          return { averagePrice: price, quantity: budget / price };
        })
      ),
    marketSell: ({ symbol, quantity }) =>
      pipe(
        price$,
        rxo.take(1),
        observableEither.map(price => {
          actionEvent.next({
            type: 'MARKET_ORDER',
            symbol,
            side: 'SELL',
            price,
            quantity
          });

          return { averagePrice: price, quantity };
        })
      ),
    limitBuy: ({ symbol, budget, price }) => {
      const openAction: LimitOrderAction = {
        type: 'LIMIT_ORDER',
        symbol,
        side: 'BUY',
        price,
        equity: budget,
        quantity: budget / price
      };

      const orderId = Date.now();
      pendingOrderIds = pendingOrderIds.concat(orderId);
      actionEvent.next(openAction);

      return observableEither.of({
        cancel: () => {
          actionEvent.next({
            type: 'CANCELLED_STOP_LIMIT',
            symbol,
            price,
            quantity: budget / price
          });
          pendingOrderIds = pendingOrderIds.filter(id => id !== orderId);

          return observableEither.of(undefined);
        },
        filled$: pipe(
          getLimitFilled(openAction),
          rxo.filter(either.exists(() => pendingOrderIds.includes(orderId))),
          observableEither.map(filled => {
            actionEvent.next({ type: 'FILLED_LIMIT', side: 'BUY', ...filled });
            pendingOrderIds = pendingOrderIds.filter(id => id !== orderId);
            return filled;
          }),
          rxo.shareReplay(1)
        )
      });
    },
    limitSell: ({ symbol, quantity, price }) => {
      const openAction: LimitOrderAction = {
        type: 'LIMIT_ORDER',
        symbol,
        side: 'SELL',
        price,
        quantity,
        equity: quantity * price
      };

      const orderId = Date.now();
      pendingOrderIds = pendingOrderIds.concat(orderId);
      actionEvent.next(openAction);

      return observableEither.of({
        cancel: () => {
          actionEvent.next({
            type: 'CANCELLED_STOP_LIMIT',
            symbol,
            price,
            quantity
          });
          pendingOrderIds = pendingOrderIds.filter(id => id !== orderId);

          return observableEither.of(undefined);
        },
        filled$: pipe(
          getLimitFilled(openAction),
          rxo.filter(either.exists(() => pendingOrderIds.includes(orderId))),
          observableEither.map(filled => {
            actionEvent.next({ type: 'FILLED_LIMIT', side: 'SELL', ...filled });
            pendingOrderIds = pendingOrderIds.filter(id => id !== orderId);
            return filled;
          }),
          rxo.shareReplay(1)
        )
      });
    },
    stopLossLimit: ({ symbol, stop, limit, quantity }) => {
      const openAction: LimitOrderAction = {
        type: 'STOP_LOSS_LIMIT',
        symbol,
        stop,
        limit,
        quantity
      };
      const orderId = Date.now();
      pendingOrderIds = pendingOrderIds.concat(orderId);
      actionEvent.next(openAction);

      return observableEither.of({
        cancel: () => {
          actionEvent.next({
            type: 'CANCELLED_STOP_LOSS_LIMIT',
            symbol,
            stop,
            limit,
            quantity
          });
          pendingOrderIds = pendingOrderIds.filter(id => id !== orderId);

          return observableEither.of(undefined);
        },
        filled$: pipe(
          getLimitFilled(openAction),
          rxo.filter(either.exists(() => pendingOrderIds.includes(orderId))),
          observableEither.map(filled => {
            actionEvent.next({ type: 'FILLED_STOP_LOSS_LIMIT', ...filled });
            pendingOrderIds = pendingOrderIds.filter(id => id !== orderId);
            return filled;
          }),
          rxo.shareReplay(1)
        )
      });
    }
  };

  return { action$: actionEvent.asObservable(), spot };
};
