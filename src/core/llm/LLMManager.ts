import { GeminiModel } from './types';
import type { GeminiRequestBody, GeminiResponse, GeminiContent, LLMRequest, LLMToolRequest } from './types';

import { useSettingsStore } from '../../stores/settingsStore';

export class LLMManager {
  private static instance: LLMManager;

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
    // If settingsStore has keys, ensure initial seed from VITE_GEMINI_API_KEYS if store is empty
    const envKeysStr = import.meta.env.VITE_GEMINI_API_KEYS || '';
    const envKeys = envKeysStr.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);

    const store = useSettingsStore.getState();
    if (store.geminiApiKeys.length === 0 && envKeys.length > 0) {
      envKeys.forEach((k: string) => store.addGeminiKey(k));
    }
  }

  private get apiKeys(): string[] {
    const storeKeys = useSettingsStore.getState().geminiApiKeys;
    if (storeKeys.length > 0) return storeKeys;
    const envKeysStr = import.meta.env.VITE_GEMINI_API_KEYS || '';
    return envKeysStr.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
  }

  private get currentApiKey(): string {
    const keys = this.apiKeys;
    if (keys.length === 0) return '';
    const activeIndex = useSettingsStore.getState().activeKeyIndex;
    const safeIndex = activeIndex < keys.length ? activeIndex : 0;
    return keys[safeIndex];
  }

  private rotateKey() {
    const keys = this.apiKeys;
    if (keys.length <= 1) {
      console.warn('[LLMManager] Cannot rotate keys: only 1 (or 0) key provided in PIHU Token Protocol.');
      return false;
    }
    
    const currentIndex = useSettingsStore.getState().activeKeyIndex;
    useSettingsStore.getState().markKeyExhausted(currentIndex);
    const newIndex = useSettingsStore.getState().activeKeyIndex;

    if (newIndex === currentIndex) {
      console.warn('[LLMManager] All configured Gemini API keys are currently exhausted.');
      return false;
    }

    console.log(`[LLMManager] PIHU Token Protocol rotated key to index ${newIndex}`);
    return true;
  }

  /**
   * Internal fetch — returns the raw first candidate (not just text).
   * Used by generateWithTools which needs to inspect functionCall parts.
   */
  private async executeRawFetch(
    model: GeminiModel,
    body: GeminiRequestBody,
    maxRetries: number = 4
  ): Promise<GeminiResponse['candidates']> {
    if (!this.currentApiKey) throw new Error('No Gemini API Keys configured.');
    let attempts = 0;
    while (attempts < maxRetries) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.currentApiKey}`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (response.ok) {
          const data: GeminiResponse = await response.json();
          return data.candidates ?? [];
        }
        if (response.status === 429 || response.status === 403) {
          if (this.rotateKey()) { attempts++; continue; }
        }
        const errorText = await response.text();
        throw new Error(`Gemini API Error ${response.status}: ${errorText}`);
      } catch (error) {
        if (attempts >= maxRetries - 1) throw error;
        attempts++;
      }
    }
    throw new Error(`Failed after ${maxRetries} attempts. (Possibly rate limited or quota exceeded on all keys)`);
  }

  /**
   * Internal fetch method with retry and fallback logic.
   */
  private async executeFetchWithFailover(model: GeminiModel, body: GeminiRequestBody, maxRetries: number = 4): Promise<string> {
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
            return data.candidates[0].content.parts[0].text ?? '';
          }
          throw new Error("No candidates returned from Gemini");
        }

        const activeIndex = useSettingsStore.getState().activeKeyIndex;

        // Handle specific errors (e.g. 429 Rate Limit)
        if (response.status === 429) {
          console.warn(`[LLMManager] Rate limit hit for model ${model} with key index ${activeIndex}.`);
          if (this.rotateKey()) {
            attempts++;
            continue; // Retry with new key
          }
        }
        
        // 403 could mean invalid key or quota exceeded
        if (response.status === 403) {
           console.warn(`[LLMManager] Auth/Quota error (${response.status}) on key index ${activeIndex}.`);
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

    throw new Error(`Failed to execute prompt after ${maxRetries} attempts. (Possibly rate limited or quota exceeded on all keys)`);
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

    return body;
  }

  /**
   * Generates content using the Primary Model (Gemini 3.1 Flash Lite)
   * Ideal for quick, conversational tasks.
   */
  public async generatePrimaryTask(request: LLMRequest): Promise<string> {
    const body = this.buildRequestBody(request);
    return this.executeFetchWithFailover(GeminiModel.PRIMARY, body);
  }

  /**
   * Generates content using the Secondary Model (Gemini 2.5 Flash)
   * Ideal for more complex reasoning or fallback.
   */
  public async generateSecondaryTask(request: LLMRequest): Promise<string> {
    const body = this.buildRequestBody(request);
    return this.executeFetchWithFailover(GeminiModel.SECONDARY, body);
  }

  /**
   * Generates content using the Tertiary Model (Gemini 3 Flash)
   * Ideal for heaviest lifting if 2.5 is not sufficient.
   */
  public async generateTertiaryTask(request: LLMRequest): Promise<string> {
    const body = this.buildRequestBody(request);
    return this.executeFetchWithFailover(GeminiModel.TERTIARY, body);
  }

  /**
   * Generates content using Gemini Function Calling.
   * Sends user message + tool schemas → if Gemini calls a tool, runs it → sends
   * the result back → returns Gemini's final spoken response.
   *
   * Flow:
   *   Turn 1: User message + tools → Gemini picks a tool (functionCall)
   *   Execute: toolExecutor runs the function against real stores
   *   Turn 2: Send tool result back → Gemini generates natural spoken response
   *   Fallback: If Gemini returns plain text on Turn 1, return it directly.
   */
  public async generateWithTools(
    request: LLMToolRequest,
    toolExecutor: (name: string, args: Record<string, any>) => Promise<{ success: boolean; data?: any; error?: string }>
  ): Promise<string> {
    const body: GeminiRequestBody = {
      contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      tools: request.tools,
      tool_config: { function_calling_config: { mode: 'AUTO' } },
    };

    if (request.systemInstruction) {
      body.systemInstruction = { parts: [{ text: request.systemInstruction }] };
    }

    if (request.temperature !== undefined || request.maxOutputTokens !== undefined) {
      body.generationConfig = {};
      if (request.temperature !== undefined) body.generationConfig.temperature = request.temperature;
      if (request.maxOutputTokens !== undefined) body.generationConfig.maxOutputTokens = request.maxOutputTokens;
    }

    // ── Turn 1: Gemini decides intent ──────────────────────────────────────
    const candidates = await this.executeRawFetch(GeminiModel.PRIMARY, body);
    const firstCandidate = candidates?.[0];
    if (!firstCandidate) throw new Error('No candidates returned from Gemini.');

    const firstPart = firstCandidate.content.parts[0];

    // Plain text response — no tool call needed (general question / chitchat)
    if (!firstPart?.functionCall) {
      return firstPart?.text ?? '';
    }

    // ── Tool Call: Execute the requested function ───────────────────────────
    const { name, args } = firstPart.functionCall;
    console.log(`[LLMManager] 🔧 Gemini called tool: ${name}`, args);

    const toolResult = await toolExecutor(name, args);
    console.log(`[LLMManager] ✅ Tool result:`, toolResult);

    // ── Turn 2: Send tool result back for a natural spoken response ─────────
    const modelTurn: GeminiContent = {
      role: 'model',
      parts: [firstPart],
    };

    const toolTurn: GeminiContent = {
      role: 'user',
      parts: [{
        functionResponse: {
          name,
          response: {
            result: toolResult.success ? toolResult.data : { error: toolResult.error },
          },
        },
      }],
    };

    const body2: GeminiRequestBody = {
      ...body,
      contents: [
        { role: 'user', parts: [{ text: request.prompt }] },
        modelTurn,
        toolTurn,
      ],
      // Remove tools from turn 2 — we want a conversational text response only
      tools: undefined,
      tool_config: undefined,
    };

    const candidates2 = await this.executeRawFetch(GeminiModel.PRIMARY, body2);
    return candidates2?.[0]?.content?.parts?.[0]?.text ?? '';
  }
}
