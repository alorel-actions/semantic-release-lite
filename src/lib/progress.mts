import {info, warning} from '@actions/core';

const enum Numbers {
  DefaultWidth = 30,
}

/** A progress bar */
class Progress {
  #done = 0;

  readonly #total: number;

  readonly #width: number;

  public constructor(total: number, width: number = Numbers.DefaultWidth) {
    this.#total = total;
    this.#width = Math.max(0, Math.floor(width));
  }

  public get done(): number {
    return this.#done;
  }

  public set done(value: number) {
    if (value > this.#total) {
      warning(`Progress done value (${value}) exceeds total (${this.#total})`);
      this.#done = this.#total;
    } else if (value < 0) {
      warning(`Progress done value (${value}) is below 0`);
      this.#done = 0;
    } else {
      this.#done = value;
    }
  }

  public get pctDone(): number {
    return parseFloat((this.done / this.#total).toFixed(3));
  }

  public get total(): number {
    return this.#total;
  }

  get #doneWidthF32(): number {
    return this.pctDone * this.#width;
  }

  public limitedProgress(limit: number): LimitedProgress {
    return new LimitedProgress(this, limit);
  }

  public log(message: string): void {
    info(`[${this}] ${message}`);
  }

  public toString(): string {
    const doneF32 = this.#doneWidthF32;

    return '█'.repeat(Math.floor(doneF32))
      + remBlock(doneF32 % 1)
      + '░'.repeat(Numbers.DefaultWidth - Math.ceil(doneF32));
  }

  public warn(message: string): void {
    warning(`[${this}] ${message}`);
  }
}

class LimitedProgress {
  readonly #host: Progress;

  #remaining: number;

  public constructor(host: Progress, limit: number) {
    this.#remaining = limit;
    this.#host = host;
  }

  public get remaining(): number {
    return this.#remaining;
  }

  /** @return Whether the host has enough permits remaining to satisfy the rest of this class instance or not */
  public get satisfiable(): boolean {
    return this.#remaining <= this.#host.total;
  }

  /** Returns value of {@link #satisfiable} post-decrement */
  public decrement(logMsg: string): boolean {
    if (this.#remaining) {
      this.#decrement(1);
      this.#host.log(logMsg);

      return this.satisfiable;
    }

    warning('Tried to decrement `LimitedProgress` below 0');

    return false;
  }

  public drain(): void {
    if (this.#remaining) {
      this.#decrement(this.#remaining);
    } else {
      warning('Tried to drain `LimitedProgress` that\'s already empty');
    }
  }

  #decrement(by: number): void {
    this.#remaining -= by;
    this.#host.done += by;
  }
}

export {Progress};
export type {LimitedProgress};

function remBlock(rem: number): string {
  if (rem >= 0.875) {
    return '▇';
  } else if (rem >= 0.75) {
    return '▆';
  } else if (rem >= 0.625) {
    return '▅';
  } else if (rem >= 0.5) {
    return '▄';
  } else if (rem >= 0.375) {
    return '▃';
  } else if (rem >= 0.25) {
    return '▂';
  }

  return '▁';
}
