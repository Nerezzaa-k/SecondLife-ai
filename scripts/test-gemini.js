import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey) {
  console.error('Error: GEMINI_API_KEY is not defined in .env');
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Load small local jpg
const sampleJpgPath = path.resolve(__dirname, 'sample.jpg');
let sampleJpgBase64 = '';
if (fs.existsSync(sampleJpgPath)) {
  const buf = fs.readFileSync(sampleJpgPath);
  sampleJpgBase64 = buf.toString('base64');
} else {
  // 1x1 minimal valid JPEG
  sampleJpgBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  fs.writeFileSync(sampleJpgPath, Buffer.from(sampleJpgBase64, 'base64'));
}

async function listGenerateContentModels() {
  console.log('\n--- 1a. Querying ListModels API ---');
  try {
    // Direct REST API fetch to ensure complete, raw supportedActions / supportedGenerationMethods
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`ListModels HTTP ${res.status}: ${errText}`);
      return [];
    }
    const data = await res.json();
    const models = data.models || [];
    
    const contentModels = models.filter((m) => {
      const methods = m.supportedGenerationMethods || [];
      return methods.includes('generateContent') || methods.includes('generate_content');
    });

    console.log(`Found ${contentModels.length} models supporting generateContent:`);
    for (const m of contentModels) {
      const shortName = m.name.replace(/^models\//, '');
      console.log(`  • ${shortName.padEnd(35)} (displayName: "${m.displayName}")`);
    }

    return contentModels.map((m) => m.name.replace(/^models\//, ''));
  } catch (err) {
    console.error('ListModels call failed:', err?.message || err);
    return [];
  }
}

async function runTimedCall(label, model, contents) {
  process.stdout.write(`Testing [${model}] - ${label}... `);
  const start = performance.now();
  try {
    const res = await ai.models.generateContent({
      model,
      contents,
    });
    const elapsedSec = ((performance.now() - start) / 1000).toFixed(2);
    const textSnippet = (res.text || '').trim().replace(/\r?\n/g, ' ').slice(0, 80);
    console.log(`\n  ✅ SUCCESS in ${elapsedSec}s | Snippet: "${textSnippet}"`);
    return { success: true, elapsedSec };
  } catch (err) {
    const elapsedSec = ((performance.now() - start) / 1000).toFixed(2);
    const status = err?.status || err?.statusCode || 'N/A';
    const message = err?.message || String(err);
    console.log(`\n  ❌ FAILED in ${elapsedSec}s | Status: ${status}`);
    console.log(`  Full Error Body / Message:`);
    console.log(`  ${message}`);
    return { success: false, elapsedSec, status, message };
  }
}

async function main() {
  console.log('================================================================');
  console.log('           Gemini Connectivity & Diagnostics Benchmark          ');
  console.log('================================================================');
  console.log(`Using GEMINI_API_KEY: ...${apiKey.slice(-4)} (${apiKey.length} characters)`);

  const availableModels = await listGenerateContentModels();

  const currentAppModel = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  
  // Pick fastest flash model from the list
  // Priority order for lowest latency: gemini-2.5-flash, gemini-2.0-flash, gemini-1.5-flash, etc.
  const flashCandidates = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash'];
  let fastestFlashModel = flashCandidates.find(m => availableModels.includes(m)) || 'gemini-2.5-flash';

  console.log('\n--- Selected Test Models ---');
  console.log(`1. Current model in app:    ${currentAppModel}`);
  console.log(`2. Fastest flash candidate: ${fastestFlashModel}`);

  console.log('\n--- 1b. Text-Only "say hi" Calls ---');
  await runTimedCall('text-only "say hi"', currentAppModel, 'say hi');
  if (fastestFlashModel !== currentAppModel) {
    await runTimedCall('text-only "say hi"', fastestFlashModel, 'say hi');
  }

  console.log('\n--- 1c. Multimodal Image Calls (scripts/sample.jpg) ---');
  const imageContents = [
    {
      parts: [
        {
          inlineData: {
            data: sampleJpgBase64,
            mimeType: 'image/jpeg',
          },
        },
        { text: 'Describe what you see in 5 words.' },
      ],
    },
  ];

  await runTimedCall('image call (sample.jpg)', currentAppModel, imageContents[0]);
  if (fastestFlashModel !== currentAppModel) {
    await runTimedCall('image call (sample.jpg)', fastestFlashModel, imageContents[0]);
  }

  console.log('\n================================================================');
}

main().catch(console.error);
