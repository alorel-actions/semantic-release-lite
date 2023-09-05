import {debug, getBooleanInput, getInput, getMultilineInput, info, InputOptions} from '@actions/core';
import OutputMgr from './output-mgr.mjs';
import {OutputGroup} from './util-decorators.mjs';

const ARRAY: unique symbol = Symbol('Array type');

/** Input manager */
class InputMgrImpl<T extends object = {}> {
  public static readonly ARRAY: typeof ARRAY = ARRAY;

  #inputs? = new Map<Key<T>, T[keyof T] | Factory<T[keyof T]>>();

  public constructor(init: Init<T>) {
    for (const [key, rawDef] of Object.entries(init) as [Key<T>, InitValue][]) {
      if (key in this) {
        throw new Error(`Input name ${key} is reserved`);
      }

      const basicFactory = getPrimitiveFieldFactory(key, rawDef);
      if (basicFactory) {
        this.#setFactory(key, basicFactory);
        continue;
      }

      if (Array.isArray(rawDef)) {
        const [ty, opts] = rawDef;

        this.#setFactory(key, getPrimitiveFieldFactory(key, ty, opts));
        continue;
      }

      this.#setFactory(key, rawDef as Factory<any>);
    }
  }

  @OutputGroup('Inputs')
  public load(): void {
    for (const [name, factory] of this.#inputs!) {
      debug(`Loading ${name}`);
      Object.defineProperty(this, name, {
        enumerable: true,
        value: (factory as Factory<T[keyof T]>)(),
      });
      info(`[OK] ${name}`);
    }

    Object.defineProperty(this, 'load', {value: () => this});
    this.#inputs = undefined;
  }

  #getField<K extends Key<T>>(key: K): T[K] | undefined {
    this.load();

    return this[key as unknown as keyof this] as any;
  }

  #setFactory<K extends Key<T>>(key: K, factory: Factory<T[K]>): void {
    this.#inputs!.set(key, factory);
    Object.defineProperty(this, key, {
      configurable: true,
      enumerable: true,
      get: () => this.#getField(key),
    });
  }
}

interface InputMgr {
  readonly ARRAY: typeof ARRAY;

  new<T extends object>(init: Init<T>): T extends Retype<InputMgrImpl, any> ? never : T & InputMgrImpl<T>;
}

export default InputMgrImpl as InputMgr;
export type {Init as InputMgrInit, InputMgrImpl as TInputMgr};

type Key<T> = `${string}-${string}` & keyof T;
type Factory<T> = () => T;
type FieldType = (typeof ARRAY) | BooleanConstructor | StringConstructor;
type InitValue<T = unknown> =
  (() => T)
  | FieldTyConstructor<OutputMgr.SettableValue<T>>
  | [FieldTyConstructor<OutputMgr.SettableValue<T>>, InputOptions];
type Init<T> = { [P in (string & keyof T)]: InitValue<T[P]> };

type FieldTyConstructor<T> = T extends boolean
  ? BooleanConstructor
  : T extends string
    ? StringConstructor
    : T extends string[]
      ? typeof ARRAY
      : never;

function getPrimitiveFieldFactory(key: string, ty: FieldType, opts?: InputOptions): (() => any);
function getPrimitiveFieldFactory<T>(key: string, ty: InitValue<T>, opts?: InputOptions): undefined | (() => any);
function getPrimitiveFieldFactory<T>(key: string, ty: InitValue<T>, opts?: InputOptions): undefined | (() => any) {
  switch (ty) {
    case ARRAY:
      return function arrayFieldFactory(): string[] {
        return getMultilineInput(key, opts);
      };
    case Boolean:
      return function booleanFieldFactory(): boolean {
        return getBooleanInput(key, opts);
      };
    case String:
      return function stringFieldFactory(): string {
        return getInput(key, opts);
      };
  }
}
