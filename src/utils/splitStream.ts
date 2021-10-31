import { pipe } from 'fp-ts/lib/function';
import * as rx from 'rxjs';
import * as rxo from 'rxjs/operators';

export const splitStream = (n: number) => <A>(o: rx.Observable<A>) =>
  pipe(
    o,
    rxo.scan(
      (acc, cur) => (acc.length === n ? [cur] : acc.concat(cur)),
      [] as A[]
    ),
    rxo.filter(acc => acc.length === n)
  );
