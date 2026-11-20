/** A failed request. The message is safe to log: it never holds the URL or a key. */
export class FetchError extends Error {
  constructor(
    message: string,
    /** Worth one more try: a timeout, a network error, rate limiting or a server error. */
    readonly retryable: boolean,
    /** The HTTP status, when the server answered. */
    readonly status?: number,
    /** The error code in the body (`{"detail": {"error": {"code": …}}}`), if any. */
    readonly code?: string
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export interface GetJsonOptions {
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Wait before the one retry. A function picks per failure; null means don't retry. */
  retryDelayMs?: number | ((error: FetchError) => number | null);
}

const USER_AGENT = 'cpl-website (+https://github.com/ElementalEngine/cpl-website)';
const CODE = /^[A-Z][A-Z_]{1,63}$/;

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

/** The error code from a JSON error body, or undefined. Only a plain code is kept, so it is safe to log. */
async function errorCode(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    const code = (body as { detail?: { error?: { code?: unknown } } } | null)?.detail?.error?.code;
    return typeof code === 'string' && CODE.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}

async function once(
  url: string,
  fetchFn: typeof fetch,
  timeoutMs: number,
  headers: Record<string, string>
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT, ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new FetchError(isTimeout(error) ? 'timed out' : 'network error', true);
  }
  const { status } = response;
  if (!response.ok) {
    const code = await errorCode(response);
    throw new FetchError(
      code ? `HTTP ${status} ${code}` : `HTTP ${status}`,
      status === 429 || status >= 500,
      status,
      code
    );
  }
  try {
    return await response.json();
  } catch (error) {
    const timedOut = isTimeout(error);
    throw new FetchError(timedOut ? 'timed out' : 'response is not JSON', timedOut, status);
  }
}

/** GET a JSON document with a timeout and one retry. Throws a `FetchError`. */
export async function getJson(url: string, options: GetJsonOptions = {}): Promise<unknown> {
  const { fetch: fetchFn = fetch, headers = {}, timeoutMs = 10_000, retryDelayMs = 2_000 } = options;
  try {
    return await once(url, fetchFn, timeoutMs, headers);
  } catch (error) {
    if (!(error instanceof FetchError) || !error.retryable) throw error;
    const delay = typeof retryDelayMs === 'function' ? retryDelayMs(error) : retryDelayMs;
    if (delay === null) throw error;
    await new Promise((done) => setTimeout(done, delay));
    return once(url, fetchFn, timeoutMs, headers);
  }
}
