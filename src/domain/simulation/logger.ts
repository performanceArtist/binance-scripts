import fs from 'fs';
import { BehaviorSubject, Observable } from 'rxjs';
import { SpotAction } from '../types';

const writeFile = fs.writeFileSync;

export const logMockSpot = (filepath: string) => (
  action$: Observable<SpotAction>
) => {
  const actions = new BehaviorSubject<SpotAction[]>([]);
  actions.subscribe(data => writeFile(filepath, JSON.stringify(data)));
  action$.subscribe(action => actions.next(actions.getValue().concat(action)));
};

export const logObservable = (filepath: string) => (o: Observable<any>) => {
  o.subscribe(data => writeFile(filepath, JSON.stringify(data)));
};
