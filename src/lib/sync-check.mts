import {exec} from './exec.mjs';

export default class OutOfSyncError extends Error {
  private constructor(match: string) {
    const m = match === 'ahead' ? 'ahead of' : 'behind';
    super(`The current branch is ${m} the remote branch.`);

    this.name = 'OutOfSyncError';
  }

  public static async check(): Promise<void> {
    const stdout = await exec('git status -sb', 'getting git status');
    const outOfSync = stdout.match(/\[(ahead|behind)/)?.[1];
    if (outOfSync) {
      throw new OutOfSyncError(outOfSync);
    }
  }
}
