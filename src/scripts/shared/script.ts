import { ObservableEither } from '../../domain/types';
import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import * as rx from 'rxjs';

export type ScriptState<T> = {
  triggers: T[];
};

export type ScriptDeps<M, O, T> = {
  open$: ObservableEither<Error, M>;
  execute: (meta: M) => ObservableEither<Error, O>;
  manage: (
    order: O,
    onClose: (trigger: T) => void
  ) => ObservableEither<Error, unknown>;
  rerun: (state: ScriptState<T>) => boolean;
};

export type ScriptFlow = {
  open: unknown;
  execute: unknown;
  trigger: unknown;
};

export const script = <F extends ScriptFlow>(
  deps: ScriptDeps<F['open'], F['execute'], F['trigger']>
) => {
  const { open$, rerun, execute, manage } = deps;
  const state = new rx.BehaviorSubject<ScriptState<F['trigger']>>({
    triggers: []
  });
  const onClose = (trigger: F['trigger']) =>
    state.next({
      triggers: state.getValue().triggers.concat(trigger)
    });

  const script$ = pipe(
    open$,
    rxo.filter(() => rerun(state.getValue())),
    observableEither.chain(execute),
    observableEither.chain(order => manage(order, onClose))
  );

  return { script$, state };
};
