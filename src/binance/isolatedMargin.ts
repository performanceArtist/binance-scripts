import { MarginController2 } from '../../generated/spot_api.yaml/paths/MarginController';
import { IsolatedMarginStreamController2 } from '../../generated/spot_api.yaml/paths/IsolatedMarginStreamController';
import { BinanceWebSocketClient, SignQuery } from 'binance-typescript-api';
import { either, option } from 'fp-ts';
import { transFrom } from '../../generated/spot_api.yaml/components/parameters/transFrom';
import { transTo } from '../../generated/spot_api.yaml/components/parameters/transTo';
import { partial } from '../utils/partial';
import { flow, pipe } from 'fp-ts/lib/function';
import { switchMapEither } from '../utils/switchMapEither';
import { observableEither } from 'fp-ts-rxjs';
import { makeListenKeyStream } from './listenKey';
import { getFilledOrderInfo, getNewOrderResponse } from './order';
import { TradeController2 } from '../../generated/spot_api.yaml/paths/TradeController';
import { IsolatedMargin } from '../domain/types/margin';
import {
  CurrencyPair,
  CurrencyType,
  pairToString
} from '../domain/data/currencyPair';
import { marginOrderResponseFull } from '../../generated/spot_api.yaml/components/schemas/marginOrderResponseFull';
import { marginOrderResponseResult } from '../../generated/spot_api.yaml/components/schemas/marginOrderResponseResult';
import { marginOrderResponseAck } from '../../generated/spot_api.yaml/components/schemas/marginOrderResponseAck';
import * as rxo from 'rxjs/operators';
import { container } from '@performance-artist/fp-ts-adt';

type IsolatedMarginDeps = {
  margin: MarginController2<'ObservableEither'>;
  trade: TradeController2<'ObservableEither'>;
  isolatedMargin: IsolatedMarginStreamController2<'ObservableEither'>;
  socketClient: BinanceWebSocketClient;
  signQuery: SignQuery;
};

