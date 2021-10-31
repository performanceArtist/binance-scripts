import { SignQuery } from 'binance-typescript-api';
import { array, either, option } from 'fp-ts';
import { observableEither } from 'fp-ts-rxjs';
import { flow, pipe } from 'fp-ts/lib/function';
import { TradeController2 } from '../../generated/spot_api.yaml/paths/TradeController';
import * as rxo from 'rxjs/operators';

export type SpotBalanceDeps = {
  trade: TradeController2<'ObservableEither'>;
  signQuery: SignQuery;
};

export const getSpotAccount = ({ trade, signQuery }: SpotBalanceDeps) =>
  pipe(
    trade.GET__api_v3_account({
      query: signQuery({
        recvWindow: option.none
      })
    })
  );

export const getBalance = flow(
  getSpotAccount,
  observableEither.map(account => account.balances)
);

export const getBalanceOf = (deps: SpotBalanceDeps) => (asset: string) =>
  pipe(
    getBalance(deps),
    rxo.map(
      either.chain(
        flow(
          array.findFirst(balance => balance.asset === asset),
          either.fromOption(() => new Error('Asset not found'))
        )
      )
    ),
    observableEither.map(balance => parseFloat(balance.free))
  );
