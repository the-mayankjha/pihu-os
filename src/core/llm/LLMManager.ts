import { GeminiModel } from './types';
import type { GeminiRequestBody, GeminiResponse, LLMRequest, LLMResponse, FunctionCall } from './types';

export class LLMManager {
  private static instance: LLMManager;
  private apiKeys: string[] = [];
  private currentKeyIndex: number = 0;

  private constructor() {
    this.initializeKeys();
  }

  public static getInstance(): LLMManager {
    if (!LLMManager.instance) {
      LLMManager.instance = new LLMManager();
    }
    return LLMManager.instance;
  }

  private initializeKeys() {
    // Expecting comma separated keys: key1,key2,key3
    const keysStr = import.meta.env.VITE_GEMINI_API_KEYS || '';
    this.apiKeys = keysStr.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
    
    if (this.apiKeys.length === 0) {
      console.error('[LLMManager] No API keys found in VITE_GEMINI_API_KEYS');
    }
  }

  private get currentApiKey(): string {
    if (this.apiKeys.length === 0) return '';
    return this.apiKeys[this.currentKeyIndex];
  }

  private rotateKey() {
    if (this.apiKeys.length <= 1) {
      console.warn('[LLMManager] Cannot rotate keys: only 1 (or 0) key provided.');
      return false;
    }
    
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    console.log(`[LLMManager] Switched to API key index ${this.currentKeyIndex}`);
    return true;
  }

  /**
   * Internal fetch method with retry and fallback logic.
   */
  private async executeFetchWithFailover(model: GeminiModel, body: GeminiRequestBody, maxRetries: number = 2): Promise<LLMResponse> {
    if (!this.currentApiKey) {
      throw new Error("No Gemini API Keys configured.");
    }

    let attempts = 0;

    while (attempts < maxRetries) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.currentApiKey}`;
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          const data: GeminiResponse = await response.json();
          if (data.candidates && data.candidates.length > 0) {
            const parts = data.candidates[0].content.parts;
            let text = '';
            const functionCalls: FunctionCall[] = [];

            for (const part of parts) {
              if (part.text) {
                text += part.text;
              }
              if (part.functionCall) {
                functionCalls.push(part.functionCall);
              }
            }

            return { text, functionCalls };
          }
          throw new Error("No candidates returned from Gemini");
        }

        // Handle specific errors (e.g. 429 Rate Limit)
        if (response.status === 429) {
          console.warn(`[LLMManager] Rate limit hit for model ${model} with key index ${this.currentKeyIndex}.`);
          if (this.rotateKey()) {
            attempts++;
            continue; // Retry with new key
          }
        }
        
        // 400 or 403 could mean invalid key or quota exceeded
        if (response.status === 400 || response.status === 403) {
           console.warn(`[LLMManager] Auth/Quota error (${response.status}) on key index ${this.currentKeyIndex}.`);
           if (this.rotateKey()) {
             attempts++;
             continue; // Retry with new key
           }
        }

        const errorText = await response.text();
        throw new Error(`Gemini API Error ${response.status}: ${errorText}`);

      } catch (error) {
        // Network errors or thrown errors from above
        if (attempts >= maxRetries - 1) {
          throw error;
        }
        console.warn(`[LLMManager] Attempt ${attempts + 1} failed, retrying...`, error);
        attempts++;
      }
    }

    throw new Error(`Failed to execute prompt after ${maxRetries} attempts.`);
  }

  private buildRequestBody(req: LLMRequest): GeminiRequestBody {
    const body: GeminiRequestBody = {
      contents: [{
        parts: [{ text: req.prompt }]
      }]
    };

    if (req.systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: req.systemInstruction }]
      };
    }

    if (req.temperature !== undefined || req.maxOutputTokens !== undefined) {
      body.generationConfig = {};
      if (req.temperature !== undefined) body.generationConfig.temperature = req.temperature;
      if (req.maxOutputTokens !== undefined) body.generationConfig.maxOutputTokens = req.maxOutputTokens;
    }

    if (req.tools) {
      body.tools = req.tools;
    }

    return body;
  }

  /**
   * Generates content using the Primary Model (Gemini 3.1 Flash Lite)
   * Ideal for quick, conversational tasks.
   */
  public async generatePrimaryTask(request: LLMRequest): Promise<LLMResponse> {
    const body = this.buildRequestBody(request);
    return this.executeFetchWithFailover(GeminiModel.PRIMARY, body);
  }

  /**
   * Generates content using the Secondary Model (Gemini 2.5 Flash)
   * Ideal for more complex reasoning or fallback.
   */
  public async generateSecondaryTask(request: LLMRequest): Promise<LLMResponse> {
    const body = this.buildRequestBody(request);
    return this.executeFetchWithFailover(GeminiModel.SECONDARY, body);
  }

  /**
   * Generates content using the Tertiary Model (Gemini 3 Flash)
   * Ideal for heaviest lifting if 2.5 is not sufficient.
   */
  public async generateTertiaryTask(request: LLMRequest): Promise<LLMResponse> {
    const body = this.buildRequestBody(request);
    return this.executeFetchWithFailover(GeminiModel.TERTIARY, body);
  }
}
