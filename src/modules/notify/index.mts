import {getInput, isDebug, notice, setFailed, warning} from '@actions/core';
import InputMgr from '../../lib/input-mgr.mjs';
import OutOfSyncError from '../../lib/sync-check.mjs';
import {NotifyOutputMgr} from './output-mgr.mjs';
import {NotifyProcessor} from './processor.mjs';
import {RatelimitTracker} from './ratelimit-tracker.mjs';

export interface NotifyInputs {
  comment: string;

  'error-on-out-of-sync': boolean;

  'error-on-ratelimit': boolean;

  'gh-token': string;

  issues?: Set<string>;

  labels: string[];

  tag: string;
}

(async function notifyAction(): Promise<any> {
  const inputs = new InputMgr<NotifyInputs>({
    comment: [String, {required: true}],
    'error-on-ratelimit': Boolean,
    'error-on-out-of-sync': Boolean,
    'gh-token': [String, {required: true}],
    issues() {
      const rawIssues = getInput('issues', {required: true}).split(/\s*,\s*/gm);
      if (!rawIssues.length || (rawIssues.length === 1 && rawIssues[0] === '')) {
        return;
      }

      const issues = new Set(rawIssues);
      if (rawIssues.length !== issues.size) {
        notice(`Removed ${rawIssues.length - issues.size} duplicate issue numbers from the input.`);
      }

      return issues;
    },
    labels: [InputMgr.ARRAY, {required: true}],
    tag: [String, {required: true}],
  });
  inputs.load();

  if (!inputs.issues?.size) {
    return warning('No issues provided - exiting');
  }

  try {
    await OutOfSyncError.check();
  } catch (e) {
    const msg = (e as OutOfSyncError).message;

    return inputs['error-on-out-of-sync']
      ? setFailed(msg)
      : warning(`${msg} Skipping the step.`);
  }

  const rateLimiter = new RatelimitTracker();
  const outputs = new NotifyOutputMgr(rateLimiter, inputs);

  await new NotifyProcessor(inputs).process();
  outputs.log().flush();
})().catch((e: Error) => {
  setFailed(isDebug() ? (e.stack ?? e.message) : e.message);
});
