import { CurrencyPair } from '../data/currencyPair';
import { Side } from './shared';

export type LimitOrderAction =
  | {
      type: 'LIMIT_ORDER';
      symbol: CurrencyPair;
      price: number;
      side: Side;
      quantity: number;
      equity: number;
    }
  | {
      type: 'STOP_LOSS_LIMIT';
      symbol: CurrencyPair;
      quantity: number;
      stop: number;
      limit: number;
    };

export type SpotAction =
  | LimitOrderAction
  | {
      type: 'MARKET_ORDER';
      symbol: CurrencyPair;
      price: number;
      side: Side;
      quantity: number;
    }
  | {
      type: 'FILLED_STOP_LOSS_LIMIT';
      price: number;
      quantity: number;
    }
  | {
      type: 'FILLED_LIMIT';
      side: Side;
      price: number;
      quantity: number;
    }
  | {
      type: 'CANCELLED_STOP_LIMIT';
      symbol: CurrencyPair;
      price: number;
      quantity: number;
    }
  | {
      type: 'CANCELLED_STOP_LOSS_LIMIT';
      symbol: CurrencyPair;
      quantity: number;
      stop: number;
      limit: number;
    };
