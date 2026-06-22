export const GeminiModel = {
  PRIMARY: 'gemini-3.1-flash-lite',
  SECONDARY: 'gemini-2.5-flash',
  TERTIARY: 'gemini-3-flash',
} as const;

export type GeminiModel = typeof GeminiModel[keyof typeof GeminiModel];

export interface LLMRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiPart {
  text: string;
}

export interface GeminiContent {
  role?: string;
  parts: GeminiPart[];
}

export interface GeminiRequestBody {
  contents: GeminiContent[];
  systemInstruction?: {
    parts: GeminiPart[];
  };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

export interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}
