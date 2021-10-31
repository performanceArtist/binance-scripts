import { ObservableEither } from '../../domain/types';
import { observableEither } from 'fp-ts-rxjs';
import { pipe } from 'fp-ts/lib/function';
import * as rxo from 'rxjs/operators';
import * as rx from 'rxjs';

export type ScriptState<T> = {
  inPosition: boolean;
  triggers: T[];
};

export type FrameDeps<M, O, R, T> = {
  open$: ObservableEither<Error, M>;
  execute: (meta: M) => ObservableEither<Error, O>;
  manage: (
    order: O,
    onClose: (trigger: T) => void
  ) => ObservableEither<Error, R>;
  rerun: (state: ScriptState<T>) => boolean;
};

export const frame = <M, O, R, T>(deps: FrameDeps<M, O, R, T>) => {
  const { open$, rerun, execute, manage } = deps;
  const state = new rx.BehaviorSubject<ScriptState<T>>({
    inPosition: false,
    triggers: []
  });
  const onClose = (trigger: T) =>
    state.next({
      inPosition: false,
      triggers: state.getValue().triggers.concat(trigger)
    });

  const script$ = pipe(
    open$,
    rxo.filter(() => rerun(state.getValue())),
    rxo.tap(() => state.next({ ...state.getValue(), inPosition: true })),
    observableEither.chain(execute),
    observableEither.chain(order => manage(order, onClose))
  );

  return { script$, state };
};
