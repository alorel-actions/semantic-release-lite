import {getInput, isDebug, setFailed} from '@actions/core';
import CommitParser from '../../lib/commit-parser.mjs';
import InputMgr from '../../lib/input-mgr.mjs';
import OutputMgr from '../../lib/output-mgr.mjs';
import {SemVer} from '../../lib/semver.mjs';
import ReleaseType = CommitParser.ReleaseType;
import Valueify = OutputMgr.Valueify;

interface Inputs {
  'last-tag'?: SemVer;

  'release-type': ReleaseType;

  'stay-at-zero': boolean;
}

const enum Outputs {
  Tag = 'tag',
  Major = 'major',
  Minor = 'minor',
  Patch = 'patch',
}

(async function getNextTag() {
  const inputs = new InputMgr<Inputs>({
    'last-tag'() {
      const t = getInput('last-tag');
      if (t) {
        return SemVer.parse(t, true);
      }
    },
    'release-type'() {
      const ty = getInput('release-type', {required: true});
      if (![ReleaseType.Patch, ReleaseType.Minor, ReleaseType.Major].includes(ty as ReleaseType)) {
        throw new Error(`Invalid release type: ${ty}`);
      }

      return ty as ReleaseType;
    },
    'stay-at-zero': Boolean,
  });
  inputs.load();

  const next = SemVer.resolveNextRelease({
    lastTag: inputs['last-tag'],
    releaseType: inputs['release-type'],
    stayAtZero: inputs['stay-at-zero'],
  });

  new OutputMgr<Outputs, Valueify<Outputs>>()
    .set(Outputs.Tag, next.toString())
    .set(Outputs.Major, next.major)
    .set(Outputs.Minor, next.minor)
    .set(Outputs.Patch, next.patch)
    .log()
    .flush();
})().catch((e: Error) => {
  setFailed(isDebug() ? (e.stack ?? e.message) : e.message);
});
