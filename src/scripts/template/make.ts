import { container } from '@performance-artist/fp-ts-adt';
import { pipe } from 'fp-ts/lib/function';
import { CandleStreams } from '../../domain/data';
import { CurrencyPair } from '../../domain/data/currencyPair';
import { StopLossOrder } from '../../domain/types';
import { script } from '../shared/script';

export type ScriptDeps = {};

export type ScriptParams = {
  symbol: CurrencyPair;
  candleStreams: CandleStreams;
};

export type ScriptFlow = {
  open: unknown;
  execute: StopLossOrder;
  trigger: ScriptTrigger;
};

export type ScriptTrigger =
  | {
      type: 'STOP_LOSS_TRIGGERED';
      loss: number;
    }
  | { type: 'PROFIT_TAKEN'; profit: number };

export const makeScript = pipe(
  container.create<ScriptDeps>()(),
  container.map(deps => (params: ScriptParams) => {
    const {} = deps;
    const {} = params;

    return script<ScriptFlow>({} as any);
  })
);
