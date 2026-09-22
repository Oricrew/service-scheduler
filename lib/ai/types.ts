import type { z } from "zod";

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type CompletionProvider = (
  prompt: string,
  options: { model: string; apiKey: string },
) => Promise<string>;

export type CompleteJsonOptions<S extends z.ZodTypeAny> = {
  prompt: string;
  schema: S;
  provider?: CompletionProvider;
};
