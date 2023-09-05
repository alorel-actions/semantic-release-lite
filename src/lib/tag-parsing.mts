import {info, notice} from '@actions/core';
import CommitParser from './commit-parser.mjs';
import {exec} from './exec.mjs';

import ReleaseType = CommitParser.ReleaseType;

type ResolveNextReleaseSpec = SemVer.ResolveNextReleaseSpec;

class SemVer {
  public major: number;

  public minor: number;

  public patch: number;

  public constructor(major?: number | string, minor?: number | string, patch?: number | string, public prefixed = true) {
    this.major = isNaN(major as any) ? 0 : Number(major);
    this.minor = isNaN(minor as any) ? 0 : Number(minor);
    this.patch = isNaN(patch as any) ? 0 : Number(patch);
  }

  public static parse(from: string, allowStrippingVPrefix = false): SemVer | undefined {
    const gr = from.match(/^\s*(?<v>v)?(?<major>\d+)(\.(?<minor>\d+)(\.(?<patch>\d+))?)?\s*$/)?.groups;
    if (!gr) {
      return;
    }

    return new SemVer(gr.major, gr.minor, gr.patch, Boolean(gr.v) || !allowStrippingVPrefix);
  }

  public static async resolveLastRelease(): Promise<SemVer | undefined> {
    let raw: string;
    try {
      raw = await exec(`git tag --list --sort=-committerdate`, `getting last tag`, false);
    } catch {
      return; // no tags created yet
    }
    if (!raw) {
      return; // same
    }

    for (const candidate of raw.split(/\r?\n/g)) {
      const semver = SemVer.parse(candidate, true);
      if (semver) {
        info(`Last tag resolved to ${semver}`);

        return semver;
      }
    }
  }

  public static resolveNextRelease({lastTag, releaseType, stayAtZero}: ResolveNextReleaseSpec): SemVer {
    if (lastTag) {
      return releaseType ? lastTag.clone().increment(releaseType, stayAtZero) : lastTag;
    } else if (stayAtZero) {
      return releaseType === ReleaseType.Patch
        ? new SemVer(0, 0, 1)
        : new SemVer(0, 1);
    }

    return new SemVer(1);
  }

  public clone(): SemVer {
    return new SemVer(this.major, this.minor, this.patch);
  }

  public increment(releaseType: ReleaseType, stayAtZero = false): this {
    switch (releaseType) {
      case ReleaseType.Major:
        // If we've been configured to keep the version at `0.x` we'll only increment the minor version on breaking changes
        if (stayAtZero && this.major === 0) {
          ++this.minor;
        } else {
          notice(`stay-at-zero has no effect as we're already on version ${this}`);
          ++this.major;
        }
        break;
      case ReleaseType.Minor:
        ++this.minor;
        break;
      case ReleaseType.Patch:
        ++this.patch;
        break;
      default:
        throw new TypeError(`Unrecognised release type: ${releaseType as any}`);
    }

    return this;
  }

  public toString(): VersionStr | VersionNum {
    return `${this.prefixed ? 'v' : ''}${this.major}.${this.minor}.${this.patch}`;
  }
}

namespace SemVer {
  export interface ResolveNextReleaseSpec {
    lastTag?: SemVer;

    releaseType: ReleaseType | undefined;

    stayAtZero: boolean;
  }
}

export {SemVer};
