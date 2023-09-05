import {info} from '@actions/core';
import OutputMgr from './lib/output-mgr.mjs';
import {SemVer} from './lib/tag-parsing.mjs';
import {OutputGroup} from './lib/util-decorators.mjs';

export const enum ReleaseOutputName {
  CommitCount = 'commit-count',
  RelevantCommitCount = 'relevant-commit-count',
  ReleaseType = 'release-type',
  NextVersion = 'next-version',
  LastTag = 'last-tag',
  Changelog = 'changelog',
  IsInSync = 'in-sync',
  IssuesClosed = 'issues-closed',
}

type NumericOutputs = ReleaseOutputName.CommitCount | ReleaseOutputName.RelevantCommitCount;
type NonStringOutputs = NumericOutputs | ReleaseOutputName.IsInSync;
type NumericVirtualOutputs = Exclude<VirtualOutputName, VirtualOutputName.ShouldRelease>;

const enum VirtualOutputName {
  ShouldRelease = 'should-release',
  NextVersionMajor = 'next-version-major',
  NextVersionMinor = 'next-version-minor',
  NextVersionPatch = 'next-version-patch',
}

type ExtendedOutName = ReleaseOutputName | VirtualOutputName;

type TypeMap = Record<NumericOutputs, number>
  & Record<ReleaseOutputName.IsInSync, boolean>
  & Record<Exclude<ReleaseOutputName, NonStringOutputs>, string>
  & Record<NumericVirtualOutputs, number>
  & Record<VirtualOutputName.ShouldRelease, boolean>;

export class ReleaseOutputMgr extends OutputMgr<ReleaseOutputName, TypeMap, ExtendedOutName> {

  @OutputGroup('Outputs')
  public override log(): this {
    let changelog: string | undefined;

    for (const [name, value] of this) {
      if (name === ReleaseOutputName.Changelog) {
        changelog = value as string;
      } else {
        this.logOne(name, value);
      }
    }

    if (changelog) {
      info(`${ReleaseOutputName.Changelog}:\n=====================\n${changelog}`);
    }

    return this;
  }

  protected override* virtualIter(): IterableIterator<[VirtualOutputName, OutputMgr.Value]> {
    if (this.has(ReleaseOutputName.ReleaseType, ReleaseOutputName.IsInSync)) {
      yield [VirtualOutputName.ShouldRelease, true];
    }
    const nextV = this.has(ReleaseOutputName.NextVersion) && SemVer.parse(this.get(ReleaseOutputName.NextVersion)!)!;

    if (!nextV) {
      return;
    }

    yield [VirtualOutputName.NextVersionMajor, nextV.major];
    yield [VirtualOutputName.NextVersionMinor, nextV.minor];
    yield [VirtualOutputName.NextVersionPatch, nextV.patch];
  }
}
