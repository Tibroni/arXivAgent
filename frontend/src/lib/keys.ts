export interface ServerKeyStatus {
  openai: boolean;
  gemini: boolean;
  langsmith: boolean;
  langsmithProject: string;
  demoMode: boolean;
}

export const EMPTY_SERVER_KEY_STATUS: ServerKeyStatus = {
  openai: false,
  gemini: false,
  langsmith: false,
  langsmithProject: 'arXivAgent',
  demoMode: false,
};

export function hasOpenAIKey(
  apiHeaders: Record<string, string>,
  serverKeys: ServerKeyStatus
): boolean {
  return !!apiHeaders['X-OpenAI-Key'] || serverKeys.openai;
}

export function hasGeminiKey(
  apiHeaders: Record<string, string>,
  serverKeys: ServerKeyStatus
): boolean {
  return !!apiHeaders['X-Gemini-Key'] || serverKeys.gemini;
}

export function hasLLMKey(
  apiHeaders: Record<string, string>,
  serverKeys: ServerKeyStatus
): boolean {
  return hasOpenAIKey(apiHeaders, serverKeys) || hasGeminiKey(apiHeaders, serverKeys);
}

export function hasLangsmithKey(
  apiHeaders: Record<string, string>,
  serverKeys: ServerKeyStatus
): boolean {
  return !!apiHeaders['X-Langsmith-Key'] || serverKeys.langsmith;
}
