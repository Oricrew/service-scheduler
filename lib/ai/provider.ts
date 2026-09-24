import {
  GoogleGenerativeAI,
  GoogleGenerativeAIAbortError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIResponseError,
} from "@google/generative-ai";

import type { CompletionProvider } from "./types";

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Provider that calls Google Gemini via the official SDK.
 * Uses JSON mode (responseMimeType) so the model returns
 * parseable JSON without markdown fences.
 *
 * Errors are sanitized before rethrowing so that raw SDK
 * messages, stacks, and errorDetails never leak into
 * AiResult or logs.
 */
export const geminiProvider: CompletionProvider = async (
  prompt,
  { model, apiKey, system },
) => {
  const systemContent =
    system ??
    "You are a JSON-only assistant. Reply with valid JSON and nothing else.";

  const genAI = new GoogleGenerativeAI(apiKey);
  const generativeModel = genAI.getGenerativeModel({
    model,
    systemInstruction: systemContent,
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
    },
  });

  let result;
  try {
    result = await generativeModel.generateContent(
      { contents: [{ role: "user", parts: [{ text: prompt }] }] },
      { timeout: REQUEST_TIMEOUT_MS },
    );
  } catch (err) {
    throw new Error(sanitizeGenerateError(err));
  }

  let content: string;
  try {
    content = result.response.text();
  } catch {
    throw new Error("AI provider response was blocked or empty");
  }

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("AI provider returned an empty response");
  }

  return content;
};

function sanitizeGenerateError(err: unknown): string {
  if (err instanceof GoogleGenerativeAIAbortError) {
    return "AI provider request timed out";
  }

  if (err instanceof GoogleGenerativeAIFetchError) {
    const status = err.status ?? 0;
    return `AI provider returned HTTP ${status}`;
  }

  if (err instanceof GoogleGenerativeAIResponseError) {
    return "AI provider response was blocked or empty";
  }

  return "AI provider request failed";
}
