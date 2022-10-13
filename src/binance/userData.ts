import { ObservableEither } from 'trading-indicators-streams';
import { BinanceWebSocketClient } from 'binance-typescript-api';
import { pipe } from 'fp-ts/lib/function';
import { either } from 'fp-ts';
import * as rxo from 'rxjs/operators';
import { observableEither } from 'fp-ts-rxjs';
import { Int } from 'io-ts';
import { switchMapEither } from '../utils/switchMapEither';
import { container } from '@performance-artist/fp-ts-adt';

export type UserDataDeps = {
  socketClient: BinanceWebSocketClient;
};

export const getExecutionReport = pipe(
  container.create<UserDataDeps>()('socketClient'),
  container.map(
    ({ socketClient }) => (listenKey$: ObservableEither<Error, string>) =>
      pipe(
        listenKey$,
        switchMapEither(socketClient.userData),
        rxo.filter(either.exists(userData => userData.e === 'executionReport')),
        observableEither.map(report =>
          report.e === 'executionReport' ? report : (null as never)
        )
      )
  )
);

export const getOrderPrice = pipe(
  getExecutionReport,
  container.map(
    getExecutionReport => (listenKey$: ObservableEither<Error, string>) => (
      orderId: Int
    ) =>
      pipe(
        getExecutionReport(listenKey$),
        rxo.filter(either.exists(report => report.i === orderId)),
        observableEither.map(({ p, q }) => ({
          price: parseFloat(p),
          quantity: parseFloat(q)
        })),
        rxo.take(1),
        rxo.shareReplay(1)
      )
  )
);
