import {getInput, info, isDebug, setFailed} from '@actions/core';
import InputMgr from '../../lib/input-mgr.mjs';
import OutputMgr from '../../lib/output-mgr.mjs';
import {SemVer} from '../../lib/semver.mjs';
import {ReleaseOutputName} from '../../output-mgr.mjs';
import Valueify = OutputMgr.Valueify;

interface Inputs {
  after?: SemVer;

  before?: SemVer;
}

(async function getLastTag() {
  function loadInput(name: keyof Inputs): () => SemVer | undefined {
    return function actualInputLoader() {
      const str = getInput(name);
      if (!str) {
        return;
      }

      const semVer = SemVer.parse(str);
      if (semVer) {
        return semVer;
      }

      throw new Error('Invalid SemVer string');
    };
  }

  const inputs = new InputMgr<Inputs>({
    after: loadInput('after'),
    before: loadInput('before'),
  });
  inputs.load();

  let tags = await SemVer.resolveReleases();
  if (inputs.after) {
    if (inputs.before) {
      tags = tags.filter(tag => tag.isGreaterThan(inputs.after!) && tag.isLowerThan(inputs.before!));
    } else {
      tags = tags.filter(tag => tag.isGreaterThan(inputs.after!));
    }
  } else if (inputs.before) {
    tags = tags.filter(tag => tag.isLowerThan(inputs.before!));
  }

  const lastTag = tags[0];
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
