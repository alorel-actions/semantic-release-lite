import {getMultilineInput} from '@actions/core';
import type {CommitMetadata} from './commit-loader.mjs';
import {Numbers} from './consts.mjs';

type Type = TypesInputParser.Type;
type HeadingData = TypesInputParser.HeadingData;

/** Parser for `minor-types`, `patch-types`, `trivial-types` */
class TypesInputParser<T> {
  readonly #typeHeadingMap = new Map<Type, HeadingData>();

  /** Mapping of types to their headings & commits */
  public get typeHeadingMap(): ReadonlyMap<Type, HeadingData> {
    return this.#typeHeadingMap;
  }

  /** Create a parser for the given input name */
  public createParser(inputName: string & TypedKeys<T, Set<string>>): () => Set<string> {
    return () => this.parseInput(inputName);
  }

  /** Parse an input with the given name */
  public parseInput(name: string & TypedKeys<T, Set<string>>): Set<string> {
    const regex = /^\s*([^:]+):\s*([^\n]+)$/;
    const out = new Set<string>();

    for (const [lineIdx, line] of getMultilineInput(name).entries()) {
      const match = line.match(regex);
      const type = match?.[1];
      const heading = match?.[2];

      if (!type || !heading) {
        throw new Error(`[${name}] Error parsing line at index ${lineIdx}, "${line}": doesn't match regex ${regex.source}`);
      } else if (this.#typeHeadingMap.has(type)) {
        throw new Error(`[${name}] Duplicate type "${type}" at ${name} index ${lineIdx}`);
      }

      out.add(type);
      this.#typeHeadingMap.set(type, {
        commits: [],
        depth: Numbers.DEFAULT_HEADING_DEPTH,
        heading,
      });
    }

    return out;
  }
}

namespace TypesInputParser {
  export type Type = string;
  export type Heading = string;

  export interface HeadingData {
    commits: Commit[];

    depth: number;

    heading: Heading;
  }

  export interface Commit extends OptPick<CommitMetadata, 'message' | 'scope' | 'sha' | 'type'> {
    breaking?: true;

    issuesClosed?: Set<number>;
  }
}

export default TypesInputParser;
