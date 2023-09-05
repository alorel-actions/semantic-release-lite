import {debug, setFailed} from '@actions/core';
import ChangelogGenerator from '../../lib/changelog-generator.mjs';
import CommitLoader from '../../lib/commit-loader.mjs';
import CommitParser from '../../lib/commit-parser.mjs';
import type {CommonConfig} from '../../lib/common-config.mjs';
import {commonConfigInit} from '../../lib/common-config.mjs';
import InputMgr, {InputMgrInit} from '../../lib/input-mgr.mjs';
import TypesInputParser from '../../lib/types-input-parser.mjs';
import {GenChangelogOutput, GenChangelogOutputMgr} from './output-mgr.mjs';

interface Inputs extends OptPick<CommonConfig, 'breaking-change-keywords' | 'minor-types' | 'patch-types' | 'trivial-types'> {
  from?: string;

  until?: string;
}

(async function semanticReleaseLiteChangelogGeneratorAction() {
  const typeInpParser = new TypesInputParser<Inputs>();
  const commonCfgInit = commonConfigInit(typeInpParser) as Partial<InputMgrInit<CommonConfig>>;
  delete commonCfgInit['stay-at-zero'];

  const inputs = new InputMgr<Inputs>({
    ...commonCfgInit as InputMgrInit<CommonConfig>,
    from: String,
    until: String,
  });
  inputs.load();

  const loader = new CommitLoader(inputs['from'], inputs['until']);
  await loader.load();

  const output = new GenChangelogOutputMgr();
  output.set(GenChangelogOutput.CommitCount, loader.totalCount);
  output.set(GenChangelogOutput.RelevantCommitCount, loader.relevantCount);

  const commonInputs: CommonConfig = {
    'breaking-change-keywords': inputs['breaking-change-keywords'],
    'minor-types': inputs['minor-types'],
    'patch-types': inputs['patch-types'],
    'stay-at-zero': false,
    'trivial-types': inputs['trivial-types'],
  };
  const parser = new CommitParser(loader, typeInpParser, commonInputs);
  parser.parse();
  output.set(GenChangelogOutput.ReleaseType, parser.releaseType);
  if (parser.hasIssuesClosed) {
    output.set(GenChangelogOutput.IssuesClosed, [...parser.issuesClosed()].join(','));
  } else {
    debug('No issues closed');
  }

  const changelogGen = new ChangelogGenerator(parser, typeInpParser, commonInputs);
  await changelogGen.generate();
  output.set(GenChangelogOutput.Changelog, changelogGen.result);

  output.log().flush();
})().catch((e: Error) => {
  setFailed(e.message);
});
