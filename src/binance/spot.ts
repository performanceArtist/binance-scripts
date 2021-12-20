import { TradeController2 } from '../../generated/spot_api.yaml/paths/TradeController';
import { Spot } from '../domain/types';
import { SignQuery, BinanceWebSocketClient } from 'binance-typescript-api';
import { flow, pipe } from 'fp-ts/lib/function';
import { either, option } from 'fp-ts';
import * as rxo from 'rxjs/operators';
import { observableEither } from 'fp-ts-rxjs';
import { Int } from 'io-ts';
import { orderResponseAck } from '../../generated/spot_api.yaml/components/schemas/orderResponseAck';
import { orderResponseResult } from '../../generated/spot_api.yaml/components/schemas/orderResponseResult';
import { orderResponseFull } from '../../generated/spot_api.yaml/components/schemas/orderResponseFull';
import { StreamController2 } from '../../generated/spot_api.yaml/paths/StreamController';
import { makeListenKeyStream } from './listenKey';
import { getFilledOrderInfo, getNewOrderResponse } from './order';
import { pairToString } from '../domain/data/currencyPair';
import { container } from '@performance-artist/fp-ts-adt';

export type SpotDeps = {
  trade: TradeController2<'ObservableEither'>;
  stream: StreamController2<'ObservableEither'>;
  socketClient: BinanceWebSocketClient;
  signQuery: SignQuery;
};

export const makeSpot = pipe(
  container.combine(
    container.create<SpotDeps>()(
      'trade',
      'stream',
      'socketClient',
      'signQuery'
    ),
    getNewOrderResponse
  ),
  container.map(
    ([deps, getNewOrderResponse]): Spot => {
      const { trade, stream, signQuery } = deps;

      const listenKey$ = makeListenKeyStream({
        getKey: flow(
          stream.POST__api_v3_userDataStream,
          observableEither.map(({ listenKey }) => listenKey)
        ),
        putKey: listenKey =>
          stream.PUT__api_v3_userDataStream({
            query: {
              listenKey: option.some(listenKey)
            }
          })
      });

      return {
        marketBuy: ({ symbol, budget }) =>
          pipe(
            trade.POST__api_v3_order({
              query: signQuery({
                symbol: pairToString(symbol),
                type: 'MARKET',
                side: 'BUY',
                timeInForce: option.some('GTC'),
                price: option.none,
                quantity: option.none,
                quoteOrderQty: option.some(budget),
                newClientOrderId: option.none,
                stopPrice: option.none,
                icebergQty: option.none,
                newOrderRespType: option.none,
                recvWindow: option.none
              })
            }),
            rxo.map(either.chain(getMarketOrderInfo))
          ),
        marketSell: ({ symbol, quantity }) =>
          pipe(
            trade.POST__api_v3_order({
              query: signQuery({
                symbol: pairToString(symbol),
                type: 'MARKET',
                side: 'SELL',
                timeInForce: option.some('GTC'),
                price: option.none,
                quantity: option.some(quantity),
                quoteOrderQty: option.none,
                newClientOrderId: option.none,
                stopPrice: option.none,
                icebergQty: option.none,
                newOrderRespType: option.none,
                recvWindow: option.none
              })
            }),
            rxo.map(either.chain(getMarketOrderInfo))
          ),
        limitBuy: ({ symbol, budget, price }) =>
          pipe(
            trade.POST__api_v3_order({
              query: signQuery({
                symbol: pairToString(symbol),
                type: 'LIMIT',
                side: 'BUY',
                timeInForce: option.some('GTC'),
                price: option.some(price),
                quantity: option.some(budget / price),
                quoteOrderQty: option.none,
                newClientOrderId: option.none,
                stopPrice: option.none,
                icebergQty: option.none,
                newOrderRespType: option.none,
                recvWindow: option.none
              })
            }),
            observableEither.map(getNewOrderResponse(listenKey$))
          ),
        limitSell: ({ symbol, quantity, price }) =>
          pipe(
            trade.POST__api_v3_order({
              query: signQuery({
                symbol: pairToString(symbol),
                type: 'LIMIT',
                side: 'SELL',
                timeInForce: option.some('GTC'),
                price: option.some(price),
                quantity: option.some(quantity),
                quoteOrderQty: option.none,
                newClientOrderId: option.none,
                stopPrice: option.none,
                icebergQty: option.none,
                newOrderRespType: option.none,
                recvWindow: option.none
              })
            }),
            observableEither.map(getNewOrderResponse(listenKey$))
          ),
        stopLossLimit: ({ symbol, quantity, stop, limit }) =>
          pipe(
            trade.POST__api_v3_order({
              query: signQuery({
                symbol: pairToString(symbol),
                type: 'STOP_LOSS_LIMIT',
                side: 'SELL',
                timeInForce: option.some('GTC'),
                price: option.some(limit),
                quantity: option.some(quantity),
                quoteOrderQty: option.none,
                newClientOrderId: option.none,
                stopPrice: option.some(stop as Int),
                icebergQty: option.none,
                newOrderRespType: option.none,
                recvWindow: option.none
              })
            }),
            observableEither.map(getNewOrderResponse(listenKey$))
          )
      };
    }
  )
);

const isFullResponse = (
  response: orderResponseAck | orderResponseResult | orderResponseFull
): response is orderResponseFull => Array.isArray((response as any)['fills']);

const getMarketOrderInfo = (
  res: orderResponseAck | orderResponseResult | orderResponseFull
) =>
  pipe(
    res,
    option.fromPredicate(isFullResponse),
    option.map(({ fills }) => getFilledOrderInfo(fills)),
    either.fromOption(
      () => new Error('Failed to calculate market order average')
    )
  );
