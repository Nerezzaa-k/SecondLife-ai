import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiKey = process.env.GEMINI_API_KEY || '';
const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

if (!apiKey) {
  console.error('Error: GEMINI_API_KEY is not defined');
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

// Load sample.jpg as base64
const sampleJpgPath = path.resolve(__dirname, 'sample.jpg');
const buf = fs.readFileSync(sampleJpgPath);
const cleanBase64 = buf.toString('base64');

const imagePart = {
  inlineData: {
    data: cleanBase64,
    mimeType: 'image/jpeg',
  },
};

const promptText = `
You are SecondLife AI, an expert circular economy and item diagnostics specialist.
Analyze this photo of an item.
User description of the item: "Toaster with heating issue".
Cloudinary detected tags: appliance, toaster, kitchen.

CRITICAL DIAGNOSTIC RULES:
1. HONEST DIAGNOSIS:
   - When the user does NOT describe a problem or defect AND the item in the photo appears intact and in good condition with no visible damage, you MUST report:
     * likely_issue: "No fault detected"
     * condition: "good"
     * recommended_action: "maintain"
     * possible_causes: [] (empty array)
     * troubleshooting_tips: provide 3 practical proactive maintenance & care tips to keep it in peak condition
     * repair_cost_inr: { "min": 0, "max": 0 }
     * reasoning: State clearly that the item appears in good condition with no visible faults, and routine maintenance is recommended to extend its lifespan.
     * confidence: between 85 and 95
2. ONLY CLAIM A SPECIFIC FAULT IF:
   - Clear visual damage, wear, or breakage is evident in the photo, OR
   - The user's description explicitly states a specific problem or malfunction (e.g. "motor doesn't turn", "cracked case", "won't power on").
   - Your confidence score must honestly reflect the strength of evidence (e.g., 55-65% if guessing/uncertain from minimal visual cues, 80-95% only if clear damage or explicit user description is present).
3. Recommended action must be one of: "maintain" | "repair" | "borrow" | "donate" | "repurpose" | "replace".
4. COMPACT & FAST OUTPUT: Keep all descriptions, tips, and reasoning concise (1-2 sentences max), lists to 2-3 items, and avoid verbose filler so the JSON response remains compact and fast.

Return ONLY a valid JSON object matching this schema:
{
  "item_name": "string (e.g., Phillips Pop-up Toaster)",
  "category": "string (e.g., Kitchen Appliances, Electronics, Furniture, Tools, Apparel)",
  "condition": "good" | "fair" | "damaged",
  "likely_issue": "string ('No fault detected' when no problem was described and item looks fine, or specific diagnosed defect)",
  "possible_causes": ["string"],
  "troubleshooting_tips": ["actionable maintenance or repair tip 1", "actionable tip 2", "actionable tip 3"],
  "recommended_action": "maintain" | "repair" | "borrow" | "donate" | "repurpose" | "replace",
  "reasoning": "2-3 sentences explaining why this action is optimal for circular economy and wallet",
  "confidence": integer between 50 and 99,
  "repair_cost_inr": { "min": integer, "max": integer },
  "replace_cost_inr": { "min": integer, "max": integer },
  "reuse_ideas": ["creative repurpose idea 1", "creative repurpose idea 2"],
  "estimated_waste_saved_kg": number (e.g. 2.4),
  "estimated_co2_saved_kg": number (e.g. 5.6),
  "photo_quality": {
    "score": integer between 50 and 100,
    "issues": ["string issue 1", "string issue 2"],
    "tip": "suggestion to improve photo trust score on community listing"
  },
  "safety_note": "clear safety instruction (e.g. electrical isolation, cut hazards, or safety glasses)"
}
`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    item_name: { type: Type.STRING },
    category: { type: Type.STRING },
    condition: { type: Type.STRING, enum: ['good', 'fair', 'damaged'] },
    likely_issue: { type: Type.STRING },
    possible_causes: { type: Type.ARRAY, items: { type: Type.STRING } },
    troubleshooting_tips: { type: Type.ARRAY, items: { type: Type.STRING } },
    recommended_action: {
      type: Type.STRING,
      enum: ['maintain', 'repair', 'borrow', 'donate', 'repurpose', 'replace'],
    },
    reasoning: { type: Type.STRING },
    confidence: { type: Type.INTEGER },
    repair_cost_inr: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.INTEGER },
        max: { type: Type.INTEGER },
      },
      required: ['min', 'max'],
    },
    replace_cost_inr: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.INTEGER },
        max: { type: Type.INTEGER },
      },
      required: ['min', 'max'],
    },
    reuse_ideas: { type: Type.ARRAY, items: { type: Type.STRING } },
    estimated_waste_saved_kg: { type: Type.NUMBER },
    estimated_co2_saved_kg: { type: Type.NUMBER },
    photo_quality: {
      type: Type.OBJECT,
      properties: {
        score: { type: Type.INTEGER },
        issues: { type: Type.ARRAY, items: { type: Type.STRING } },
        tip: { type: Type.STRING },
      },
      required: ['score', 'issues', 'tip'],
    },
    safety_note: { type: Type.STRING },
  },
  required: [
    'item_name',
    'category',
    'condition',
    'likely_issue',
    'possible_causes',
    'troubleshooting_tips',
    'recommended_action',
    'reasoning',
    'confidence',
    'repair_cost_inr',
    'replace_cost_inr',
    'reuse_ideas',
    'estimated_waste_saved_kg',
    'estimated_co2_saved_kg',
    'photo_quality',
    'safety_note',
  ],
};

