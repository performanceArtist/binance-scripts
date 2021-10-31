import { ObservableEither } from '../domain/types';
import { BinanceWebSocketClient } from 'binance-typescript-api';
import { pipe } from 'fp-ts/lib/function';
import { either } from 'fp-ts';
import * as rxo from 'rxjs/operators';
import { observableEither } from 'fp-ts-rxjs';
import { Int } from 'io-ts';
import { switchMapEither } from '../utils/switchMapEither';

export type UserDataDeps = {
  socketClient: BinanceWebSocketClient;
  listenKey$: ObservableEither<Error, string>;
};

export const getExecutionReport = ({
  listenKey$,
  socketClient
}: UserDataDeps) =>
  pipe(
    listenKey$,
    switchMapEither(socketClient.userData),
    rxo.filter(either.exists(userData => userData.e === 'executionReport')),
    observableEither.map(report =>
      report.e === 'executionReport' ? report : (null as never)
    )
  );

export const getOrderPrice = (deps: UserDataDeps) => (orderId: Int) =>
  pipe(
    getExecutionReport(deps),
    rxo.filter(either.exists(report => report.i === orderId)),
    observableEither.map(({ p, q }) => ({
      price: parseFloat(p),
      quantity: parseFloat(q)
    })),
    rxo.take(1),
    rxo.shareReplay(1)
  );
