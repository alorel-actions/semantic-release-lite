import {kebabCase} from 'lodash-es';
import {ChangelogGeneratorStrings as Strings} from '../changelog-generator.mjs';
import type {SemVer} from '../tag-parsing.mjs';

type Commit = import('../types-input-parser.mjs').default.Commit;
type HeadingData = import('../types-input-parser.mjs').default.HeadingData;
type BreakingChange = import('../commit-parser.mjs').default.BreakingChange;

/** Common log formatting code */
export abstract class AbstractCommitFormatter<T>
  implements Iterator<string, void, string>, IterableWithIterableIterator<string> {

  readonly #data: readonly T[];

  #i = 0;

  protected constructor(heading: string, data: Arrayish<T>) {
    this.#data = data;
    Object.defineProperty(this, Symbol.toStringTag, {value: `${heading} formatter`});
  }

  public static fmtId(nextRelease: SemVer, suffix: string) {
    return `${nextRelease}-${kebabCase(suffix)}` as const;
  }

  /** Format a single element */
  protected abstract iter(item: T): string;

  public [Symbol.iterator](): IterableIterator<string> {
    return this;
  }

  public next(): IteratorResult<string, void> {
    if (this.#i >= this.#data.length) {
      return {done: true} satisfies Partial<IteratorResult<string>> as IteratorResult<string>;
    }

    const value = this.iter(this.#data[this.#i]);
    ++this.#i; // only increment on successful iteration

    return {done: false, value};
  }
}

/** Commit formatting */
export class CommitFormatter extends AbstractCommitFormatter<Commit> {
  readonly #nextRelease: SemVer;

  public constructor(data: OptPick<HeadingData, 'heading' | 'commits'>, nextRelease: SemVer) {
    super(data.heading, data.commits);
    this.#nextRelease = nextRelease;
  }

  protected override iter({sha, scope, message, issuesClosed, breaking}: Commit): string {
    let value = `- ${sha} `;

    if (breaking) {
      value += `[:exclamation:](#${AbstractCommitFormatter.fmtId(this.#nextRelease, Strings.BreakingChangesHeader)}-${sha}) `;
    }

    if (scope) {
      value += `**${scope}**: `;
    }

    value += message;

    if (issuesClosed) {
      const iter = issuesClosed[Symbol.iterator]();
      value += ` [#${iter.next().value!}`;

      for (const item of iter) {
        value += `, #${item}`;
      }

      value += ']';
    }

    return value;
  }
}

/** Breaking change section item formatting */
export class BreakingChangeFormatter extends AbstractCommitFormatter<BreakingChange> {
  readonly #baseId: string;

  public constructor(data: Arrayish<BreakingChange>, nextRelease: SemVer) {
    super(Strings.BreakingChangesHeader, data);
    this.#baseId = AbstractCommitFormatter.fmtId(nextRelease, Strings.BreakingChangesHeader);
  }

  protected override iter({message, sha}: BreakingChange): string {
    return `<a name="${this.#baseId}-${sha}"></a> ${message}`;
  }
}