export const makeIsolatedMargin = pipe(
  container.combine(
    container.create<IsolatedMarginDeps>()(
      'margin',
      'trade',
      'isolatedMargin',
      'socketClient',
      'signQuery'
    ),
    getNewOrderResponse
  ),
  container.map(
    ([deps, getNewOrderResponse]): IsolatedMargin => {
      const { margin, isolatedMargin, signQuery } = deps;

      const listenKey$ = makeListenKeyStream({
        getKey: flow(
          isolatedMargin.POST__sapi_v1_userDataStream_isolated,
          observableEither.map(({ listenKey }) => listenKey)
        ),
        putKey: listenKey =>
          isolatedMargin.PUT__sapi_v1_userDataStream_isolated({
            query: {
              listenKey: option.some(listenKey)
            }
          })
      });

      const transfer = ({
        asset,
        symbol,
        amount,
        from,
        to
      }: {
        symbol: CurrencyPair;
        asset: CurrencyType;
        amount: number;
        from: transFrom;
        to: transTo;
      }) =>
        margin.POST__sapi_v1_margin_isolated_transfer({
          query: signQuery({
            asset: symbol[asset],
            symbol: pairToString(symbol),
            amount,
            transFrom: option.some(from),
            transTo: option.some(to),
            recvWindow: option.none
          })
        });

      const borrow = ({
        asset,
        symbol,
        amount
      }: {
        asset: string;
        symbol: string;
        amount: number;
      }) =>
        margin.POST__sapi_v1_margin_loan({
          query: signQuery({
            asset,
            symbol: option.some(symbol),
            isIsolated: option.some('TRUE'),
            amount,
            recvWindow: option.none
          })
        });

      const repay = ({
        asset,
        symbol,
        amount
      }: {
        asset: string;
        symbol: string;
        amount: number;
      }) =>
        margin.POST__sapi_v1_margin_repay({
          query: signQuery({
            asset,
            symbol: option.some(symbol),
            isIsolated: option.some('TRUE'),
            amount,
            recvWindow: option.none
          })
        });

      return {
        put: partial(transfer)({ from: 'SPOT', to: 'ISOLATED_MARGIN' }),
        take: partial(transfer)({ from: 'ISOLATED_MARGIN', to: 'SPOT' }),
        marketBuy: ({ symbol, budget, multiplier }) =>
          pipe(
            borrow({
              asset: symbol.quote,
              symbol: pairToString(symbol),
              amount: budget * (multiplier - 1)
            }),
            switchMapEither(() =>
              margin.POST__sapi_v1_margin_order({
                query: signQuery({
                  symbol: pairToString(symbol),
                  isIsolated: option.some('TRUE'),
                  side: 'BUY',
                  type: 'MARKET',
                  sideEffectType: option.some('NO_SIDE_EFFECT'),
                  timeInForce: option.some('GTC'),
                  price: option.none,
                  quantity: 0,
                  quoteOrderQty: option.some(budget * multiplier),
                  newClientOrderId: option.none,
                  stopPrice: option.none,
                  icebergQty: option.none,
                  newOrderRespType: option.some('FULL'),
                  recvWindow: option.none
                })
              })
            ),
            rxo.map(either.chain(getMarketOrderInfo))
          ),
        marketSell: ({ symbol, budget, multiplier }) =>
          pipe(
            borrow({
              asset: symbol.base,
              symbol: pairToString(symbol),
              amount: budget * (multiplier - 1)
            }),
            switchMapEither(() =>
              margin.POST__sapi_v1_margin_order({
                query: signQuery({
                  symbol: pairToString(symbol),
                  isIsolated: option.some('TRUE'),
                  side: 'SELL',
                  type: 'MARKET',
                  sideEffectType: option.some('NO_SIDE_EFFECT'),
                  timeInForce: option.some('GTC'),
                  price: option.none,
                  quantity: budget * multiplier,
                  quoteOrderQty: option.none,
                  newClientOrderId: option.none,
                  stopPrice: option.none,
                  icebergQty: option.none,
                  newOrderRespType: option.none,
                  recvWindow: option.none
                })
              })
            ),
            rxo.map(either.chain(getMarketOrderInfo))
          ),
        limitBuy: null as any /*({ symbol, price, budget, multiplier }) =>
      pipe(
        borrow({
          asset: symbol.quote,
          symbol: pairToString(symbol),
          amount: budget * (multiplier - 1)
        }),
        switchMapEither(() =>
          margin.POST__sapi_v1_margin_order({
            query: signQuery({
              symbol: pairToString(symbol),
              isIsolated: option.some('TRUE'),
              side: 'BUY',
              type: 'LIMIT',
              sideEffectType: option.some('NO_SIDE_EFFECT'),
              timeInForce: option.some('GTC'),
              price: option.some(price),
              quantity: (price / budget) * multiplier,
              quoteOrderQty: option.none,
              newClientOrderId: option.none,
              stopPrice: option.none,
              icebergQty: option.none,
              newOrderRespType: option.none,
              recvWindow: option.none
            })
          })
        ),
        observableEither.map(getNewOrderResponse({ ...deps, listenKey$ }))
      ),*/,
        limitSell: ({ symbol, price, budget, multiplier }) =>
          pipe(
            borrow({
              asset: symbol.quote,
              symbol: pairToString(symbol),
              amount: budget * (multiplier - 1)
            }),
            switchMapEither(() =>
              margin.POST__sapi_v1_margin_order({
                query: signQuery({
                  symbol: pairToString(symbol),
                  isIsolated: option.some('TRUE'),
                  side: 'SELL',
                  type: 'LIMIT',
                  sideEffectType: option.some('NO_SIDE_EFFECT'),
                  timeInForce: option.some('GTC'),
                  price: option.some(price),
                  quantity: (price / budget) * multiplier,
                  quoteOrderQty: option.none,
                  newClientOrderId: option.none,
                  stopPrice: option.none,
                  icebergQty: option.none,
                  newOrderRespType: option.none,
                  recvWindow: option.none
                })
              })
            ),
            observableEither.map(getNewOrderResponse(listenKey$))
          ),
        stopLossLimit: ({ symbol, quantity, stop, limit, side }) =>
          pipe(
            margin.POST__sapi_v1_margin_order({
              query: signQuery({
                symbol: pairToString(symbol),
                isIsolated: option.some('TRUE'),
                side,
                type: 'STOP_LOSS_LIMIT',
                sideEffectType: option.some('AUTO_REPAY'),
                timeInForce: option.some('GTC'),
                price: option.some(limit),
                quantity,
                quoteOrderQty: option.none,
                newClientOrderId: option.none,
                stopPrice: option.some(stop),
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
  response:
    | marginOrderResponseAck
    | marginOrderResponseResult
    | marginOrderResponseFull
): response is marginOrderResponseFull =>
  Array.isArray((response as any)['fills']);

const getMarketOrderInfo = (
  res:
    | marginOrderResponseAck
    | marginOrderResponseResult
    | marginOrderResponseFull
) =>
  pipe(
    res,
    option.fromPredicate(isFullResponse),
    option.map(({ fills }) => getFilledOrderInfo(fills)),
    either.fromOption(
      () => new Error('Failed to calculate market order average')
    )
  );
