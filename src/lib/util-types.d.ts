/** Keys of `T` whose types are assignable to `TT` */
declare type TypedKeys<T, TT> = { [P in keyof T]: T[P] extends TT ? P : never }[keyof T];

declare type OptionalKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? K : never; }[keyof T];
declare type RequiredKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? never : K; }[keyof T];

declare type VersionNum = `${number}.${number}.${number}`;
declare type VersionStr = `v${VersionNum}`;

declare type Retype<T, As> = { [P in OptionalKeys<T>]?: Exclude<As, undefined> } & { [P in RequiredKeys<T>]: As };

declare type OptPick<T, K extends keyof T> = { [P in K & OptionalKeys<T>]?: Exclude<T[P], undefined> }
  & { [P in K & RequiredKeys<T>]: T[P] };

declare type OptOmit<T, K> = { [P in Exclude<OptionalKeys<T>, K>]?: Exclude<T[P], undefined> }
  & { [P in Exclude<RequiredKeys<T>, K>]: T[P] };

declare type OptReadonly<T> = { readonly [P in OptionalKeys<T>]?: Exclude<T[P], undefined> }
  & { readonly [P in RequiredKeys<T>]: T[P] };

declare type Arrayish<T> = T[] | readonly T[];

declare interface IterableWithIterableIterator<T> extends Iterable<T> {
  [Symbol.iterator](): IterableIterator<T>;
}
