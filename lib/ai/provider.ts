import { GoogleGenerativeAI } from "@google/generative-ai";

import type { CompletionProvider } from "./types";

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Provider that calls Google Gemini via the official SDK.
 * Uses JSON mode (responseMimeType) so the model returns
 * parseable JSON without markdown fences.
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

  const result = await generativeModel.generateContent(
    { contents: [{ role: "user", parts: [{ text: prompt }] }] },
    { timeout: REQUEST_TIMEOUT_MS },
  );

  const response = result.response;
  const content = response.text();

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("AI provider returned an empty response");
  }

  return content;
};
