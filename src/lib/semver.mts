import {info, notice} from '@actions/core';
import CommitParser from './commit-parser.mjs';
import {exec} from './exec.mjs';
import ReleaseType = CommitParser.ReleaseType;

type ResolveNextReleaseSpec = SemVer.ResolveNextReleaseSpec;

class SemVer {
  public major: number;

  #minor?: number;

  #patch?: number;

  public constructor(major?: number | string, minor?: number | string, patch?: number | string, public prefixed = true) {
    this.major = fmtNum(major) ?? 0;
    this.#minor = fmtNum(minor);
    this.#patch = fmtNum(patch);
  }

  public static cmp(a: SemVer | undefined, b: SemVer | undefined): 1 | 0 | -1 {
    if (a == null) {
      return b == null ? 0 : -1;
    } else if (b == null) {
      return -1;
    }

    return cmpNum(a.major, b.major) ?? cmpNum(a.#minor, b.#minor) ?? cmpNum(a.#patch, b.#patch) ?? 0;
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
      raw = await exec(`git tag --list`, `getting last tag`, false);
    } catch {
      return; // no tags created yet
    }
    if (!raw) {
      return; // same
    }

    const semvers = raw.split(/\r?\n/g).map(v => SemVer.parse(v, true));
    semvers.sort(SemVer.cmp);

    if (semvers[0]) {
      info(`Last tag resolved to ${semvers[0]}`);

      return semvers[0];
    }
  }

  public static resolveNextRelease({lastTag, releaseType, stayAtZero}: ResolveNextReleaseSpec): SemVer {
    if (lastTag) {
      return releaseType ? lastTag.materialise().increment(releaseType, stayAtZero) : lastTag;
    } else if (stayAtZero) {
      return releaseType === ReleaseType.Patch
        ? new SemVer(0, 0, 1)
        : new SemVer(0, 1, 0);
    }

    return new SemVer(1, 0, 0);
  }

  public get minor(): number {
    return this.#minor ?? 0;
  }

  public set minor(value: number | undefined) {
    this.#minor = value;
  }

  public get patch(): number {
    return this.#patch ?? 0;
  }

  public set patch(value: number | undefined) {
    this.#patch = value;
  }

  public computeReleaseType(lastTag: SemVer = new SemVer(0, 0, 0)): ReleaseType | undefined {
    if (this.major > lastTag.major) {
      return ReleaseType.Major;
    } else if (this.minor > lastTag.minor) {
      return ReleaseType.Minor;
    } else if (this.patch > lastTag.patch) {
      return ReleaseType.Patch;
    }
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
          this.minor = 0;
        }
        this.patch = 0;
        break;
      case ReleaseType.Minor:
        if (this.major === 0 && !stayAtZero) {
          this.major = 1;
          this.minor = 0;
        } else {
          ++this.minor;
        }
        this.patch = 0;
        break;
      case ReleaseType.Patch:
        ++this.patch;
        break;
      default:
        throw new TypeError(`Unrecognised release type: ${releaseType as any}`);
    }

    return this;
  }

  /** Clone & ensure the prefix & all major/minor/patch versions are set */
  public materialise(): SemVer {
    return new SemVer(this.major, this.minor, this.patch);
  }

  public toString(): string {
    return `${this.prefixed ? 'v' : ''}${[this.major, this.#minor, this.#patch].filter(isNotNullish).join('.')}`;
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

function isNotNullish<T>(v: T | null | undefined): v is Exclude<T, null | undefined> {
  return v != null;
}

function fmtNum(num: number | string | undefined): number | undefined {
  if (num != null) {
    return isNaN(num as any) ? 0 : Number(num);
  }
}

function cmpNum(a: number | undefined, b: number | undefined): 1 | -1 | undefined {
  if (a == null) {
    return b == null ? undefined : 1;
  } else if (b == null) {
    return -1;
  }

  if (a > b) {
    return -1;
  } else if (a < b) {
    return 1;
  }
}
