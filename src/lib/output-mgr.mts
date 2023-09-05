import {debug, info, setOutput} from '@actions/core';
import {NULL_ITERATOR} from './consts.mjs';
import {OutputGroup} from './util-decorators.mjs';

type Value = OutputMgr.Value;
type SettableValue<T> = OutputMgr.SettableValue<T>;
type IterOut<Ext> = [Ext, Value];

/** Bufferred output manager that can print before flushing */
class OutputMgr<O extends Ext, Def extends OutputMgr.Valueify<Ext>, Ext extends string = O>
  implements IterableWithIterableIterator<IterOut<Ext>> {
  readonly #buffer = new Map<Ext, Value>();

  public* [Symbol.iterator](): IterableIterator<IterOut<Ext>> {
    for (const tuple of this.#buffer) {
      yield tuple;
    }
    for (const element of this.virtualIter()) {
      yield element;
    }
  }

  /** Flush the outputs and clear the buffer */
  public flush(): this {
    for (const [name, value] of this) {
      setOutput(name, value);
    }
    this.#buffer.clear();

    return this;
  }

  public get<K extends Ext>(item: K): Def[K] | undefined {
    return this.#buffer.get(item) as Def[K] | undefined;
  }

  /** Returns true if outputs are set for **all** of the given items */
  public has(item: Ext, ...additionalItems: Ext[]): boolean;
  public has(...items: Ext[]): boolean {
    return items.every(item => this.#buffer.has(item));
  }

  @OutputGroup('Outputs')
  public log(): this {
    for (const [name, value] of this) {
      this.logOne(name, value);
    }

    return this;
  }

  public set<K extends Ext>(name: K, value: SettableValue<Def[K]> | undefined | null): void {
    if (value == null || value === false || value === '') {
      debug(`Removing output ${name} from method arg \`${String(value)}\``);
      this.#buffer.delete(name);
    } else {
      debug(`Setting output ${name} to method arg \`${String(value)}\``);
      this.#buffer.set(name, value);
    }
  }

  protected logOne(name: Ext, value: Value): void {
    info(`${name}: ${value.toLocaleString()}`);
  }

  /** Iterate over virtual/computed outputs */
  protected virtualIter(): IterableIterator<[Ext, Value]> {
    return NULL_ITERATOR;
  }
}

namespace OutputMgr {
  export type Value = string | string[] | number | boolean;

  export type SettableValue<T> = T extends ReadonlySet<infer S>
    ? S extends string
      ? S[]
      : never
    : T;

  export type Valueify<T extends string, V extends Value = Value> = Record<T, V>;
}

export default OutputMgr;
