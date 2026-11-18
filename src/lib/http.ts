/** A failed request. The message is safe to log: it never holds the URL or a key. */
export class FetchError extends Error {
  constructor(
    message: string,
    /** Worth one more try: a timeout, a network error, rate limiting or a server error. */
    readonly retryable: boolean
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export interface GetJsonOptions {
  fetch?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
}

const USER_AGENT = 'cpl-website (+https://github.com/ElementalEngine/cpl-website)';

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

async function once(url: string, fetchFn: typeof fetch, timeoutMs: number): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new FetchError(isTimeout(error) ? 'timed out' : 'network error', true);
  }
  if (!response.ok) {
    const status = response.status;
    throw new FetchError(`HTTP ${status}`, status === 429 || status >= 500);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new FetchError(isTimeout(error) ? 'timed out' : 'response is not JSON', isTimeout(error));
  }
}

/** GET a JSON document with a timeout and one retry. Throws a `FetchError`. */
export async function getJson(url: string, options: GetJsonOptions = {}): Promise<unknown> {
  const { fetch: fetchFn = fetch, timeoutMs = 10_000, retryDelayMs = 2_000 } = options;
  try {
    return await once(url, fetchFn, timeoutMs);
  } catch (error) {
    if (!(error instanceof FetchError) || !error.retryable) throw error;
    await new Promise((done) => setTimeout(done, retryDelayMs));
    return once(url, fetchFn, timeoutMs);
  }
}
