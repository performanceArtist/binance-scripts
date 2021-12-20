import { SignQuery } from 'binance-typescript-api';
import { array, either, option } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { flow, pipe } from 'fp-ts/lib/function';
import { TradeController2 } from '../../generated/spot_api.yaml/paths/TradeController';
import * as rxo from 'rxjs/operators';
import { container } from '@performance-artist/fp-ts-adt';

export type SpotBalanceDeps = {
  trade: TradeController2<'ObservableEither'>;
  signQuery: SignQuery;
};

export const getSpotAccount = pipe(
  container.create<SpotBalanceDeps>()('signQuery', 'trade'),
  container.map(({ trade, signQuery }) => () =>
    pipe(
      trade.GET__api_v3_account({
        query: signQuery({
          recvWindow: option.none
        })
      })
    )
  )
);

export const getBalance = pipe(
  getSpotAccount,
  container.map(f =>
    flow(
      f,
      observableEither.map(account => account.balances)
    )
  )
);

export const getBalanceOf = pipe(
  getBalance,
  container.map(getBalance => (asset: string) =>
    pipe(
      getBalance(),
      rxo.map(
        either.chain(
          flow(
            array.findFirst(balance => balance.asset === asset),
            either.fromOption(() => new Error('Asset not found'))
          )
        )
      ),
      observableEither.map(balance => parseFloat(balance.free))
    )
  )
);
