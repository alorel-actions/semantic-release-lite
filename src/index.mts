import {debug, isDebug, setFailed} from '@actions/core';
import ChangelogGenerator from './lib/changelog-generator.mjs';
import CommitLoader from './lib/commit-loader.mjs';
import CommitParser from './lib/commit-parser.mjs';
import {CommonConfig, commonConfigInit} from './lib/common-config.mjs';
import InputMgr from './lib/input-mgr.mjs';
import OutOfSyncError from './lib/sync-check.mjs';
import {SemVer} from './lib/semver.mjs';
import TypesInputParser from './lib/types-input-parser.mjs';
import {ReleaseOutputMgr, ReleaseOutputName} from './output-mgr.mjs';

(async function semanticReleaseLite() {
  const typeInpParser = new TypesInputParser<CommonConfig>();
  const inputs = new InputMgr<CommonConfig>(commonConfigInit(typeInpParser));
  inputs.load();

  const output = new ReleaseOutputMgr();

  const lastTag = await SemVer.resolveLastRelease();
  output.set(ReleaseOutputName.LastTag, lastTag?.toString());

  const loader = new CommitLoader(lastTag);
  await loader.load();
  output.set(ReleaseOutputName.CommitCount, loader.totalCount);
  output.set(ReleaseOutputName.RelevantCommitCount, loader.relevantCount);

  const parser = new CommitParser(loader, typeInpParser, inputs);
  parser.parse();
  if (parser.hasIssuesClosed) {
    output.set(ReleaseOutputName.IssuesClosed, [...parser.issuesClosed()].join(','));
  } else {
    debug('No issues closed');
  }

  const changelogGen = new ChangelogGenerator(parser, typeInpParser, inputs);
  await changelogGen.generate(lastTag);
  output.set(ReleaseOutputName.ReleaseType, changelogGen.nextVersion.computeReleaseType(lastTag));
  output.set(ReleaseOutputName.NextVersion, changelogGen.nextVersion.toString());
  output.set(ReleaseOutputName.Changelog, changelogGen.result);

  try {
    await OutOfSyncError.check();
    output.set(ReleaseOutputName.IsInSync, true);
  } catch {
    // out of sync
  }

  output.log().flush();
})()
  .catch((e: Error) => {
    setFailed(isDebug() ? (e.stack ?? e.message) : e.message);
  });
