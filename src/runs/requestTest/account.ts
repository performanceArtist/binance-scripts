import { makeBinanceHttpClient } from 'binance-typescript-api';
import { config } from '../../config';
import { either } from 'fp-ts';
import { getBalanceOf, getSpotAccount } from '../../binance/account';
import { tradeController } from '../../../generated/spot_api.yaml/paths/TradeController';
import { pipe } from 'fp-ts/lib/function';

const { httpClient, signQuery } = makeBinanceHttpClient(
  config.baseAPIURL,
  config
);

const account$ = getSpotAccount.value.run({
  trade: tradeController({ httpClient }),
  signQuery
})();

account$.subscribe(either.fold(console.error, console.log));

const usdtBalance$ = pipe(
  getBalanceOf.value.run({ trade: tradeController({ httpClient }), signQuery })(
    'USDT'
  )
);

usdtBalance$.subscribe(either.fold(console.error, console.log));
