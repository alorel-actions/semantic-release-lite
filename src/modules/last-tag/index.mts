import {info, isDebug, setFailed, setOutput} from '@actions/core';
import {SemVer} from '../../lib/semver.mjs';
import {ReleaseOutputName} from '../../output-mgr.mjs';

(async function getLastTag() {
  const lastTag = await SemVer.resolveLastRelease();
  if (lastTag) {
    info(`Last tag resolved to ${lastTag}`);
    setOutput(ReleaseOutputName.LastTag, lastTag);
  } else {
    info('No release tags found');
  }
})().catch((e: Error) => {
  setFailed(isDebug() ? (e.stack ?? e.message) : e.message);
});
