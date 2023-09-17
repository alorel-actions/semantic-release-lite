import {info} from '@actions/core';
import {exec} from './exec.mjs';
import {OutputGroup} from './util-decorators.mjs';

export default class OutOfSyncError extends Error {
  private constructor(match: string) {
    const m = match === 'ahead' ? 'ahead of' : 'behind';
    super(`The current branch is ${m} the remote branch.`);

    this.name = 'OutOfSyncError';
  }

  @OutputGroup('Sync check')
  public static async check(): Promise<void> {
    info(await exec('git fetch', 'refreshing remote status'));

    const stdout = await exec('git status -sb', 'getting git status');
    info(stdout);

    const outOfSync = stdout.match(/\[(ahead|behind)/)?.[1];
    if (outOfSync) {
      throw new OutOfSyncError(outOfSync);
    }
  }
}
