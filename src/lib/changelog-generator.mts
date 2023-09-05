import {debug, info} from '@actions/core';
import {context} from '@actions/github';
import {AbstractCommitFormatter, BreakingChangeFormatter, CommitFormatter} from './changelog-generator/formatters.mjs';
import CommitParser from './commit-parser.mjs';
import {CommonConfig} from './common-config.mjs';
import {Numbers, Strings} from './consts.mjs';
import {LazyMap} from './lazy-map.mjs';
import {SemVer} from './tag-parsing.mjs';
import TypesInputParser from './types-input-parser.mjs';
import {OutputGroup} from './util-decorators.mjs';

type Heading = import('./types-input-parser.mjs').default.Heading;
type HeadingData = import('./types-input-parser.mjs').default.HeadingData;
type Type = import('./types-input-parser.mjs').default.Type;

const enum GenStrings {
  BreakingChangesHeader = 'Breaking Changes',
}

/** Generate changelog markdown */
class ChangelogGenerator {
  readonly #cfg: Readonly<CommonConfig>;

  readonly #commits: CommitParser;

  #nextVersion!: SemVer;

  #result!: string;

  readonly #typeHeadingMap: ReadonlyMap<Type, HeadingData>;

  public constructor(
    commits: CommitParser,
    typeInputs: TypesInputParser<any>,
    cfg: Readonly<CommonConfig>
  ) {
    this.#typeHeadingMap = typeInputs.typeHeadingMap;
    this.#commits = commits;
    this.#cfg = cfg;
  }

  /** The next version we resolved */
  public get nextVersion(): Readonly<Omit<SemVer, 'increment'>> {
    return this.#nextVersion;
  }

  /** Generated changelog */
  public get result(): string {
    return this.#result;
  }

  /** Text for the commit count */
  get #commitCountTxt(): string {
    const count = this.#commits.loader.totalCount;
    const plur = count === 1 ? '' : 's';

    return `${count.toLocaleString()} commit${plur}`;
  }

  /** `typeHeadingMap` merged with `unknownTypeCommits` */
  get #mergedHeadings(): IterableIterator<HeadingData> {
    type Part = OptOmit<HeadingData, 'commits'>;

    const perHeadingMap = new LazyMap<Heading, HeadingData, [Part]>((_, base) => ({
      ...base,
      commits: [],
    }));

    const prefix = '#'.repeat(Numbers.DEFAULT_HEADING_DEPTH);
    for (const headingData of this.#typeHeadingMap.values()) {
      perHeadingMap.getOrInsert(`${prefix} ${headingData.heading}`, headingData)
        .commits.push(...headingData.commits);
    }

    if (this.#commits.unknownTypeCommits.length) {
      perHeadingMap
        .getOrInsert(' Others', {
          depth: 0,
          heading: 'Others',
        })
        .commits
        .push(...this.#commits.unknownTypeCommits);
    }

    return perHeadingMap.values();
  }

  @OutputGroup('Changelog generation')
  public async generate(lastTag?: SemVer): Promise<void> {
    this.#result = '';
    this.#nextVersion = SemVer.resolveNextRelease({
      lastTag,
      releaseType: this.#commits.releaseType,
      stayAtZero: this.#cfg['stay-at-zero'],
    });

    info(`Next version resolved to ${this.#nextVersion}`);

    const iter = this.#segments();
    {
      const {done, value} = iter.next() as IteratorResult<string, string>;
      if (done) {
        return;
      }

      this.#result += value.trimStart();
    }

    for (const segment of iter) {
      this.#result += segment;
    }

    this.#result += '\n\n-----\n\n';

    if (lastTag) {
      const {owner, repo} = context.repo;
      const baselink = `https://github.com/${owner}/${repo}`;
      this.#result += `[${this.#commitCountTxt}](${baselink}/compare/${lastTag}...${this.#nextVersion} "Diff link") since the previous release, [${lastTag}](${baselink}/releases/tag/${lastTag} "Link to previous release").`;
    } else {
      this.#result += `${this.#commitCountTxt} in this release.`;
    }

    this.#result += `\n\n${Strings.Signature}`;
  }

  /** Iterator over both commit-esque messages and breaking changes */
  * #formattedHeadings(): IterableIterator<FormattedHeading> {
    for (const headingData of this.#mergedHeadings) {
      const partial: OptOmit<FormattedHeading, keyof HeadingData> = {
        messages: new CommitFormatter(headingData, this.#nextVersion),
      };

      yield Object.assign(headingData, partial);
    }

    if (this.#commits.breakingChanges.length) {
      yield {
        depth: 1,
        heading: `Breaking Changes`,
        icon: ':exclamation:',
        messages: new BreakingChangeFormatter(this.#commits.breakingChanges, this.#nextVersion),
        separatorLines: 2,
      };
    }
  }

  /** String segments of the changelog as they're getting generated */
  * #segments(): IterableIterator<string> {
    for (const headingData of this.#formattedHeadings()) {
      yield* (new Section(headingData, this.#nextVersion));
    }
  }
}

export default ChangelogGenerator;
export {GenStrings as ChangelogGeneratorStrings};

interface FormattedHeading extends OptOmit<HeadingData, 'commits'> {
  icon?: string;

  messages: IterableWithIterableIterator<string>;

  separatorLines?: number;
}

/** A changelog section getting generated as markdown */
class Section implements IterableWithIterableIterator<string> {
  readonly #data: FormattedHeading;

  readonly #nextRelease: SemVer;

  public constructor(data: FormattedHeading, nextRelease: SemVer) {
    this.#data = data;
    this.#nextRelease = nextRelease;
  }

  public* [Symbol.iterator](): IterableIterator<string> {
    debug(`Generating for ${this.#data.heading}`);
    const iter = this.#data.messages[Symbol.iterator]();

    {
      const {done, value} = iter.next() as IteratorResult<string, string>;
      if (done) {
        return info(`[skip: empty] ${this.#data.heading}`);
      }

      const headerId = AbstractCommitFormatter.fmtId(this.#nextRelease, this.#data.heading);
      const icon = this.#data.icon ?? ':link:';
      const link = `<a name="${headerId}" href="#${headerId}">${icon}</a>`;

      if (this.#data.depth) {
        const hashes = '#'.repeat(this.#data.depth);
        yield `\n\n${hashes} ${link} ${this.#data.heading}</a>\n\n${value}`;
      } else {
        yield `\n\n<details><summary>${link} ${this.#data.heading}</summary>\n\n${value}`;
      }
    }

    let count = 1;

    const sep = '\n'.repeat(this.#data.separatorLines ?? 1);
    for (const segment of iter) {
      yield `${sep}${segment}`;
      ++count;
    }

    if (!this.#data.depth) {
      yield '\n\n</details>';
    }

    const plural = count === 1 ? 'y' : 'ies';
    info(`Generated ${count.toLocaleString()} entr${plural} for ${this.#data.heading}`);
  }
}
