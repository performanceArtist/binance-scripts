import { pipe } from 'fp-ts/lib/function';
import fs from 'fs';
import { Observable } from 'rxjs';
import * as rxo from 'rxjs/operators';

const writeFile = fs.writeFileSync;

export const logObservable = (filepath: string) => (o: Observable<any>) => {
  o.subscribe(data => writeFile(filepath, JSON.stringify(data)));
};

export const logObservableToArray = (filepath: string) => (
  o: Observable<any>
) => {
  pipe(
    o,
    rxo.scan((acc, cur) => acc.concat(cur), []),
    rxo.startWith([]),
    all => all.subscribe(data => writeFile(filepath, JSON.stringify(data)))
  );
};
