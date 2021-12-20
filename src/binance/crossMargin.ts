import { MarginController } from '../../generated/spot_api.yaml/paths/MarginController';
import { SignQuery } from 'binance-typescript-api';
import { option } from 'fp-ts';
import { pipe } from 'fp-ts/lib/function';
import { container } from '@performance-artist/fp-ts-adt';

type CrossMarginDeps = {
  margin: MarginController<'ObservableEither'>;
  signQuery: SignQuery;
};

export const crossMargin = pipe(
  container.create<CrossMarginDeps>()('margin', 'signQuery'),
  container.map(deps => {
    const { margin, signQuery } = deps;

    const transfer = ({
      asset,
      amount,
      type
    }: {
      asset: string;
      amount: number;
      type: 'fromMargin' | 'toMargin';
    }) =>
      margin.POST__sapi_v1_margin_transfer({
        query: signQuery({
          asset,
          amount,
          type: option.some(type === 'toMargin' ? 1 : 2),
          recvWindow: option.none
        })
      });

    return { transfer };
  })
);
