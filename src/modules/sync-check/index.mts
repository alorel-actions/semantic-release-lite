import {isDebug, setFailed, warning} from '@actions/core';
import OutputMgr from '../../lib/output-mgr.mjs';
import OutOfSyncError from '../../lib/sync-check.mjs';
import {ReleaseOutputName} from '../../output-mgr.mjs';
import Valueify = OutputMgr.Valueify;

(async function syncCheck() {
  const out = new OutputMgr<ReleaseOutputName, Valueify<ReleaseOutputName>>();

  try {
    await OutOfSyncError.check();
    out.set(ReleaseOutputName.IsInSync, true);
  } catch (e) {
    warning((e as OutOfSyncError).message);
  }

  out.log().flush();
})().catch((e: Error) => {
  setFailed(isDebug() ? (e.stack ?? e.message) : e.message);
});
