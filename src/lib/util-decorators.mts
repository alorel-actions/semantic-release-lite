import {endGroup, startGroup} from '@actions/core';
import {constant} from 'lodash-es';

type Factory<T = any> = (this: T, instance: T) => string;

/** Action output/echo group: start/finish at method start/finish. Promise-aware. */
function OutputGroup<T>(nameFactory: Factory<T>): MethodDecorator;
/** Action output/echo group: start/finish at method start/finish. Promise-aware. */
function OutputGroup(name: string): MethodDecorator;
function OutputGroup(nameOrNameFactory: string | Factory): MethodDecorator {
  const makeGroupName: Factory = typeof nameOrNameFactory === 'string'
    ? constant(nameOrNameFactory)
    : nameOrNameFactory;

  return function outputGroupDecorator(_o, _k, descriptor): PropertyDescriptor {
    const orig = descriptor.value!;

    return {
      ...descriptor,
      value: function(this: any, ...args: any[]): any {
        startGroup(makeGroupName.call(this, this));
        let out: any;

        try {
          out = (orig as unknown as Function).apply(this, args);
          if (!(out instanceof Promise)) {
            return out;
          }

          return out.then(
            ok => {
              endGroup();
              return ok;
            },
            err => {
              endGroup();
              throw err;
            }
          );
        } finally {
          if (typeof out?.then !== 'function') {
            endGroup();
          }
        }
      }
    };
  };
}

export {OutputGroup};
