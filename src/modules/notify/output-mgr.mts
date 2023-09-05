import OutputMgr from '../../lib/output-mgr.mjs';
import {NotifyInputs} from './index.mjs';
import {RatelimitTracker} from './ratelimit-tracker.mjs';

type Value = import('../../lib/output-mgr.mjs').default.Value;

type NumericOutputs = VirtualOutputName.RatelimitSeconds;

const enum VirtualOutputName {
  RatelimitSeconds = 'ratelimit-seconds',
  RatelimitResetAt = 'ratelimit-reset-at',
  FailedIssues = 'failed-issues',
}

type TypeMap = Record<Exclude<VirtualOutputName, NumericOutputs>, string>
  & Record<VirtualOutputName, number>;

export class NotifyOutputMgr extends OutputMgr<never, TypeMap, VirtualOutputName> {
  readonly #inputs: OptReadonly<NotifyInputs>;

  readonly #rateLimit: RatelimitTracker;

  public constructor(rateLimit: RatelimitTracker, inputs: OptReadonly<NotifyInputs>) {
    super();
    this.#rateLimit = rateLimit;
    this.#inputs = inputs;
  }

  protected override* virtualIter(): IterableIterator<[VirtualOutputName, Value]> {
    if (this.#rateLimit.wasUsed) {
      yield [VirtualOutputName.RatelimitSeconds, this.#rateLimit.millisUntilReset / 1000];
      yield [VirtualOutputName.RatelimitResetAt, this.#rateLimit.resetIso];
    }
    if (this.#inputs.issues!.size) {
      yield [VirtualOutputName.FailedIssues, [...this.#inputs.issues!].join(',')];
    }
  }
}
