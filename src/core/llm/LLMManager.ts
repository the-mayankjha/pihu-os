import { GeminiModel } from './types';
import type { GeminiRequestBody, GeminiResponse, GeminiContent, LLMRequest, LLMToolRequest } from './types';

import { useSettingsStore } from '../../stores/settingsStore';

// ── Error Diagnostics ────────────────────────────────────────────────────────
export type ErrorSeverity = 'transient' | 'config' | 'fatal';

export interface PihuErrorDiagnostic {
  severity: ErrorSeverity;
  /** Human-readable cause suitable for TTS / VoiceOverlay */
  cause: string;
  /** Actionable suggestion for the user */
  suggestion: string;
  /** Technical detail for console logging */
  technical: string;
}

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
      console.warn('[LLMManager] All configured Gemini API keys were exhausted. Resetting key exhaustion tracker...');
      useSettingsStore.getState().resetExhaustedKeys();
      return true;
    }

    console.log(`[LLMManager] PIHU Token Protocol rotated key to index ${newIndex}`);
    return true;
  }

  private static readonly FALLBACK_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-2.5-pro',
    'gemini-pro-latest',
  ];

  /**
   * Helper to parse Google API error messages safely.
   */
  private parseGoogleError(status: number, rawText: string): string {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed.error?.message) {
        return `[HTTP ${status}] ${parsed.error.message}`;
      }
    } catch {}
    return `[HTTP ${status}] ${rawText.slice(0, 250)}`;
  }

  /**
   * Classifies a raw error into a structured diagnostic with human-readable
   * cause, suggestion, and severity — suitable for VoiceOverlay and TTS.
   */
  public static classifyError(error: any): PihuErrorDiagnostic {
    const msg = (error?.message || String(error)).toLowerCase();
    const raw = error?.message || String(error);

    // ── Network / Connectivity ──
    if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('net::') || msg.includes('econnrefused') || msg.includes('enotfound')) {
      return {
        severity: 'transient',
        cause: 'Network connection failed. Your device may be offline or the API server is unreachable.',
        suggestion: 'Please check your internet connection and try again.',
        technical: `Network error: ${raw}`,
      };
    }

    // ── Server Capacity / Overload (503) ──
    if (msg.includes('503') || msg.includes('no capacity available') || msg.includes('overloaded') || msg.includes('service unavailable')) {
      const modelMatch = raw.match(/model\s+([\w.-]+)/i);
      const modelName = modelMatch?.[1] || 'the requested model';
      return {
        severity: 'transient',
        cause: `The AI model server is temporarily overloaded. ${modelName} has no available capacity right now.`,
        suggestion: 'This is a temporary issue. Please wait a moment and try again, or I will automatically try a fallback model.',
        technical: `503 capacity error on ${modelName}: ${raw}`,
      };
    }

    // ── Internal Server Error (500) ──
    if (msg.includes('500') || msg.includes('internal server error') || msg.includes('internal error')) {
      return {
        severity: 'transient',
        cause: 'The AI server encountered an internal error while processing the request.',
        suggestion: 'This is usually temporary. Please try again in a few seconds.',
        technical: `500 server error: ${raw}`,
      };
    }

    // ── Rate Limiting (429) ──
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('quota') || msg.includes('resource exhausted')) {
      return {
        severity: 'transient',
        cause: 'API rate limit reached. Too many requests were sent in a short time.',
        suggestion: 'I am rotating to another API key. If this persists, please wait a minute before trying again.',
        technical: `429 rate limit: ${raw}`,
      };
    }

    // ── Authentication / Permission (403, 401) ──
    if (msg.includes('403') || msg.includes('401') || msg.includes('permission denied') || msg.includes('api key not valid') || msg.includes('unauthorized') || msg.includes('forbidden')) {
      return {
        severity: 'config',
        cause: 'The API key is invalid or does not have permission to access this model.',
        suggestion: 'Please check your Gemini API key in Settings, Token Protocol section. Make sure the key is valid and has the correct permissions.',
        technical: `Auth error (403/401): ${raw}`,
      };
    }

    // ── Model Not Found (404) ──
    if (msg.includes('404') || msg.includes('not found') || msg.includes('is not found')) {
      const modelMatch = raw.match(/model\s+([\w.-]+)/i);
      return {
        severity: 'transient',
        cause: `The AI model ${modelMatch?.[1] || ''} was not found. It may have been deprecated or renamed.`,
        suggestion: 'I am automatically falling back to an available model.',
        technical: `404 model not found: ${raw}`,
      };
    }

    // ── No API Keys Configured ──
    if (msg.includes('no gemini api key') || msg.includes('no api key') || msg.includes('token protocol')) {
      return {
        severity: 'config',
        cause: 'No Gemini API keys are configured in PIHU.',
        suggestion: 'Please open Settings, go to the Token Protocol section, and add at least one Gemini API key.',
        technical: `Missing API keys: ${raw}`,
      };
    }

    // ── Timeout ──
    if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('aborted')) {
      return {
        severity: 'transient',
        cause: 'The request took too long and timed out.',
        suggestion: 'The server may be slow right now. Please try a simpler request or try again shortly.',
        technical: `Timeout: ${raw}`,
      };
    }

    // ── All Models Failed ──
    if (msg.includes('gemini api failed')) {
      // Extract the most meaningful sub-error
      const subErrors = raw.split('\n•').filter(Boolean);
      const primaryError = subErrors[0]?.trim() || raw;
      // Recursively classify the primary sub-error
      const subDiag = LLMManager.classifyError(new Error(primaryError));
      return {
        severity: subDiag.severity,
        cause: `All AI models failed. Primary issue: ${subDiag.cause}`,
        suggestion: subDiag.suggestion,
        technical: raw,
      };
    }

    // ── No Candidates ──
    if (msg.includes('no candidates')) {
      return {
        severity: 'transient',
        cause: 'The AI model returned an empty response. This can happen with safety filters or server issues.',
        suggestion: 'Please try rephrasing your request.',
        technical: `Empty response: ${raw}`,
      };
    }

    // ── Unknown / Fallback ──
    return {
      severity: 'fatal',
      cause: `An unexpected error occurred: ${raw.slice(0, 150)}`,
      suggestion: 'Please try again. If this keeps happening, check the console for details.',
      technical: raw,
    };
  }

  /**
   * Internal fetch — returns the raw first candidate (not just text).
   * Used by generateWithTools which needs to inspect functionCall parts.
   */
  private async executeRawFetch(
    primaryModel: GeminiModel,
    body: GeminiRequestBody,
    maxRetries: number = 3
  ): Promise<GeminiResponse['candidates']> {
    if (!this.currentApiKey) throw new Error('No Gemini API Keys configured in PIHU Token Protocol.');
    
    const candidateModels = Array.from(new Set([primaryModel, ...LLMManager.FALLBACK_MODELS]));
    const failureLog: string[] = [];

    for (const model of candidateModels) {
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

          const rawError = await response.text();
          const detail = this.parseGoogleError(response.status, rawError);
          failureLog.push(`${model}: ${detail}`);

          if (response.status === 429 || response.status === 403) {
            if (this.rotateKey()) {
              attempts++;
              continue;
            }
          }

          if (response.status === 503 || response.status === 500) {
            const backoffMs = Math.min(800 * Math.pow(2, attempts), 5000);
            console.warn(`[LLMManager] Model "${model}" temporarily unavailable (${response.status}). Retrying in ${backoffMs}ms... (attempt ${attempts + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, backoffMs));
            attempts++;
            if (attempts < maxRetries) continue;
            break; // Try next fallback model
          }

          if (response.status === 404) {
            console.warn(`[LLMManager] Model "${model}" returned 404. Falling back to next candidate model...`);
            break; // Try next fallback model
          }

          console.warn(`[LLMManager] Gemini error ${response.status} on model ${model}:`, rawError);
          break; // Try next fallback model
        } catch (error: any) {
          failureLog.push(`${model} (Network): ${error?.message || String(error)}`);
          if (attempts >= maxRetries - 1) break;
          attempts++;
        }
      }
    }

    const uniqueErrors = Array.from(new Set(failureLog)).join(' \n• ');
    throw new Error(`Gemini API failed:\n• ${uniqueErrors}`);
  }

  /**
   * Internal fetch method with retry and fallback logic.
   */
  private async executeFetchWithFailover(
    primaryModel: GeminiModel,
    body: GeminiRequestBody,
    maxRetries: number = 3
  ): Promise<string> {
    if (!this.currentApiKey) {
      throw new Error("No Gemini API Keys configured in PIHU Token Protocol.");
    }

    const candidateModels = Array.from(new Set([primaryModel, ...LLMManager.FALLBACK_MODELS]));
    const failureLog: string[] = [];

    for (const model of candidateModels) {
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

          const rawError = await response.text();
          const detail = this.parseGoogleError(response.status, rawError);
          failureLog.push(`${model}: ${detail}`);

          if (response.status === 429 || response.status === 403) {
            if (this.rotateKey()) {
              attempts++;
              continue;
            }
          }

          if (response.status === 503 || response.status === 500) {
            const backoffMs = Math.min(800 * Math.pow(2, attempts), 5000);
            console.warn(`[LLMManager] Model "${model}" ${response.status} busy. Retrying in ${backoffMs}ms... (attempt ${attempts + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, backoffMs));
            attempts++;
            if (attempts < maxRetries) continue;
            break;
          }

          if (response.status === 404) {
            console.warn(`[LLMManager] Model "${model}" 404. Falling back to next model...`);
            break;
          }

          console.warn(`[LLMManager] Gemini error ${response.status} on model ${model}:`, rawError);
          break;
        } catch (error: any) {
          failureLog.push(`${model} (Network): ${error?.message || String(error)}`);
          if (attempts >= maxRetries - 1) break;
          attempts++;
        }
      }
    }

    const uniqueErrors = Array.from(new Set(failureLog)).join(' \n• ');
    throw new Error(`Gemini API failed:\n• ${uniqueErrors}`);
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
    const historyTurns = request.history || [];
    const userTurn: GeminiContent = { role: 'user', parts: [{ text: request.prompt }] };

    const body: GeminiRequestBody = {
      contents: [...historyTurns, userTurn],
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
        ...historyTurns,
        userTurn,
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
