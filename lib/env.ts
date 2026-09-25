type SupabaseEnv = {
  url: string;
  anonKey: string;
};

type SupabaseAdminEnv = SupabaseEnv & {
  serviceRoleKey: string;
};

export type AiEnv = {
  enabled: boolean;
  apiKey: string | undefined;
  model: string;
};

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseEnv(): SupabaseEnv {
  return {
    url: requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    anonKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}

export function getSupabaseAdminEnv(): SupabaseAdminEnv {
  const env = getSupabaseEnv();

  return {
    ...env,
    serviceRoleKey: requireEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
  };
}

export function getAiEnv(): AiEnv {
  const flag = process.env.AI_ENABLED;
  const enabled = flag === "true" || flag === "1";
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.AI_API_KEY?.trim() ||
    undefined;
  const model =
    process.env.GEMINI_MODEL || process.env.AI_MODEL || "gemini-2.0-flash";

  return { enabled, apiKey, model };
}

export type AiFallbackEnv = {
  fallbackModel: string | undefined;
  openaiApiKey: string | undefined;
  openaiModel: string;
};

export function getAiFallbackEnv(): AiFallbackEnv {
  return {
    fallbackModel: process.env.GEMINI_FALLBACK_MODEL?.trim() || undefined,
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || undefined,
    openaiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
  };
}

export function isAiConfigured(): boolean {
  const { enabled, apiKey } = getAiEnv();
  return enabled && !!apiKey;
}
