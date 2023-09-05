import {warning} from '@actions/core';
import {context, getOctokit} from '@actions/github';
import {constant} from 'lodash-es';
import {Strings} from '../../lib/consts.mjs';
import {LimitedProgress, Progress} from '../../lib/progress.mjs';
import {OutputGroup} from '../../lib/util-decorators.mjs';
import {NotifyInputs} from './index.mjs';
import {ErrorResponse, RatelimitTracker} from './ratelimit-tracker.mjs';

const enum Numbers {
  ProgressPerIssue = 2,
}

const enum NofifStrings {
  IssueNumberPH = '{{issueNumber}}',
}

export type IssuesClient = ReturnType<typeof getOctokit>['rest']['issues'];

export class NotifyProcessor {
  static readonly #REPO = context.repo;

  readonly #client: IssuesClient;

  readonly #formatBaseMsg: (issueNumber: string) => string;

  readonly #labelsJoined: string;

  readonly #progress: Progress;

  readonly #rateLimit = new RatelimitTracker();

  #shouldCheckProgressRemaining = false;

  public constructor(protected readonly inputs: OptReadonly<NotifyInputs>) {
    this.#progress = new Progress(inputs.issues!.size * Numbers.ProgressPerIssue);
    this.#client = getOctokit(inputs['gh-token']).rest.issues;
    this.#labelsJoined = `${inputs.labels.join(', ')} label${inputs.labels.length > 1 ? 's' : ''}`;

    const baseMsg = inputs.comment
      .replaceAll('{{releaseUrl}}', '{{baseUrl}}/releases/tag/{{tag}}')
      .replaceAll('{{baseUrl}}', `https://github.com/{{owner}}/{{repo}}`)
      .replaceAll('{{tag}}', inputs.tag)
      .replaceAll('{{owner}}', NotifyProcessor.#REPO.owner)
      .replaceAll('{{repo}}', NotifyProcessor.#REPO.repo);

    this.#formatBaseMsg = baseMsg.includes(NofifStrings.IssueNumberPH)
      ? (issueNumber => baseMsg.replaceAll(NofifStrings.IssueNumberPH, issueNumber))
      : constant(baseMsg);
  }

  @OutputGroup<NotifyProcessor>(function(this: NotifyProcessor) {
    return `Processing ${this.inputs.issues!.size.toLocaleString()} issues.`;
  })
  public async process(): Promise<void> {
    for (const issueNumber of this.inputs.issues!) {
      try {
        await this.#processOne(issueNumber, this.#progress.limitedProgress(Numbers.ProgressPerIssue));
      } catch (e) {
        let rl: RatelimitError;
        if (e instanceof RatelimitError) {
          rl = e;
        } else if (isRatelimitResponse(e)) {
          this.#rateLimit.updateFromHeaders(e.response.headers);
          rl = new RatelimitError(this.#rateLimit, e);
        } else {
          throw e;
        }

        if (this.inputs['error-on-ratelimit']) {
          throw rl;
        }

        warning(rl.message);
        break;
      }

      this.inputs.issues!.delete(issueNumber);
    }
  }

  async #processOne(issueNumber: string, progress: LimitedProgress): Promise<void> {
    if (!progress.satisfiable) {
      throw new RatelimitError(this.#rateLimit);
    }

    if (!/^\d+$/.test(issueNumber)) {
      progress.drain();
      this.#progress.warn(`Invalid issue number: ${issueNumber}`);
      return;
    }

    const issueNumberParams = {
      ...NotifyProcessor.#REPO,
      issue_number: Number(issueNumber),
    } satisfies Parameters<IssuesClient['get']>[0];

    await this.#rateLimit.process(this.#client.addLabels({
      ...issueNumberParams,
      labels: this.inputs.labels,
    }));
    if (!progress.decrement(`[#${issueNumber}] Added ${this.#labelsJoined}`)) {
      throw new RatelimitError(this.#rateLimit);
    }

    await this.#rateLimit.process(this.#client.createComment({
      ...issueNumberParams,
      body: `${this.#formatBaseMsg(issueNumber)}\n\n${Strings.Signature}`,
    }));
    progress.decrement(`[#${issueNumber}] Added comment`);

    if (this.#shouldCheckProgressRemaining && progress.remaining) {
      this.#shouldCheckProgressRemaining = false;
      warning(`Still got ${progress.remaining} permit(s) remaining.`);
    }
  }
}

class RatelimitError extends Error {
  public constructor(tracker: RatelimitTracker, cause?: any) {
    super(`GitHub API rate limit exceeded for this token. Resets in ${tracker.humanisedWait} (${tracker.resetIso})`);
    this.name = 'RatelimitError';
    if (cause) {
      this.cause = cause;
    }
  }
}

function isRatelimitResponse(e: any): e is ErrorResponse {
  return (e as ErrorResponse)?.response?.headers !== undefined;
}

