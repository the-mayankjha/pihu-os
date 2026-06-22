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
  text?: string;
  // Function calling
  functionCall?: {
    name: string;
    args: Record<string, any>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, any>;
  };
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
  /** Gemini Function Calling — list of tool schemas */
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters?: Record<string, any>;
    }>;
  }>;
  /** Forces the model to use tools (AUTO lets it decide) */
  tool_config?: {
    function_calling_config: {
      mode: 'AUTO' | 'ANY' | 'NONE';
    };
  };
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

/** Request shape for function-calling flows */
export interface LLMToolRequest extends LLMRequest {
  tools: Array<{
    functionDeclarations: Array<{
      name: string;
      description: string;
      parameters?: Record<string, any>;
    }>;
  }>;
}
