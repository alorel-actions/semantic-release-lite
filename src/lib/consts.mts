export enum Strings {
  Signature = '\\- Your friendly neighbourhood [:robot: semantic release bot](https://github.com/alorel-actions/semantic-release-lite)',
}

export const enum Numbers {
  DEFAULT_HEADING_DEPTH = 3,
}

interface NullIterator {
  [Symbol.iterator]<T>(): IterableIterator<T>;

  next<T, TReturn>(): IteratorResult<T, TReturn>;
}

export const NULL_ITERATOR: NullIterator = Object.freeze<IterableIterator<any>>({
  next() {
    return {done: true} satisfies Partial<IteratorResult<any>> as IteratorResult<any>;
  },
  [Symbol.iterator]() {
    return this;
  }
});
