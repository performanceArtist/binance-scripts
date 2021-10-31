import { ObservableEither } from '.';
import { StopLoss } from '../trade/stopLoss';

export type CancelOrder = () => ObservableEither<Error, void>;

export type OrderResponse = {
  cancel: CancelOrder;
  filled$: ObservableEither<Error, { price: number; quantity: number }>;
};

export type MarketOrderFill = {
  quantity: number;
  averagePrice: number;
};

export type StopLossOrder = { quantity: number; price: number } & StopLoss &
  OrderResponse;