const contents = [
  {
    parts: [
      imagePart,
      { text: promptText },
    ],
  },
];

async function testConfig(testName, config) {
  console.log(`\n==================================================`);
  console.log(`RUNNING TEST: ${testName}`);
  console.log(`Model: ${model}`);
  console.log(`Config keys: ${Object.keys(config).join(', ') || '(none)'}`);
  console.log(`==================================================`);

  const start = performance.now();
  try {
    const res = await ai.models.generateContent({
      model,
      contents: contents[0],
      config,
    });
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`>>> RESULT: SUCCESS in ${elapsed}s`);
    console.log(`Snippet: ${(res.text || '').slice(0, 150).replace(/\r?\n/g, ' ')}...`);
    return { success: true };
  } catch (err) {
    const elapsed = ((performance.now() - start) / 1000).toFixed(2);
    console.log(`>>> RESULT: FAILED in ${elapsed}s`);
    console.log(`error.status: ${err?.status || err?.statusCode || 'N/A'}`);
    console.log(`error.message: ${err?.message}`);
    if (err?.response?.data) {
      console.log(`error.response.data:`, JSON.stringify(err.response.data, null, 2));
    }
    return { success: false, status: err?.status, message: err?.message };
  }
}

async function run() {
  // Test 1: EXACT current server.ts config
  const fullConfig = {
    responseMimeType: 'application/json',
    maxOutputTokens: 2048,
    thinkingConfig: {
      thinkingBudget: 0,
    },
    responseSchema,
  };
  await testConfig('1. Exact server.ts config (Baseline)', fullConfig);

  // Test 2: Remove thinkingConfig
  const withoutThinking = {
    responseMimeType: 'application/json',
    maxOutputTokens: 2048,
    responseSchema,
  };
  await testConfig('2. Without thinkingConfig', withoutThinking);

  // Test 3: Remove responseSchema (keeping responseMimeType)
  const withoutSchema = {
    responseMimeType: 'application/json',
    maxOutputTokens: 2048,
  };
  await testConfig('3. Without responseSchema and without thinkingConfig', withoutSchema);

  // Test 4: Remove responseMimeType (only maxOutputTokens)
  const plainConfig = {
    maxOutputTokens: 2048,
  };
  await testConfig('4. Plain (only maxOutputTokens)', plainConfig);

  // Test 5: Empty config
  await testConfig('5. Empty config {}', {});

  // Test 6: Text-only with fullConfig to see if the issue is multimodal vs text on this model
  console.log(`\n==================================================`);
  console.log(`RUNNING TEST: 6. Text-only with Exact server.ts config`);
  console.log(`==================================================`);
  try {
    const textRes = await ai.models.generateContent({
      model,
      contents: 'Say hi in valid JSON matching schema {"greeting":"string"}',
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: { greeting: { type: Type.STRING } },
          required: ['greeting'],
        },
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    console.log(`Text-only with thinkingBudget:0: SUCCESS! Snippet: ${textRes.text}`);
  } catch (textErr) {
    console.log(`Text-only with thinkingBudget:0: FAILED: ${textErr?.message}`);
  }
}

run();

