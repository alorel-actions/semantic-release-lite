import {debug, getInput, setFailed} from '@actions/core';
import ChangelogGenerator from '../../lib/changelog-generator.mjs';
import CommitLoader from '../../lib/commit-loader.mjs';
import CommitParser from '../../lib/commit-parser.mjs';
import type {CommonConfig} from '../../lib/common-config.mjs';
import {commonConfigInit} from '../../lib/common-config.mjs';
import InputMgr from '../../lib/input-mgr.mjs';
import {SemVer} from '../../lib/semver.mjs';
import OutOfSyncError from '../../lib/sync-check.mjs';
import TypesInputParser from '../../lib/types-input-parser.mjs';
import {GenChangelogOutput, GenChangelogOutputMgr} from './output-mgr.mjs';

interface Inputs extends OptPick<CommonConfig, 'breaking-change-keywords' | 'minor-types' | 'patch-types' | 'trivial-types' | 'stay-at-zero'> {
  'last-tag'?: SemVer;

  from?: string;

  until?: string;
}

(async function semanticReleaseLiteChangelogGeneratorAction() {
  const typeInpParser = new TypesInputParser<Inputs>();

  const inputs = new InputMgr<Inputs>({
    ...commonConfigInit(typeInpParser),
    from: String,
    'last-tag'() {
      const t = getInput('last-tag');
      if (t) {
        return SemVer.parse(t);
      }
    },
    until: String,
  });
  inputs.load();

  const loader = new CommitLoader(inputs['from'], inputs['until']);
  await loader.load();

  const output = new GenChangelogOutputMgr();
  output.set(GenChangelogOutput.CommitCount, loader.totalCount);
  output.set(GenChangelogOutput.RelevantCommitCount, loader.relevantCount);

  const parser = new CommitParser(loader, typeInpParser, inputs);
  parser.parse();
  output.set(GenChangelogOutput.ReleaseType, parser.releaseType);
  if (parser.hasIssuesClosed) {
    output.set(GenChangelogOutput.IssuesClosed, [...parser.issuesClosed()].join(','));
  } else {
    debug('No issues closed');
  }

  const changelogGen = new ChangelogGenerator(parser, typeInpParser, inputs);
  await changelogGen.generate(inputs['last-tag']);
  output.set(GenChangelogOutput.Changelog, changelogGen.result);

  try {
    await OutOfSyncError.check();
    output.set(GenChangelogOutput.InSync, true);
  } catch {
    // out of sync
  }

  if (parser.releaseType && output.has(GenChangelogOutput.InSync)) {
    output.set(GenChangelogOutput.ShouldRelease, true);
  }

  output.log().flush();
})().catch((e: Error) => {
  setFailed(e.message);
});
