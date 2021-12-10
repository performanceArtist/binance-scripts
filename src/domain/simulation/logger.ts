import fs from 'fs';
import { Observable } from 'rxjs';

const writeFile = fs.writeFileSync;

export const logObservable = (filepath: string) => (o: Observable<any>) => {
  o.subscribe(data => writeFile(filepath, JSON.stringify(data)));
};
