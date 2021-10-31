import { Either } from 'fp-ts/lib/Either';
import * as rx from 'rxjs';

export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
};

export type CurrentCandle = Candle & {
  isClosed: boolean;
};

export type ObservableEither<E, A> = rx.Observable<Either<E, A>>;

export type Side = 'BUY' | 'SELL';

export type Interval =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | '6h'
  | '8h'
  | '12h'
  | '1d'
  | '3d'
  | '1w'
  | '1M';
