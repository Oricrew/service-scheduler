import {
  GoogleGenerativeAI,
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIResponseError,
} from "@google/generative-ai";

import type { CompletionProvider } from "./types";
import { AiProviderError, isTransientStatus } from "./errors";

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Provider that calls Google Gemini via the official SDK.
 * Uses JSON mode (responseMimeType) so the model returns
 * parseable JSON without markdown fences.
 *
 * Errors are wrapped in {@link AiProviderError} with a `transient`
 * flag so the fallback chain can decide whether to retry or advance.
 * Raw SDK messages, stacks, and errorDetails never leak.
 */
export const geminiProvider: CompletionProvider = async (
  prompt,
  { model, apiKey, system, maxTokens, timeoutMs },
) => {
  const systemContent =
    system ??
    "You are a JSON-only assistant. Reply with valid JSON and nothing else.";

  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemContent,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
    },
  });

  let result;
  try {
    result = await generativeModel.generateContent(
      { contents: [{ role: "user", parts: [{ text: prompt }] }] },
      { timeout },
    );
  } catch (err) {
    throw classifyGeminiError(err);
  }

  let content: string;
  try {
    content = result.response.text();
  } catch {
    throw new AiProviderError("AI provider response was blocked or empty", {
      transient: false,
      kind: "blocked",
    });
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new AiProviderError("AI provider returned an empty response", {
      transient: false,
      kind: "empty",
    });
  }

  return content;
};

function classifyGeminiError(err: unknown): AiProviderError {
  if (err instanceof GoogleGenerativeAIAbortError) {
    return new AiProviderError("AI provider request timed out", {
      transient: true,
      kind: "timeout",
    });
  }

  if (err instanceof GoogleGenerativeAIFetchError) {
    const status = err.status ?? 0;
    return new AiProviderError(`AI provider returned HTTP ${status}`, {
      transient: isTransientStatus(status),
      statusCode: status,
      kind: "http",
    });
  }

  if (err instanceof GoogleGenerativeAIResponseError) {
    return new AiProviderError("AI provider response was blocked or empty", {
      transient: false,
      kind: "blocked",
    });
  }

  return new AiProviderError("AI provider request failed", {
    transient: true,
    kind: "network",
  });
}
