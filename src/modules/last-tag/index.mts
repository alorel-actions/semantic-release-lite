import {info, isDebug, setFailed} from '@actions/core';
import OutputMgr from '../../lib/output-mgr.mjs';
import {SemVer} from '../../lib/semver.mjs';
import {ReleaseOutputName} from '../../output-mgr.mjs';
import Valueify = OutputMgr.Valueify;

(async function getLastTag() {
  const lastTag = await SemVer.resolveLastRelease();
  if (lastTag) {
    new OutputMgr<ReleaseOutputName, Valueify<ReleaseOutputName>>()
      .set(ReleaseOutputName.LastTag, lastTag.toString())
      .log()
      .flush();
  } else {
    info('No release tags found');
  }
})().catch((e: Error) => {
  setFailed(isDebug() ? (e.stack ?? e.message) : e.message);
});
