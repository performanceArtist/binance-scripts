import { ScriptState } from './script';

export const xTimes = (times: number) => (state: ScriptState<unknown>) =>
  state.triggers.length === times - 1;

export const once = xTimes(1);
