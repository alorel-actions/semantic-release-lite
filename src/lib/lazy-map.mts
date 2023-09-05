type Factory<K, V, A extends any[]> = (this: LazyMap<K, V, A>, key: K, ...rest: A) => V;

/** An extension to the ES6 map that allows entries to be created lazily */
export class LazyMap<K, V, A extends any[] = []> extends Map<K, V> {
  readonly #valueFactory: Factory<K, V, A>;

  /**
   * @param valueFactory Function that'll lazily create values
   * @param entries Starting map entries
   */
  public constructor(
    valueFactory: Factory<K, V, A>,
    entries?: Iterable<[K, V]> | null
  ) {
    // Typings are invalid - iterables are perfectly acceptable
    super(entries as null | undefined | readonly [K, V][]);
    this.#valueFactory = valueFactory;
  }

  /**
   * Get the value for the given key if it exists or have it exlicitly created by the map's value factory & returned
   * @param key The entry key
   * @param creationArgs If the value factory accepts additional args then must be passed on here
   */
  public getOrInsert(key: K, ...creationArgs: A): V {
    if (this.has(key)) {
      return this.get(key)!;
    }

    const newValue = this.#valueFactory(key, ...creationArgs);
    this.set(key, newValue);

    return newValue;
  }
}
