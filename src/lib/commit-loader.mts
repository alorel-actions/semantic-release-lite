import {info} from '@actions/core';
import {NULL_ITERATOR} from './consts.mjs';
import {exec} from './exec.mjs';
import {SemVer} from './semver.mjs';
import {OutputGroup} from './util-decorators.mjs';

export interface CommitMetadata {
  breaking?: string;

  closes?: string;

  message: string;

  scope?: string;

  sha: string;

  type: string;
}

export interface CommitLoaderInit {
  breakingChangeKeywords?: string[];

  from?: SemVer | string | null;

  until?: SemVer | string | null;
}

/** Load commits from git log */
export default class CommitLoader implements IterableWithIterableIterator<OptReadonly<CommitMetadata>> {
  readonly #ref: string;

  readonly #regex: RegExp;

  #relevant?: Array<CommitMetadata>;

  #totalCount = 0;

  public constructor(init: CommitLoaderInit = {}) {
    this.#regex = buildRegex(init.breakingChangeKeywords?.length ? init.breakingChangeKeywords : ['BREAKING CHANGE']);

    if (init.from) {
      this.#ref = ` ${init.from}..${init.until || 'HEAD'}`;
    } else if (init.until) {
      this.#ref = ` ${init.until}`;
    } else {
      this.#ref = '';
    }
  }

  /** Number of commits that'll show up in the changelog */
  public get relevantCount(): number {
    return this.#relevant?.length ?? 0;
  }

  /** Total number of commits parsed */
  public get totalCount(): number {
    return this.#totalCount;
  }

  public [Symbol.iterator](): IterableIterator<OptReadonly<CommitMetadata>> {
    return this.#relevant?.[Symbol.iterator]() ?? NULL_ITERATOR;
  }

  @OutputGroup('Commits load')
  public async load(): Promise<void> {
    this.#totalCount = 0;
    this.#relevant = undefined;

    const shas = await getCommitSHAs(this.#ref);
    info(`Resolved ${shas.length.toLocaleString()} commit ${shas.length === 1 ? 'SHA' : 'SHAs'}:\n`);
    this.#totalCount = shas.length;

    const relevant = (await Promise.all(shas.map(this.#loadCommit, this)))
      .filter(Boolean as unknown as (v: any) => v is CommitMetadata);

    if (relevant.length) {
      this.#relevant = relevant;
    }

    const rCount = this.relevantCount;
    info(`\n${rCount.toLocaleString()} of which ${rCount === 1 ? 'is' : 'are'} relevant.`);
  }

  /** Load extended data on a single commit by commit SHA */
  async #loadCommit(sha: string): Promise<CommitMetadata | undefined> {
    const fullMessage = await exec(`git log -1 --pretty=format:%B ${sha}`, `getting commit message for ${sha}`);
    const firstLine = fullMessage.split(/\r?\n/)[0].trim();
    const match = this.#regex.exec(fullMessage)?.groups;

    if (!match) {
      info(`[skip: format] ${firstLine}`);
      return;
    }

    info(`[ok] ${firstLine}`);

    return {
      breaking: match.breaking,
      closes: match.closes,
      message: match.message,
      scope: match.scope,
      sha,
      type: match.type,
    };
  }
}

/** Parse git log and output list of commit SHAs */
async function getCommitSHAs(tagArg: string): Promise<string[]> {
  return (await exec(`git log${tagArg} --reverse --pretty=format:%H`, 'getting commit SHAs'))
    .split(/\r?\n/g)
    .map(m => m.trim());
}

function buildRegex(breakingKeywords: string[]): RegExp {
  const ty = '(?<type>[^:\\(]+)';
  const scope = '\\((?<scope>[^\\)]+)\\)';
  const tyAndScope = `${ty}(${scope})?:\\s*`;
  const line1 = `${tyAndScope}(?<message>[^\\r\\n]+)\\n*`;

  const closesSection = '(Closes\\s+(?<closes>#[^\\n]+)\\n*)?';
  const breakingSection = `(${buildBreakingChangeReg(breakingKeywords)}:\\s+(?<breaking>.+))?`;

  return new RegExp(`^${line1}${closesSection}${breakingSection}$`, 'i');
}

function buildBreakingChangeReg(keywords: string[]): string {
  return `(${keywords.join('|')})s?`;
}
