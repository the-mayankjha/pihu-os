export const GeminiModel = {
  PRIMARY: 'gemini-3.1-flash-lite',
  SECONDARY: 'gemini-2.5-flash',
  TERTIARY: 'gemini-3-flash',
} as const;

export type GeminiModel = typeof GeminiModel[keyof typeof GeminiModel];

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface Tool {
  functionDeclarations: FunctionDeclaration[];
}

export interface LLMRequest {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: Tool[];
}

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface GeminiPart {
  text?: string;
  functionCall?: FunctionCall;
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
  tools?: Tool[];
}

export interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: GeminiPart[];
    };
    finishReason: string;
  }>;
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

export interface LLMResponse {
  text: string;
  functionCalls: FunctionCall[];
}
