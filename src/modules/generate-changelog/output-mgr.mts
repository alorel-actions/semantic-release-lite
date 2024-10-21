import OutputMgr from '../../lib/output-mgr.mjs';

export const enum GenChangelogOutput {
  Changelog = 'changelog',
  ReleaseType = 'release-type',
  CommitCount = 'commit-count',
  IssuesClosed = 'issues-closed',
  RelevantCommitCount = 'relevant-commit-count',
  InSync = 'in-sync',
  NextVersion = 'next-version',
  ShouldRelease = 'should-release',
}

type Numerics = GenChangelogOutput.CommitCount | GenChangelogOutput.RelevantCommitCount;
type Booleans = GenChangelogOutput.InSync | GenChangelogOutput.ShouldRelease;
type NonStrings = Numerics | Booleans;
type TypeMap = Record<Exclude<GenChangelogOutput, NonStrings>, string>
  & Record<Numerics, number> & Record<Booleans, boolean>;

const mgr = OutputMgr as typeof OutputMgr<GenChangelogOutput, TypeMap>;

export {mgr as GenChangelogOutputMgr};
