import type { CompletionProvider } from "./types";

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Minimal fetch-based provider that calls an OpenAI-compatible
 * chat-completions endpoint.  Keeps the dependency footprint small —
 * swap this out for the official SDK when the project needs streaming
 * or tool-calling.
 */
export const openAiCompatibleProvider: CompletionProvider = async (
  prompt,
  { model, apiKey },
) => {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a JSON-only assistant. Reply with valid JSON and nothing else.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`AI provider returned HTTP ${res.status}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("AI provider returned an empty response");
  }

  return content;
};
