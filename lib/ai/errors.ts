/**
 * Structured error thrown by AI providers.
 *
 * `transient` indicates whether the caller should retry — true for
 * timeouts, rate-limits (429), and server errors (5xx); false for
 * auth failures, bad requests, safety blocks, and other permanent errors.
 */
export class AiProviderError extends Error {
  readonly transient: boolean;
  readonly statusCode: number | undefined;

  constructor(
    message: string,
    opts: { transient: boolean; statusCode?: number },
  ) {
    super(message);
    this.name = "AiProviderError";
    this.transient = opts.transient;
    this.statusCode = opts.statusCode;
  }
}

export function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
