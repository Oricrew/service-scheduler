export type AiErrorKind =
  | "timeout"
  | "http"
  | "blocked"
  | "empty"
  | "network"
  | "unknown";

/**
 * Structured error thrown by AI providers.
 *
 * `transient` indicates whether the caller should retry — true for
 * timeouts, rate-limits (429), and server errors (5xx); false for
 * auth failures, bad requests, safety blocks, and other permanent errors.
 *
 * `kind` identifies the failure category without message-text matching.
 */
export class AiProviderError extends Error {
  readonly transient: boolean;
  readonly statusCode: number | undefined;
  readonly kind: AiErrorKind;

  constructor(
    message: string,
    opts: { transient: boolean; statusCode?: number; kind: AiErrorKind },
  ) {
    super(message);
    this.name = "AiProviderError";
    this.transient = opts.transient;
    this.statusCode = opts.statusCode;
    this.kind = opts.kind;
  }
}

export function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}
