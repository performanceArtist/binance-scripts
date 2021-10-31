import { Reader } from 'fp-ts/lib/Reader';

export const partial = <E, A>(f: (e: E) => A) => <D extends Partial<E>>(
  defaults: D
) => (e: Omit<E, keyof D>): A => f({ ...e, ...defaults } as any);

export const partialf = <D>(defaults: D) => <E extends D, A>(
  f: (e: E) => A
) => (e: Omit<E, keyof D>): A => f({ ...e, ...defaults } as any);

export type Compute<A> = A extends object
  ? {
      [K in keyof A]: A[K];
    } & {}
  : never;

export const inject = <E1, K extends string, V>(
  key: K,
  value: Reader<E1, V>
) => <E extends Record<K, V>, A>(
  r: Reader<E, A>
): Reader<Compute<E1 & Omit<E, K>>, A> => e =>
  r({ ...e, [key]: value(e) } as any);

export const injectM = <E1, V extends object>(value: Reader<E1, V>) => <
  E extends V,
  A
>(
  r: Reader<E, A>
): Reader<Compute<E1 & Omit<E, keyof V>>, A> => e =>
  r({ ...e, ...value(e) } as any);
