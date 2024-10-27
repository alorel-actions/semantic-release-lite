import {info} from '@actions/core';
import type {CommitMetadata} from './commit-loader.mjs';
import CommitLoader from './commit-loader.mjs';
import {CommonConfig} from './common-config.mjs';
import TypesInputParser from './types-input-parser.mjs';
import {OutputGroup} from './util-decorators.mjs';

type Type = import('./types-input-parser.mjs').default.Type;
type HeadingData = import('./types-input-parser.mjs').default.HeadingData;
type Commit = import('./types-input-parser.mjs').default.Commit;

/** Parse commit messages for metadata */
class CommitParser {
  /** Breaking change messages */
  readonly #breakingChanges: CommitParser.BreakingChange[] = [];

  readonly #cfg: Readonly<CommonConfig>;

  #hasIssuesClosed = false;

  readonly #loader: CommitLoader;

  #releaseType?: CommitParser.ReleaseType;

  readonly #typeHeadingMap: ReadonlyMap<Type, HeadingData>;

  /** Commits where the type is unknown */
  readonly #unknownTypeCommits: Commit[] = [];

  public constructor(
    loader: CommitLoader,
    typeInputs: Pick<TypesInputParser<any>, 'typeHeadingMap'>,
    cfg: Readonly<CommonConfig>
  ) {
    this.#typeHeadingMap = typeInputs.typeHeadingMap;
    this.#loader = loader;
    this.#cfg = cfg;
  }

  /** Detected breaking changes in commits' extended messages */
  public get breakingChanges(): readonly Readonly<CommitParser.BreakingChange>[] {
    return this.#breakingChanges;
  }

  /** Whether at least one issue got closed by any of the parsed commits */
  public get hasIssuesClosed(): boolean {
    return this.#hasIssuesClosed;
  }

  /** Reference to the commit loader */
  public get loader(): Omit<CommitLoader, 'load'> {
    return this.#loader;
  }

  /** The resolved released type */
  public get releaseType(): CommitParser.ReleaseType | undefined {
    return this.#releaseType;
  }

  private set releaseType(v: CommitParser.ReleaseType | undefined) {
    switch (v) {
      case CommitParser.ReleaseType.Major:
      case undefined:
        this.#releaseType = v;
        break;
      case CommitParser.ReleaseType.Minor:
        if (this.#releaseType !== CommitParser.ReleaseType.Major) {
          this.#releaseType = v;
        }
        break;
      case CommitParser.ReleaseType.Patch:
        if (!this.#releaseType) {
          this.#releaseType = v;
        }
    }
  }

  /** Commits that followed the regex, but didn't match any commit types passed as input */
  public get unknownTypeCommits(): readonly TypesInputParser.Commit[] {
    return this.#unknownTypeCommits;
  }

  /** Iterator over issues closed by this parse */
  public* issuesClosed(): IterableIterator<number> {
    if (!this.#hasIssuesClosed) {
      return;
    }

    const dedupe = new Set<number>();
    for (const {issuesClosed} of this.#commits()) {
      if (!issuesClosed) {
        continue;
      }

      for (const num of issuesClosed) {
        if (dedupe.has(num)) {
          continue;
        }

        dedupe.add(num);
        yield num;
      }
    }
  }

  @OutputGroup('Commits parse')
  public parse(): void {
    for (const meta of this.#loader) {
      const headingData = this.#typeHeadingMap.get(meta.type);
      const formattedCommit = this.#metaToCommit(meta);
      let tags: string[];

      if (headingData) {
        headingData.commits.push(formattedCommit);
        tags = [`OK type: ${formattedCommit.type}`];
      } else {
        tags = [`Unknown type: ${formattedCommit.type}`];
        this.#unknownTypeCommits.push(formattedCommit);
      }

      if (formattedCommit.issuesClosed) {
        this.#hasIssuesClosed = true;
        tags.push(`issues closed: ${[...formattedCommit.issuesClosed].join(', ')}`);
      }

      if (formattedCommit.breaking) {
        this.releaseType = CommitParser.ReleaseType.Major;
        tags.push('BREAKING');
        this.#breakingChanges.push({
          message: meta.breaking!,
          sha: formattedCommit.sha,
        });
      } else if (this.#cfg['minor-types'].has(formattedCommit.type)) {
        this.releaseType = CommitParser.ReleaseType.Minor;
        tags.push('MINOR');
      } else if (this.#cfg['patch-types'].has(formattedCommit.type)) {
        tags.push('PATCH');
        this.releaseType = CommitParser.ReleaseType.Patch;
      }

      info(`[${tags.join('; ')}] ${formattedCommit.message}`);
    }
  }

  /** Joined iterator over commits from `typeHeadingMap` and `unknownTypeCommits` */
  * #commits(): Generator<Commit> {
    for (const data of this.#typeHeadingMap.values()) {
      for (const commit of data.commits) {
        yield commit;
      }
    }
    for (const commit of this.#unknownTypeCommits) {
      yield commit;
    }
  }

  /** Convert commit metadata to a formatted, parsed {@link Commit} */
  #metaToCommit(meta: OptReadonly<CommitMetadata>): Commit {
    const out: Commit = {
      message: meta.message,
      scope: meta.scope,
      sha: meta.sha,
      type: meta.type,
    };

    if (meta.closes) {
      out.issuesClosed = new Set<number>(meta.closes.split(/,\s*/g).map(v => parseInt(v.slice(1))));
    }

    if (meta.breaking) {
      out.breaking = true;
    }

    return out;
  }
}

namespace CommitParser {
  export interface BreakingChange {
    message: string;

    sha: string;
  }

  export const enum ReleaseType {
    Major = 'major',
    Minor = 'minor',
    Patch = 'patch',
  }
}

export default CommitParser;
