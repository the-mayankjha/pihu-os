import { LLMManager } from './src/core/llm/LLMManager';

// Mock import.meta.env
(global as any).import = {
  meta: {
    env: {
      VITE_GEMINI_API_KEYS: 'invalid_key_1,invalid_key_2'
    }
  }
};

async function test() {
  const llm = (LLMManager as any).getInstance();
  // Override private initializeKeys to read from our mock
  (llm as any).initializeKeys = function() {
    this.apiKeys = ['invalid_key_1', 'invalid_key_2'];
  };
  (llm as any).initializeKeys();

  console.log("Starting test with keys:", llm.apiKeys);

  try {
    await llm.generatePrimaryTask({ prompt: "Hello" });
  } catch (e) {
    console.log("Caught expected error after retries:", (e as any).message);
  }
}

test();
