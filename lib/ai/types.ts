import type { z } from "zod";

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type CompletionProvider = (
  prompt: string,
  options: {
    model: string;
    apiKey: string;
    system?: string;
    maxTokens?: number;
  },
) => Promise<string>;

export type CompleteJsonOptions<S extends z.ZodTypeAny> = {
  prompt: string;
  schema: S;
  system?: string;
  provider?: CompletionProvider;
  maxTokens?: number;
};
