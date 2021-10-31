import { either } from 'fp-ts';
import { observable } from 'fp-ts-rxjs';
import { Either } from 'fp-ts/lib/Either';
import { pipe } from 'fp-ts/lib/function';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export const switchMapEither = <E, A, B>(
  f: (a: A) => Observable<Either<E, B>>
) => (o: Observable<Either<E, A>>): Observable<Either<E, B>> =>
  pipe(o, switchMap(either.fold(e => observable.of(either.left(e)), f)));
