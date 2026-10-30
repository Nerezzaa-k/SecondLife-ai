import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey) {
  console.error('❌ Error: GEMINI_API_KEY is not defined in process.env or .env file');
  process.exit(1);
}

console.log(`🔑 GEMINI_API_KEY detected (${apiKey.length} chars, ends in ...${apiKey.slice(-4)})`);

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Minimal 1x1 transparent/red PNG in base64
const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function timeoutPromise<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const err: any = new Error(`Request timed out after ${ms}ms`);
      err.status = 408;
      err.code = 'ETIMEDOUT';
      reject(err);
    }, ms);
    p.then(res => { clearTimeout(t); resolve(res); })
     .catch(err => { clearTimeout(t); reject(err); });
  });
}

async function testCall(modelName: string, isImage: boolean, thinkingConfig?: { thinkingBudget?: number; thinkingLevel?: string }) {
  const tDesc = thinkingConfig 
    ? (thinkingConfig.thinkingLevel ? `level:${thinkingConfig.thinkingLevel}` : `budget:${thinkingConfig.thinkingBudget}`)
    : 'default-thinking';
  const label = `${modelName} [${isImage ? 'IMAGE' : 'TEXT'}, ${tDesc}]`;
  const t0 = performance.now();
  try {
    const contents: any = isImage
      ? [
          {
            parts: [
              {
                inlineData: {
                  data: samplePngBase64,
                  mimeType: 'image/png',
                },
              },
              { text: 'Describe what you see in 5 words.' },
            ],
          },
        ]
      : 'Reply with the word "Connected"';

    const config: any = {
      maxOutputTokens: 150,
    };

    if (thinkingConfig) {
      config.thinkingConfig = thinkingConfig;
    }

    const callPromise = ai.models.generateContent({
      model: modelName,
      contents,
      config,
    });

    const res = await timeoutPromise(callPromise, 25000);
    const elapsed = Math.round(performance.now() - t0);
    const text = (res.text || '').trim().replace(/\n/g, ' ');
    console.log(`✅ ${label.padEnd(52)} -> ${elapsed}ms | Reply: "${text.slice(0, 40)}"`);
    return { success: true, elapsed, reply: text };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - t0);
    const status = err?.status || err?.statusCode || 'N/A';
    const code = err?.code || 'N/A';
    const msg = (err?.message || String(err)).slice(0, 120);
    console.error(`❌ ${label.padEnd(52)} -> ${elapsed}ms | Status: ${status} | Code: ${code} | Msg: ${msg}`);
    return { success: false, elapsed, error: msg, status, code };
  }
}

async function main() {
  console.log('\n================ Gemini Connectivity & Latency Benchmark ================');
  
  console.log('\n--- 1. Text-Only Calls (Default Config) ---');
  await testCall('gemini-3.8-flash', false);
  await testCall('gemini-3.7-flash', false);

  console.log('\n--- 2. Text-Only Calls with Low Thinking Budget (thinkingBudget: 0) ---');
  await testCall('gemini-3.8-flash', false, { thinkingBudget: 0 });
  await testCall('gemini-3.7-flash', false, { thinkingBudget: 0 });

  console.log('\n--- 3. Image Multimodal Calls (Default Config) ---');
  await testCall('gemini-3.8-flash', true);
  await testCall('gemini-3.7-flash', true);

  console.log('\n--- 4. Image Multimodal Calls with Low Thinking Budget (thinkingBudget: 0) ---');
  await testCall('gemini-3.8-flash', true, { thinkingBudget: 0 });
  await testCall('gemini-3.7-flash', true, { thinkingBudget: 0 });

  console.log('\n========================================================================\n');
}

main().catch(console.error);
