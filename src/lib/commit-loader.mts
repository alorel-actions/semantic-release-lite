import {info} from '@actions/core';
import {NULL_ITERATOR} from './consts.mjs';
import {exec} from './exec.mjs';
import {SemVer} from './tag-parsing.mjs';
import {OutputGroup} from './util-decorators.mjs';

export interface CommitMetadata {
  extendedMessage?: string;

  message: string;

  scope?: string;

  sha: string;

  type: string;
}

/** Load commits from git log */
export default class CommitLoader implements IterableWithIterableIterator<OptReadonly<CommitMetadata>> {
  readonly #ref: string;

  #relevant?: Array<CommitMetadata>;

  #totalCount = 0;

  public constructor(from?: SemVer | string | null, until?: SemVer | string | null) {
    if (from) {
      this.#ref = ` ${from}..${until ?? 'HEAD'}`;
    } else if (until) {
      this.#ref = ` ${until}^..HEAD`;
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

    const relevant = (await Promise.all(shas.map(loadCommit)))
      .filter(Boolean as unknown as (v: any) => v is CommitMetadata);

    if (relevant.length) {
      this.#relevant = relevant;
    }

    const rCount = this.relevantCount;
    info(`\n${rCount.toLocaleString()} of which ${rCount === 1 ? 'is' : 'are'} relevant.`);
  }
}

/** Load extended data on a single commit by commit SHA */
async function loadCommit(sha: string): Promise<CommitMetadata | undefined> {
  const fullMessage = await exec(`git log -1 --pretty=format:%B ${sha}`, `getting commit message for ${sha}`);
  const firstLine = fullMessage.split(/\r?\n/)[0].trim();
  const match = fullMessage.match(/^([^:(]+)(\(([^)]+)\))?:\s*([^\n]+)(\n\s+.+)?/);

  if (!match) {
    info(`[skip: format] ${firstLine}`);
    return;
  }

  let [, type, , scope, message, extendedMessage] = match;
  scope = scope?.trim();
  extendedMessage = extendedMessage?.trim();

  const out: CommitMetadata = {message: message.trim(), sha, type: type.trim()};

  if (scope) {
    out.scope = scope;
  }
  if (extendedMessage) {
    out.extendedMessage = extendedMessage;
  }

  info(`[ok] ${firstLine}`);

  return out;
}

/** Parse git log and output list of commit SHAs */
async function getCommitSHAs(tagArg: string): Promise<string[]> {
  return (await exec(`git log${tagArg} --reverse --pretty=format:%H`, 'getting commit SHAs'))
    .split(/\r?\n/g)
    .map(m => m.trim());
}
