import OutputMgr from '../../lib/output-mgr.mjs';

export const enum GenChangelogOutput {
  Changelog = 'changelog',
  ReleaseType = 'release-type',
  CommitCount = 'commit-count',
  IssuesClosed = 'issues-closed',
  RelevantCommitCount = 'relevant-commit-count',
}

type Numerics = GenChangelogOutput.CommitCount | GenChangelogOutput.RelevantCommitCount;
type NonStrings = Numerics;
type TypeMap = Record<Exclude<GenChangelogOutput, NonStrings>, string> & Record<Numerics, number>;

const mgr = OutputMgr as typeof OutputMgr<GenChangelogOutput, TypeMap>;

export {mgr as GenChangelogOutputMgr};
