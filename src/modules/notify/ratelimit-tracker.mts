import type {IssuesClient} from './processor.mjs';

type GetResponse = Awaited<ReturnType<IssuesClient['get']>>;

export interface ErrorResponse {
  response: {
    headers: GetResponse['headers'];
    url: string;
    status: number;
  };
}

interface Response<T = any> extends Pick<GetResponse, 'headers'> {
  data: T;
}

export class RatelimitTracker {
  #remaining = Number.MAX_SAFE_INTEGER;

  #reset = new Date();

  public get humanisedWait(): string {
    return new Date(this.millisUntilReset).toISOString().slice(11, 19);
  }

  public get millisUntilReset(): number {
    return Math.max(Math.ceil(this.#reset.getTime() - Date.now()), 0);
  }

  public get resetIso(): string {
    return this.#reset.toISOString();
  }

  public get wasUsed(): boolean {
    return this.#remaining !== Number.MAX_SAFE_INTEGER;
  }

  /** @return #remaining ratelimit */
  public async process(response: Promise<Response>): Promise<number> {
    return this.updateFromHeaders((await response).headers);
  }

  /** @return #remaining ratelimit */
  public updateFromHeaders(headers: GetResponse['headers']): number {
    this.#remaining = parseInt(headers['x-ratelimit-remaining']!);
    this.#reset = new Date(parseInt(headers['x-ratelimit-reset']!) * 1000);

    return this.#remaining;
  }
}
