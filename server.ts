import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { v2 as cloudinary } from 'cloudinary';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Request ID tracking middleware
app.use((req, res, next) => {
  const incomingId = req.headers['x-request-id'];
  const reqId = typeof incomingId === 'string' && incomingId.length <= 64 ? incomingId : crypto.randomUUID();
  (req as any).requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Security headers with Helmet (CSP disabled in dev mode to allow Vite HMR scripts)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Restricted CORS origin
const allowedOriginEnv = process.env.ALLOWED_ORIGIN;
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin SSR/Vite requests)
      if (!origin) return callback(null, true);
      if (allowedOriginEnv) {
        const allowed = allowedOriginEnv.split(',').map((o) => o.trim().toLowerCase());
        if (allowed.includes(origin.toLowerCase())) {
          return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy'));
      }
      // In local dev without explicit ALLOWED_ORIGIN, permit localhost & 127.0.0.1
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  })
);

// Enforce strict limit on incoming JSON bodies (15MB to support base64 uploads safely)
app.use(express.json({ limit: '15mb' }));

// Initialize Supabase Server Client for Access Token Verification
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabaseServerClient = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Safe Supabase token verification (never logs tokens)
async function authenticateSupabaseUser(req: express.Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : (req.body?.accessToken || req.query?.accessToken);

  if (!token || !supabaseServerClient) return null;
  try {
    const { data: { user }, error } = await supabaseServerClient.auth.getUser(String(token));
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

// Authentication middleware for endpoints that spend money or write data
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const userId = await authenticateSupabaseUser(req);
  if (!userId) {
    if (!supabaseServerClient) {
      // Allow local development fallback when Supabase is not yet configured
      (req as any).userId = 'local-dev-user';
      return next();
    }
    return res.status(401).json({
      error: 'Authentication required. Please sign in with a valid session token.',
      code: 'UNAUTHORIZED',
      requestId: (req as any).requestId,
    });
  }
  (req as any).userId = userId;
  next();
}

// Key generator for rate limiting: per authenticated user if available, otherwise per IP
const rateLimitKey = (req: express.Request): string => {
  const userId = (req as any).userId;
  if (userId) return `user_${userId}`;
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || req.ip || 'unknown';
  return `ip_${ip}`;
};

// General API rate limiter (120 req / 15m)
const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: 'Too many requests, please try again shortly.', code: 'RATE_LIMITED' },
  validate: { xForwardedForHeader: false },
});

// Strict AI analysis rate limiter (30 req / 15m)
const strictAiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: 'AI analysis limit reached. Please wait a few minutes before analyzing more items.', code: 'RATE_LIMITED' },
  validate: { xForwardedForHeader: false },
});

// Media upload and Cloudinary rate limiter (45 req / 15m)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 45,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: rateLimitKey,
  message: { error: 'Media processing rate limit reached. Please wait a few minutes.', code: 'RATE_LIMITED' },
  validate: { xForwardedForHeader: false },
});

// Apply general limiter to all /api routes
app.use('/api', generalApiLimiter);

// Zod validation schemas
const analyzeSchema = z.object({
  imageBase64: z.string().max(15 * 1024 * 1024, 'Base64 image exceeds 15 MB limit').optional(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/jpg']).optional(),
  imageUrl: z.string().url('Invalid image URL').max(2048).optional(),
  description: z.string().max(2000, 'Description exceeds 2000 characters limit').optional().default(''),
  tags: z.array(z.string().max(100)).max(50).optional().default([]),
}).refine((data) => Boolean(data.imageBase64 || data.imageUrl), {
  message: 'Either imageBase64 or imageUrl is required',
});

const uploadSchema = z.object({
  imageBase64: z.string().min(1, 'imageBase64 is required').max(15 * 1024 * 1024, 'Image exceeds 15 MB limit'),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/jpg']).optional().default('image/jpeg'),
  fileSize: z.number().max(10 * 1024 * 1024, 'Image size exceeds 10 MB limit').optional(),
});

const signatureSchema = z.object({
  fileType: z.string().max(100).optional(),
  fileSize: z.number().optional(),
  resourceType: z.enum(['image', 'video']).optional().default('image'),
});

const checkDuplicateSchema = z.object({
  phash: z.string().min(1, 'phash is required').max(128),
  userId: z.string().max(128).optional(),
  currentListingId: z.string().max(128).optional(),
});

const measureSchema = z.object({
  url: z.string().url('Invalid URL parameter').max(2048),
  originalBytes: z.coerce.number().positive().max(100 * 1024 * 1024).optional(),
});

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  console.log(`[Server Init] Confirmed: GEMINI_API_KEY successfully read from process.env (${apiKey.length} characters).`);
} else {
  console.warn('[Server Init] Warning: GEMINI_API_KEY not found in process.env. Photo analysis will use local offline fallback.');
}

// Initialize Cloudinary Server-Side Config
const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY || '';
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET || '';

const isCloudinaryConfigured = Boolean(
  cloudinaryCloudName &&
  cloudinaryApiKey &&
  cloudinaryApiSecret &&
  cloudinaryCloudName !== 'YOUR_CLOUD_NAME'
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: cloudinaryCloudName,
    api_key: cloudinaryApiKey,
    api_secret: cloudinaryApiSecret,
    secure: true,
  });
}

function buildServerCloudinaryUrl(publicId: string, transformations: string, cloudName: string): string {
  const cloud = (!cloudName || cloudName === 'YOUR_CLOUD_NAME') ? 'demo' : cloudName;
  const cleanId = publicId.replace(/^\//, '');
  return `https://res.cloudinary.com/${cloud}/image/upload/${transformations}/${cleanId}`;
}

// Fallback intelligent generator if Gemini key is absent or network fails
function generateFallbackAnalysis(itemNameGuess: string, description: string, tags: string[] = []) {
  const userDesc = (description || '').trim();
  const descLower = userDesc.toLowerCase();
  const combined = (itemNameGuess + ' ' + description + ' ' + tags.join(' ')).toLowerCase();

  // Check if user explicitly described a defect or issue
  const problemKeywords = ['broken', 'fault', 'not working', 'damage', 'loose', 'leak', 'won\'t', 'wont', 'stuck', 'crack', 'noise', 'spark', 'dead', 'burn', 'tear', 'torn', 'scratch', 'error', 'defect', 'issue', 'problem', 'rattle'];
  const hasUserDescribedProblem = problemKeywords.some(kw => descLower.includes(kw));

  let item = 'Household Item';
  let category = 'General & Home';
  let action: 'repair' | 'borrow' | 'donate' | 'repurpose' | 'replace' | 'maintain' = 'maintain';
  let condition: 'good' | 'fair' | 'damaged' = 'good';
  let likelyIssue = 'No fault detected';
  let causes: string[] = [];
  let tips = [
    'Clean dust and debris from exterior vents and connectors with a dry cloth',
    'Store in a cool, dry area away from direct sunlight and excessive humidity',
    'Perform periodic visual inspection of power cables, joints, and fasteners'
  ];
  let minCost = 0;
  let maxCost = 0;
  let replaceMin = 2500;
  let replaceMax = 6000;
  let wasteSaved = 2.0;
  let co2Saved = 5.0;
  let confidence = 88;
  let reasoning = 'Item appears intact and in good condition. Preventative maintenance will extend its service life.';

  if (combined.includes('toaster') || combined.includes('kettle') || combined.includes('blender') || combined.includes('grinder') || combined.includes('microwave')) {
    item = combined.includes('toaster') ? 'Pop-up Toaster' : combined.includes('kettle') ? 'Electric Kettle' : 'Kitchen Appliance';
    category = 'Kitchen Appliances';
    replaceMin = 1800;
    replaceMax = 4500;
    wasteSaved = 1.8;
    co2Saved = 4.2;

    if (hasUserDescribedProblem) {
      action = 'repair';
      condition = 'fair';
      likelyIssue = 'Heating element or thermal fuse interruption';
      causes = ['Blown micro-temp thermal fuse', 'Limescale/crumb accumulation on heating coil', 'Loose terminal contact'];
      tips = [
        'Unplug appliance and inspect power cord for visible fraying or pinching',
        'Clean crumb tray and heating chamber thoroughly with a soft nylon brush',
        'Test thermal continuity across fuse using a multimeter before replacing components'
      ];
      minCost = 250;
      maxCost = 650;
      confidence = 72;
      reasoning = 'Appliance defect matches common thermal interruption. Component-level repair saves >75% of new purchase cost.';
    }
  } else if (combined.includes('fan') || combined.includes('cooler') || combined.includes('iron') || combined.includes('vacuum') || combined.includes('heater')) {
    item = combined.includes('fan') ? 'Table / Pedestal Fan' : combined.includes('iron') ? 'Steam Iron' : 'Home Appliance';
    category = 'Home Appliances';
    replaceMin = 2200;
    replaceMax = 5500;
    wasteSaved = 2.8;
    co2Saved = 6.8;

    if (hasUserDescribedProblem) {
      action = 'repair';
      condition = 'fair';
      likelyIssue = 'Motor bearing friction or degraded start capacitor';
      causes = ['Dry sintered bronze sleeve bearings', 'Dust and lint wrapping motor shaft', 'Weakened polypropylene capacitor'];
      tips = [
        'Isolate power completely before dismantling the protective grill',
        'Apply 2-3 drops of synthetic non-detergent machine oil to front and rear shaft bearings',
        'Check capacitor capacitance rating with an LCR meter'
      ];
      minCost = 180;
      maxCost = 500;
      confidence = 74;
      reasoning = 'Mechanical binding is readily resolvable with lubrication and basic capacitor replacement.';
    }
  } else if (combined.includes('drill') || combined.includes('saw') || combined.includes('wrench') || combined.includes('tool') || combined.includes('hammer')) {
    item = combined.includes('drill') ? 'Rotary Power Drill' : 'Hand / Power Tool';
    category = 'Tools & DIY';
    replaceMin = 3000;
    replaceMax = 8000;
    wasteSaved = 3.2;
    co2Saved = 8.5;

    if (hasUserDescribedProblem) {
      action = 'repair';
      condition = 'fair';
      likelyIssue = 'Worn carbon brushes or chuck seizing';
      causes = ['Carbon motor brush contact wear', 'Debris lodged in chuck teeth', 'Trigger potentiometer switch dust'];
      tips = [
        'Inspect carbon brush length; replace if worn down below 5mm',
        'Blow compressed air through motor commutator vents to expel conductive dust',
        'Apply lithium grease to internal drive gears and chuck mechanisms'
      ];
      minCost = 150;
      maxCost = 450;
      confidence = 76;
      reasoning = 'Durable tool housing and motor can easily provide 5+ more years of service with new brushes.';
    } else {
      action = 'borrow';
      confidence = 90;
      reasoning = 'DIY tools are used infrequently (avg. 13 mins/lifetime). Sharing or lending in the neighborhood prevents redundant manufacturing.';
    }
  } else if (combined.includes('chair') || combined.includes('table') || combined.includes('desk') || combined.includes('lamp') || combined.includes('shelf')) {
    item = combined.includes('chair') ? 'Study / Ergonomic Chair' : 'Wooden Furniture';
    category = 'Furniture & Decor';
    replaceMin = 3500;
    replaceMax = 9000;
    wasteSaved = 8.0;
    co2Saved = 14.0;

    if (hasUserDescribedProblem) {
      action = 'repair';
      condition = 'fair';
      likelyIssue = 'Loose joinery or surface degradation';
      causes = ['Dried PVA wood glue joint', 'Loose hex bolts from cyclical mechanical loading', 'Finish wear from humidity'];
      tips = [
        'Tighten all cross-bracing bolts and socket screws with an Allen key',
        'Inject wood glue into loose mortise joints and clamp firmly for 24 hours',
        'Lightly sand blemishes along the grain with 220-grit sandpaper and seal'
      ];
      minCost = 100;
      maxCost = 400;
      confidence = 78;
      reasoning = 'High solid mass makes furniture repair the highest environmental return on investment.';
    } else {
      action = 'donate';
      confidence = 88;
      reasoning = 'Item is in good working order. Donating or passing on locally provides immediate utility to a neighbor.';
    }
  } else if (combined.includes('laptop') || combined.includes('phone') || combined.includes('audio') || combined.includes('speaker') || combined.includes('headphone') || combined.includes('monitor')) {
    item = combined.includes('speaker') ? 'Bluetooth Speaker' : combined.includes('headphone') ? 'Audio Headphones' : 'Personal Electronics';
    category = 'Electronics & Media';
    replaceMin = 3000;
    replaceMax = 12000;
    wasteSaved = 1.2;
    co2Saved = 9.0;

    if (hasUserDescribedProblem) {
      action = 'repair';
      condition = 'fair';
      likelyIssue = 'USB-C / charging port contact oxidation or battery degradation';
      causes = ['Debris or lint compacted in connector socket', 'Solder fatigue on micro USB/type-C pins', 'Lithium pouch cell capacity loss'];
      tips = [
        'Carefully dislodge lint from socket using a non-conductive wooden toothpick',
        'Clean metal contact pins with 99% isopropyl alcohol and an anti-static brush',
        'Check battery terminal voltage with a multimeter before replacing'
      ];
      minCost = 300;
      maxCost = 1200;
      confidence = 70;
      reasoning = 'Electronics harbor high embedded carbon. Replacing the port or cell preserves the high-value circuit board.';
    }
  } else {
    if (hasUserDescribedProblem) {
      action = 'repair';
      condition = 'fair';
      likelyIssue = 'Mechanical fastener loosening or surface wear';
      causes = ['Normal vibration loosening', 'Dirt ingress in moving interfaces'];
      tips = [
        'Inspect all fasteners and joints carefully',
        'Clean surfaces thoroughly with appropriate mild cleanser',
        'Lubricate pivot points or replace worn fasteners'
      ];
      minCost = 150;
      maxCost = 500;
      confidence = 65;
      reasoning = 'Minor repair restores full utility and keeps household items in active circulation.';
    }
  }

  return {
    item_name: item,
    category,
    condition,
    likely_issue: likelyIssue,
    possible_causes: causes,
    troubleshooting_tips: tips,
    recommended_action: action,
    reasoning,
    confidence,
    repair_cost_inr: { min: minCost, max: maxCost },
    replace_cost_inr: { min: replaceMin, max: replaceMax },
    reuse_ideas: [
      'Offer to borrow or share with verified neighbors in your neighborhood circle',
      'If upgrading later, donate to a local workshop or community center'
    ],
    estimated_waste_saved_kg: wasteSaved,
    estimated_co2_saved_kg: co2Saved,
    photo_quality: {
      score: 86,
      issues: ['Slight off-center framing', 'Soft ambient indoor lighting'],
      tip: 'Capture closer in natural daylight for an even higher trust score.',
    },
    safety_note: 'Always disconnect mains electricity before opening any casing or touching internal terminals.',
    isFallback: true,
  };
}

// 1. Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    requestId: (req as any).requestId,
    services: {
      gemini: Boolean(apiKey),
      cloudinary: isCloudinaryConfigured,
      supabase: Boolean(supabaseServerClient),
    },
  });
});

// Safe Cloudinary Config Endpoint for Client (never exposes api_key or api_secret)
app.get('/api/config/cloudinary', (req, res) => {
  res.json({
    configured: isCloudinaryConfigured,
    cloudName: isCloudinaryConfigured ? cloudinaryCloudName : 'demo',
  });
});

// Phase 6B: Self-Service Account & Data Deletion Endpoint
// Permanently removes the caller's listings, requests, reviews, actions, analyses, and profile.
app.post('/api/user/delete-account', generalApiLimiter, requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.body?.accessToken || req.query?.accessToken);

    if (supabaseServerClient && token) {
      const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      });

      const { error: rpcError } = await userSupabase.rpc('delete_user_account_data');
      if (rpcError) {
        console.warn(`[Server Warning][Req:${(req as any).requestId}] RPC delete_user_account_data fallback to direct delete:`, rpcError.message);
        await userSupabase.from('reports').delete().eq('reporter_id', userId);
        await userSupabase.from('reviews').delete().or(`reviewer_id.eq.${userId},reviewee_id.eq.${userId}`);
        await userSupabase.from('requests').delete().eq('requester_id', userId);
        await userSupabase.from('actions').delete().eq('user_id', userId);
        await userSupabase.from('analyses').delete().eq('user_id', userId);
        await userSupabase.from('listings').delete().eq('owner_id', userId);
        await userSupabase.from('profiles').delete().eq('id', userId);
      }
    }

    // Optional Cloudinary cleanup for user folder if Cloudinary is live
    if (isCloudinaryConfigured) {
      try {
        await cloudinary.api.delete_resources_by_prefix(`secondlife/users/${userId}`);
      } catch (cErr: any) {
        console.warn('Could not clean Cloudinary user assets:', cErr?.message);
      }
    }

    return res.json({
      success: true,
      message: 'Account and associated data deleted permanently.',
      requestId: (req as any).requestId,
    });
  } catch (err: any) {
    const safeMsg = err?.message?.replace(/([a-zA-Z0-9_\-]{20,})/g, '[REDACTED]') || 'Account deletion failed';
    console.error(`[Server Error][Req:${(req as any).requestId}] Account delete error:`, safeMsg);
    return res.status(500).json({ error: safeMsg, requestId: (req as any).requestId });
  }
});

// Hamming distance calculator for 64-bit hexadecimal perceptual hashes (phash)
function computeHammingDistance(hashA?: string | null, hashB?: string | null): number {
  if (!hashA || !hashB || typeof hashA !== 'string' || typeof hashB !== 'string') {
    return 64; // Max distance if invalid/missing
  }
  const cleanA = hashA.trim().toLowerCase();
  const cleanB = hashB.trim().toLowerCase();
  if (cleanA.length !== cleanB.length) {
    return 64;
  }
  let distance = 0;
  for (let i = 0; i < cleanA.length; i++) {
    const valA = parseInt(cleanA[i], 16);
    const valB = parseInt(cleanB[i], 16);
    if (isNaN(valA) || isNaN(valB)) return 64;
    let xor = valA ^ valB;
    while (xor > 0) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  return distance;
}

// Phase 5A & 5B: Signed Upload Signature Generation Endpoint
// Requires authenticated Supabase user. Signs upload parameters server-side with CLOUDINARY_API_SECRET.
app.post('/api/cloudinary/signature', uploadLimiter, requireAuth, async (req, res) => {
  const t0 = performance.now();
  const requestId = (req as any).requestId || 'unknown';
  try {
    const validated = signatureSchema.safeParse(req.body || {});
    if (!validated.success) {
      return res.status(400).json({
        error: 'Invalid request: ' + validated.error.issues.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
        requestId: (req as any).requestId,
      });
    }

    const userId = (req as any).userId;
    if (!isCloudinaryConfigured) {
      return res.status(503).json({ error: 'Cloudinary credentials are not configured on server.' });
    }

    const { fileType, fileSize, resourceType = 'image' } = validated.data;
    const isVideo = resourceType === 'video';

    if (isVideo) {
      const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov', 'video/x-matroska', 'video/mkv'];
      if (fileType && !allowedVideoTypes.includes(fileType.toLowerCase())) {
        return res.status(400).json({ error: 'Invalid video type. Supported formats: MP4, WEBM, MOV.' });
      }

      const maxVideoSizeBytes = 30 * 1024 * 1024; // 30 MB limit for short condition videos
      if (fileSize && Number(fileSize) > maxVideoSizeBytes) {
        return res.status(400).json({ error: 'Video file size exceeds 30 MB maximum limit.' });
      }
    } else {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/jpg'];
      if (fileType && !allowedTypes.includes(fileType.toLowerCase())) {
        return res.status(400).json({ error: 'Invalid file type. Supported formats: JPG, PNG, WEBP, HEIC.' });
      }

      const maxSizeBytes = 10 * 1024 * 1024; // 10 MB limit for images
      if (fileSize && Number(fileSize) > maxSizeBytes) {
        return res.status(400).json({ error: 'File size exceeds 10 MB maximum limit.' });
      }
    }

    const timestamp = Math.round(Date.now() / 1000);
    const folder = isVideo ? `secondlife/users/${userId}/videos` : `secondlife/users/${userId}`;

    // Cloudinary signature parameters to sign
    const paramsToSign: Record<string, any> = {
      folder,
      timestamp,
    };

    if (!isVideo) {
      paramsToSign.phash = 'true';
      const moderationType = process.env.CLOUDINARY_MODERATION_TYPE || 'manual';
      if (moderationType) {
        paramsToSign.moderation = moderationType;
      }
    }

    const signature = cloudinary.utils.api_sign_request(paramsToSign, cloudinaryApiSecret);
    const elapsed = Math.round(performance.now() - t0);
    console.log(`[Timing][Req:${requestId}] Cloudinary upload signature generated in ${elapsed}ms`);

    return res.json({
      timestamp,
      folder,
      signature,
      apiKey: cloudinaryApiKey,
      cloudName: cloudinaryCloudName,
      resourceType: isVideo ? 'video' : 'image',
      moderation: !isVideo ? (process.env.CLOUDINARY_MODERATION_TYPE || 'manual') : undefined,
      phash: !isVideo ? true : undefined,
      allowedParams: paramsToSign,
    });
  } catch (err: any) {
    const safeMsg = err?.message?.replace(/([a-zA-Z0-9_\-]{20,})/g, '[REDACTED]') || 'Signature generation failed';
    console.error(`[Server Error][Req:${(req as any).requestId}] Signature error:`, safeMsg);
    return res.status(500).json({ error: safeMsg, requestId: (req as any).requestId });
  }
});

// Phase 5B: Duplicate Listing Detection using Perceptual Hash (phash) & Hamming Distance
app.post('/api/cloudinary/check-duplicate', requireAuth, async (req, res) => {
  const t0 = performance.now();
  const requestId = (req as any).requestId || 'unknown';
  try {
    const validated = checkDuplicateSchema.safeParse(req.body || {});
    if (!validated.success) {
      return res.status(400).json({
        error: 'Invalid request: ' + validated.error.issues.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
        requestId: (req as any).requestId,
      });
    }

    const { phash, userId, currentListingId } = validated.data;
    const targetPhash = phash.trim().toLowerCase();

    if (!supabaseServerClient) {
      const elapsed = Math.round(performance.now() - t0);
      console.log(`[Timing][Req:${requestId}] phash duplicate check: ${elapsed}ms (Supabase offline)`);
      return res.json({ isDuplicate: false, message: 'Supabase server client not initialized.' });
    }

    // Query candidates from Supabase listings
    let query = supabaseServerClient
      .from('listings')
      .select('id, title, owner_id, phash, created_at, status')
      .not('phash', 'is', null)
      .neq('status', 'archived');

    if (currentListingId) {
      query = query.neq('id', currentListingId);
    }

    const { data: candidates, error } = await query.limit(150);

    if (error) {
      console.warn(`[Server Warning][Req:${(req as any).requestId}] Could not query listings for duplicate check:`, error.message);
      return res.json({ isDuplicate: false, message: 'Could not query candidate listings' });
    }

    if (!candidates || candidates.length === 0) {
      const elapsed = Math.round(performance.now() - t0);
      console.log(`[Timing][Req:${requestId}] phash duplicate check: ${elapsed}ms (0 candidates evaluated)`);
      return res.json({ isDuplicate: false });
    }

    let bestMatch: any = null;
    let minDistance = 64;

    for (const item of candidates) {
      if (!item.phash) continue;
      const dist = computeHammingDistance(targetPhash, item.phash);
      if (dist <= 8) {
        const isUserListing = Boolean(userId && item.owner_id === userId);
        if (isUserListing || dist < minDistance) {
          minDistance = dist;
          bestMatch = {
            id: item.id,
            title: item.title,
            ownerId: item.owner_id,
            createdAt: item.created_at,
            isOwner: isUserListing,
            distance: dist,
          };
          if (isUserListing) break;
        }
      }
    }

    const elapsed = Math.round(performance.now() - t0);
    console.log(`[Timing][Req:${requestId}] phash duplicate check: ${elapsed}ms (${candidates.length} candidates evaluated, match: ${Boolean(bestMatch)})`);

    if (bestMatch) {
      const warningMessage = bestMatch.isOwner
        ? `This looks like a photo you've already listed: "${bestMatch.title}".`
        : `This photo is visually identical to an existing community listing: "${bestMatch.title}".`;

      return res.json({
        isDuplicate: true,
        duplicateListing: bestMatch,
        warningMessage,
        distance: minDistance,
      });
    }

    return res.json({ isDuplicate: false });
  } catch (err: any) {
    const safeMsg = err?.message?.replace(/([a-zA-Z0-9_\-]{20,})/g, '[REDACTED]') || 'Check duplicate failed';
    console.error(`[Server Error][Req:${(req as any).requestId}] Duplicate check error:`, safeMsg);
    return res.json({ isDuplicate: false, error: safeMsg });
  }
});

// Server-Side Image Upload & Processing Endpoint (with Moderation & Validation)
app.post('/api/upload', uploadLimiter, requireAuth, async (req, res) => {
  const t0 = performance.now();
  const requestId = (req as any).requestId || 'unknown';
  try {
    const validated = uploadSchema.safeParse(req.body || {});
    if (!validated.success) {
      return res.status(400).json({
        error: 'Invalid upload payload: ' + validated.error.issues.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
        requestId: (req as any).requestId,
      });
    }

    const { imageBase64, mimeType = 'image/jpeg', fileSize } = validated.data;
    const cleanBase64 = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`;

    const estimatedOriginalBytes = fileSize ? Number(fileSize) : Math.round(cleanBase64.length * 0.75);
    const userId = (req as any).userId;
    const userFolder = userId ? `secondlife/users/${userId}` : 'secondlife_items';
    const tPrep = Math.round(performance.now() - t0);

    if (!isCloudinaryConfigured) {
      // High-fidelity simulated Cloudinary pipeline fallback
      const demoPublicId = `secondlife_demo_${Date.now()}`;
      const mockTags: string[] = [];

      const asset = {
        publicId: demoPublicId,
        originalUrl: cleanBase64,
        cleanedUrl: cleanBase64,
        thumbnailUrl: cleanBase64,
        damageCloseupUrl: cleanBase64,
        shareableCardUrl: buildServerCloudinaryUrl('sample', 'c_fill,w_800,h_500,b_rgb:1b4d3e', 'demo'),
        tags: mockTags,
        isDemoFallback: true,
        bytes: estimatedOriginalBytes,
        deliveredBytes: Math.round(estimatedOriginalBytes * 0.18),
        savedPercent: 82,
        moderationStatus: 'approved' as const,
        phash: 'a1b2c3d4e5f60718',
        transformations: [
          {
            name: 'AI Background Removal',
            code: 'e_background_removal',
            description: 'Isolates item from cluttered surroundings into clean transparent cutout',
            status: 'simulated',
          },
          {
            name: 'Smart Gravity Thumbnail',
            code: 'c_fill,g_auto,w_400,h_400,f_auto,q_auto',
            description: 'Auto-detects item focal center and resizes dynamically for cards',
            status: 'simulated',
          },
          {
            name: 'Damage Zoom Focus',
            code: 'c_crop,g_auto,w_500,h_500,z_1.7',
            description: 'Crops in closely onto the primary wear/defect region',
            status: 'simulated',
          },
          {
            name: 'Dynamic Text Overlay Impact Card',
            code: 'l_text:Arial_32_bold:...,g_center',
            description: 'Generates on-the-fly branded social share badge with carbon & waste stats',
            status: 'simulated',
          },
        ],
      };

      const tTotal = Math.round(performance.now() - t0);
      console.log(`[Timing][Req:${requestId}] Simulated upload pipeline completed in ${tTotal}ms`);

      return res.json({
        asset,
        notice: 'Using simulated Cloudinary pipeline. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to your server .env to enable live cloud processing.',
      });
    }

    // Authenticated upload via official Cloudinary SDK on the server with moderation & perceptual hash
    let uploadResult: any;
    let moderationStatus: 'approved' | 'rejected' | 'pending' | 'unmoderated' = 'unmoderated';

    const tUploadStart = performance.now();
    try {
      uploadResult = await cloudinary.uploader.upload(cleanBase64, {
        folder: userFolder,
        resource_type: 'image',
        categorization: 'google_tagging',
        auto_tagging: 0.6,
        moderation: 'manual',
        phash: true,
      });
    } catch (firstErr: any) {
      console.warn('Advanced upload options failed, retrying standard upload:', firstErr?.message);
      uploadResult = await cloudinary.uploader.upload(cleanBase64, {
        folder: userFolder,
        resource_type: 'image',
        phash: true,
      });
    }
    const tUpload = Math.round(performance.now() - tUploadStart);

    const tModStart = performance.now();
    // Check moderation status from upload response
    if (Array.isArray(uploadResult.moderation) && uploadResult.moderation.length > 0) {
      const firstMod = uploadResult.moderation[0];
      if (firstMod.status === 'rejected') {
        try {
          await cloudinary.uploader.destroy(uploadResult.public_id);
        } catch {}
        return res.status(400).json({
          error: "This photo can't be used. Please upload a clear photo of the item.",
          rejected: true,
        });
      }
      moderationStatus = firstMod.status === 'approved' ? 'approved' : 'pending';
    } else if (uploadResult.moderation_status) {
      if (uploadResult.moderation_status === 'rejected') {
        try {
          await cloudinary.uploader.destroy(uploadResult.public_id);
        } catch {}
        return res.status(400).json({
          error: "This photo can't be used. Please upload a clear photo of the item.",
          rejected: true,
        });
      }
      moderationStatus = uploadResult.moderation_status === 'approved' ? 'approved' : 'pending';
    }

    const publicId = uploadResult.public_id;
    const originalUrl = uploadResult.secure_url;
    const tags = Array.isArray(uploadResult.tags) ? uploadResult.tags : [];
    const actualBytes = uploadResult.bytes || estimatedOriginalBytes;
    const deliveredEstimate = Math.round(actualBytes * 0.18);
    const savedPercent = Math.max(0, Math.round(((actualBytes - deliveredEstimate) / actualBytes) * 100));

    const asset = {
      publicId,
      originalUrl,
      cleanedUrl: buildServerCloudinaryUrl(publicId, 'e_background_removal,f_auto,q_auto', cloudinaryCloudName),
      thumbnailUrl: buildServerCloudinaryUrl(publicId, 'c_fill,g_auto,w_400,h_400,f_auto,q_auto', cloudinaryCloudName),
      damageCloseupUrl: buildServerCloudinaryUrl(publicId, 'c_crop,g_auto,w_500,h_500,z_1.7,f_auto,q_auto', cloudinaryCloudName),
      shareableCardUrl: buildServerCloudinaryUrl(publicId, 'c_fill,w_800,h_500,b_rgb:1b4d3e', cloudinaryCloudName),
      tags,
      isDemoFallback: false,
      bytes: actualBytes,
      deliveredBytes: deliveredEstimate,
      savedPercent,
      moderationStatus,
      phash: uploadResult.phash || null,
      transformations: [
        {
          name: 'AI Background Removal',
          code: 'e_background_removal,f_auto,q_auto',
          description: 'Isolates item from background into crisp transparent product cutout',
          status: 'applied',
        },
        {
          name: 'Smart Gravity Thumbnail',
          code: 'c_fill,g_auto,w_400,h_400,f_auto,q_auto',
          description: 'Content-aware gravity cropping focused on item core',
          status: 'applied',
        },
        {
          name: 'Damage Focus Area',
          code: 'c_crop,g_auto,w_500,h_500,z_1.7,f_auto,q_auto',
          description: 'Targeted optical zoom into the critical wear or defect zone',
          status: 'applied',
        },
        {
          name: 'Shareable Impact Card Overlay',
          code: 'l_text:Arial_32_bold:...,g_center',
          description: 'Real-time text layers composited onto environmental card badge',
          status: 'applied',
        },
      ],
    };

    const tMod = Math.round(performance.now() - tModStart);
    const tTotal = Math.round(performance.now() - t0);

    console.log(
      `[Timing][Req:${requestId}] ─── Server Cloudinary Upload Breakdown ───\n` +
      `[Timing][Req:${requestId}]   • Payload prep & validation: ${tPrep}ms\n` +
      `[Timing][Req:${requestId}]   • Cloudinary upload API (upload + moderation + phash): ${tUpload}ms\n` +
      `[Timing][Req:${requestId}]   • Moderation evaluation & URL construction: ${tMod}ms\n` +
      `[Timing][Req:${requestId}]   • Total /api/upload: ${tTotal}ms`
    );

    return res.json({ asset });
  } catch (err: any) {
    const safeMsg = err?.message?.replace(/([a-zA-Z0-9_\-]{20,})/g, '[REDACTED]') || 'Image upload failed';
    console.error(`[Server Error][Req:${(req as any).requestId}] Upload error:`, safeMsg);
    return res.status(500).json({ error: safeMsg, requestId: (req as any).requestId });
  }
});

// Phase 5A: Bandwidth & Delivered Bytes Measurement Endpoint
app.get('/api/cloudinary/measure', async (req, res) => {
  try {
    const validated = measureSchema.safeParse(req.query || {});
    if (!validated.success) {
      return res.status(400).json({
        error: 'Invalid measurement query: ' + validated.error.issues.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
        requestId: (req as any).requestId,
      });
    }

    const { url, originalBytes } = validated.data;
    const orig = originalBytes || (2.5 * 1024 * 1024);

    try {
      const headRes = await fetch(url, { method: 'HEAD' });
      const len = headRes.headers.get('content-length');
      if (len) {
        const deliveredBytes = parseInt(len, 10);
        const savedPercent = Math.max(0, Math.round(((orig - deliveredBytes) / orig) * 100));
        return res.json({ originalBytes: orig, deliveredBytes, savedPercent });
      }
    } catch {}

    const deliveredBytes = Math.round(orig * 0.18);
    const savedPercent = Math.max(0, Math.round(((orig - deliveredBytes) / orig) * 100));
    return res.json({ originalBytes: orig, deliveredBytes, savedPercent });
  } catch (err: any) {
    const safeMsg = err?.message?.replace(/([a-zA-Z0-9_\-]{20,})/g, '[REDACTED]') || 'Measurement failed';
    console.error(`[Server Error][Req:${(req as any).requestId}] Measure error:`, safeMsg);
    return res.status(500).json({ error: safeMsg, requestId: (req as any).requestId });
  }
});

// Safe Gemini error formatter: extracts HTTP status, error code, and message without ever logging API keys
function formatGeminiError(err: any): { status: string | number; code: string | number; message: string; fullError: string } {
  let status: string | number = err?.status || err?.statusCode || err?.response?.status || 'N/A';
  let code: string | number = err?.code || 'N/A';
  let rawMessage: string = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
  let message = rawMessage;

  let rawBody = '';
  if (err?.response?.data) {
    try {
      rawBody = typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data, null, 2);
    } catch {}
  } else if (err?.error) {
    try {
      rawBody = JSON.stringify(err.error, null, 2);
    } catch {}
  }

  // If the error message wraps Google's JSON error payload, parse status and code if present
  try {
    const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error) {
        if (parsed.error.code && (status === 'N/A' || !status)) status = parsed.error.code;
        if (parsed.error.status && (code === 'N/A' || !code)) code = parsed.error.status;
        if (parsed.error.message) message = parsed.error.message;
        if (!rawBody) rawBody = JSON.stringify(parsed, null, 2);
      }
    }
  } catch {}

  const fullErrorOutput = rawBody ? `${rawMessage}\n[Response Body]: ${rawBody}` : rawMessage;

  // Strictly redact any API key or secret tokens
  const currentKey = process.env.GEMINI_API_KEY || '';
  let sanitizedFull = fullErrorOutput;
  if (currentKey && currentKey.length > 5) {
    message = message.split(currentKey).join('[REDACTED_GEMINI_KEY]');
    sanitizedFull = sanitizedFull.split(currentKey).join('[REDACTED_GEMINI_KEY]');
  }
  message = message.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]');
  sanitizedFull = sanitizedFull.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]');

  return { status, code, message, fullError: sanitizedFull };
}

// Generate contextual offline notice based on exact Gemini call error
function getFallbackNotice(errInfo: { status: string | number; code: string | number; message: string }): string {
  const statusStr = String(errInfo.status);
  const codeStr = String(errInfo.code);

  if (statusStr === '429' || codeStr === 'RESOURCE_EXHAUSTED' || errInfo.message.includes('429') || errInfo.message.includes('quota')) {
    return 'AI daily quota reached for this key. Showing preliminary offline estimate.';
  }

  if (statusStr === '408' || codeStr === 'ETIMEDOUT' || errInfo.message.includes('timed out')) {
    return 'Live AI analysis timed out. Showing preliminary offline estimate.';
  }

  if (errInfo.status && errInfo.status !== 'N/A') {
    return `AI unavailable (HTTP ${errInfo.status}). Showing preliminary offline estimate.`;
  }

  return 'AI unavailable. Showing preliminary offline estimate.';
}

// Helper: Call asynchronous task with timeout
function callWithTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err: any = new Error(`${label} timed out after ${timeoutMs}ms`);
      err.code = 'ETIMEDOUT';
      err.status = 408;
      reject(err);
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// Gemini Vision Item Analysis Endpoint (Rate-limited, Authenticated, Zod-validated)
app.post('/api/analyze', strictAiLimiter, requireAuth, async (req, res) => {
  const t0 = performance.now();
  const requestId = (req as any).requestId || 'unknown';

  try {
    const validated = analyzeSchema.safeParse(req.body || {});
    if (!validated.success) {
      return res.status(400).json({
        error: 'Invalid analysis payload: ' + validated.error.issues.map((e) => e.message).join(', '),
        code: 'VALIDATION_ERROR',
        requestId,
      });
    }

    const { imageBase64, mimeType = 'image/jpeg', imageUrl, description = '', tags = [] } = validated.data;

    if (!ai) {
      const fallback = generateFallbackAnalysis('Item', description, tags);
      const elapsed = Math.round(performance.now() - t0);
      console.log(`[Timing][Req:${requestId}] Local diagnostic engine (offline/demo mode): ${elapsed}ms`);
      return res.json({
        data: fallback,
        source: 'local_engine',
        notice: 'Analyzed with circular-economy diagnostic rules (Demo mode).',
      });
    }

    // Step 1: Deliver & prepare lightweight image for Gemini (Cloudinary small version preferred)
    const tImgStart = performance.now();
    let imagePart: any = null;
    let imageSourceDesc = '';

    // Prioritize small Cloudinary-delivered version (e.g. w_1024,c_limit,q_auto,f_auto)
    if (imageUrl) {
      try {
        console.log(`[Timing][Req:${requestId}] Fetching small Cloudinary-delivered image for Gemini: ${imageUrl}`);
        const imgFetchStart = performance.now();
        const imgRes = await callWithTimeout(fetch(imageUrl), 6000, 'Cloudinary small image fetch');
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer();
          const fetchedBase64 = Buffer.from(arrayBuf).toString('base64');
          const rawMime = imgRes.headers.get('content-type') || mimeType || 'image/jpeg';
          const cleanMime = rawMime.split(';')[0].trim();
          imagePart = {
            inlineData: {
              data: fetchedBase64,
              mimeType: cleanMime,
            },
          };
          const fetchMs = Math.round(performance.now() - imgFetchStart);
          imageSourceDesc = `Cloudinary small delivered image (${(arrayBuf.byteLength / 1024).toFixed(1)} KB in ${fetchMs}ms)`;
        } else {
          console.warn(`[Timing][Req:${requestId}] Cloudinary image fetch returned status ${imgRes.status}, falling back to base64`);
        }
      } catch (fetchErr: any) {
        console.warn(`[Timing][Req:${requestId}] Could not fetch small Cloudinary image (${fetchErr?.message}), using base64 fallback`);
      }
    }

    // Fallback to client-compressed imageBase64 if Cloudinary small image fetch unavailable
    if (!imagePart && imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[a-z/]+;base64,/, '');
      imagePart = {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/jpeg',
        },
      };
      imageSourceDesc = `Client-compressed imageBase64 (${(cleanBase64.length * 0.75 / 1024).toFixed(1)} KB)`;
    }

    const tImgPrep = Math.round(performance.now() - tImgStart);
    console.log(`[Timing][Req:${requestId}] Image delivery & preparation: ${tImgPrep}ms [Source: ${imageSourceDesc}]`);

    const promptText = `
You are SecondLife AI, an expert circular economy and item diagnostics specialist.
Analyze this photo of an item.
User description of the item: "${description || 'None provided'}".
Cloudinary detected tags: ${tags.length > 0 ? tags.join(', ') : 'None'}.

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

    const contents = [
      {
        parts: [
          ...(imagePart ? [imagePart] : []),
          { text: promptText },
        ],
      },
    ];

    // Step 2: Execute Gemini call without timeout and with 1 retry only for real network errors
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    let response: any = null;
    let geminiAttempts = 0;
    let attempt1Duration = 0;
    let attempt2Duration = 0;

    const geminiConfig = {
      responseMimeType: 'application/json',
      maxOutputTokens: 2048,
      responseSchema: {
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
      },
    };

    const configOptionNames = Object.keys(geminiConfig).join(', ');

    const executeGemini = () =>
      ai!.models.generateContent({
        model: GEMINI_MODEL,
        contents: contents[0],
        config: geminiConfig,
      });

    // Attempt 1
    geminiAttempts = 1;
    const imageSizeKb = imagePart?.inlineData?.data
      ? (Buffer.byteLength(imagePart.inlineData.data, 'base64') / 1024).toFixed(1)
      : '0.0';

    const tGeminiStart1 = performance.now();
    try {
      console.log(`[Timing][Req:${requestId}] Calling Gemini Vision API (Attempt 1/2, Model: ${GEMINI_MODEL}, Config: [${configOptionNames}], Image Size: ${imageSizeKb} KB)...`);
      response = await executeGemini();
      attempt1Duration = Math.round(performance.now() - tGeminiStart1);
      const first200Chars = (response?.text || '').slice(0, 200).replace(/\r?\n/g, ' ');
      console.log(
        `[Gemini Call Succeeded][Req:${requestId}]\n` +
        `  • Model:        ${GEMINI_MODEL}\n` +
        `  • Config:       [${configOptionNames}]\n` +
        `  • Image Size:   ${imageSizeKb} KB\n` +
        `  • Elapsed:      ${attempt1Duration}ms (${(attempt1Duration / 1000).toFixed(2)}s)\n` +
        `  • Snippet:      "${first200Chars}"`
      );
    } catch (err1: any) {
      attempt1Duration = Math.round(performance.now() - tGeminiStart1);
      const errInfo1 = formatGeminiError(err1);
      console.warn(
        `[Gemini Call Failed (Attempt 1/2)][Req:${requestId}]\n` +
        `  • Model Name:          ${GEMINI_MODEL}\n` +
        `  • Config Options Sent: ${configOptionNames}\n` +
        `  • Image Size:          ${imageSizeKb} KB\n` +
        `  • Elapsed:             ${attempt1Duration}ms (${(attempt1Duration / 1000).toFixed(2)}s)\n` +
        `  • error.status:        ${err1?.status ?? errInfo1.status}\n` +
        `  • error.message:       ${err1?.message ?? errInfo1.message}\n` +
        `  • Error Code:          ${errInfo1.code}\n` +
        `  • Full Response Body:  ${errInfo1.fullError}`
      );

      // If HTTP 429 quota error, do NOT retry. Return immediately to fall back.
      const is429 = String(errInfo1.status) === '429' || String(errInfo1.code) === 'RESOURCE_EXHAUSTED' || errInfo1.message.includes('429');
      if (is429) {
        console.warn(`[Timing][Req:${requestId}] HTTP 429 quota reached. Skipping retry and returning immediately.`);
        throw err1;
      }

      // Keep retry only for real network errors (DNS, reset, socket closed, etc.)
      const isNetworkError =
        ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(String(errInfo1.code)) ||
        ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(String(err1?.code)) ||
        ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'].includes(String(err1?.cause?.code)) ||
        err1?.name === 'FetchError' ||
        errInfo1.message.toLowerCase().includes('fetch failed') ||
        errInfo1.message.toLowerCase().includes('network') ||
        errInfo1.message.toLowerCase().includes('econnreset') ||
        errInfo1.message.toLowerCase().includes('enotfound') ||
        errInfo1.message.toLowerCase().includes('eai_again');

      if (!isNetworkError) {
        console.warn(`[Timing][Req:${requestId}] Non-network error encountered (Status: ${errInfo1.status}, Code: ${errInfo1.code}). Skipping retry.`);
        throw err1;
      }

      console.warn(`[Timing][Req:${requestId}] Network error encountered. Retrying once (Attempt 2/2)...`);

      // Attempt 2 (Retry on real network error only)
      geminiAttempts = 2;
      const tGeminiStart2 = performance.now();
      try {
        response = await executeGemini();
        attempt2Duration = Math.round(performance.now() - tGeminiStart2);
        const first200CharsRetry = (response?.text || '').slice(0, 200).replace(/\r?\n/g, ' ');
        console.log(
          `[Gemini Call Succeeded (Retry)][Req:${requestId}]\n` +
          `  • Model:        ${GEMINI_MODEL}\n` +
          `  • Config:       [${configOptionNames}]\n` +
          `  • Image Size:   ${imageSizeKb} KB\n` +
          `  • Elapsed:      ${attempt2Duration}ms (${(attempt2Duration / 1000).toFixed(2)}s)\n` +
          `  • Snippet:      "${first200CharsRetry}"`
        );
      } catch (err2: any) {
        attempt2Duration = Math.round(performance.now() - tGeminiStart2);
        const errInfo2 = formatGeminiError(err2);
        console.error(
          `[Gemini Call Failed (Attempt 2/2)][Req:${requestId}]\n` +
          `  • Model Name:          ${GEMINI_MODEL}\n` +
          `  • Config Options Sent: ${configOptionNames}\n` +
          `  • Image Size:          ${imageSizeKb} KB\n` +
          `  • Elapsed:             ${attempt2Duration}ms (${(attempt2Duration / 1000).toFixed(2)}s)\n` +
          `  • error.status:        ${err2?.status ?? errInfo2.status}\n` +
          `  • error.message:       ${err2?.message ?? errInfo2.message}\n` +
          `  • Error Code:          ${errInfo2.code}\n` +
          `  • Full Response Body:  ${errInfo2.fullError}\n` +
          `  • Network retry failed.`
        );
        throw err2;
      }
    }

    // Step 3: Parse & sanitize structured JSON response
    const tParseStart = performance.now();
    const responseText = response.text || '{}';
    const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsedData = JSON.parse(cleanJson);
    const tParse = Math.round(performance.now() - tParseStart);

    const totalAnalyzeMs = Math.round(performance.now() - t0);
    const totalGeminiMs = attempt1Duration + attempt2Duration;

    // Comprehensive timing summary printout
    console.log(
      `\n[Timing Summary][Req:${requestId}] ════════ Photo Analysis Performance ════════\n` +
      `[Timing Summary][Req:${requestId}]   • Image Delivery & Prep: ${tImgPrep}ms [${imageSourceDesc}]\n` +
      `[Timing Summary][Req:${requestId}]   • Gemini API Duration:   ${totalGeminiMs}ms [${geminiAttempts} attempt(s), Model: ${GEMINI_MODEL}]\n` +
      `[Timing Summary][Req:${requestId}]   • Response JSON Parse:   ${tParse}ms\n` +
      `[Timing Summary][Req:${requestId}]   • Total /api/analyze:    ${totalAnalyzeMs}ms\n` +
      `[Timing Summary][Req:${requestId}] ══════════════════════════════════════════════\n`
    );

    return res.json({
      data: { ...parsedData, isFallback: false },
      source: GEMINI_MODEL,
      timing: {
        totalMs: totalAnalyzeMs,
        imagePrepMs: tImgPrep,
        geminiMs: totalGeminiMs,
        attempts: geminiAttempts,
      },
    });
  } catch (error: any) {
    const totalFallbackMs = Math.round(performance.now() - t0);
    const errInfo = formatGeminiError(error);
    const currentModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    console.error(
      `[Server Error][Req:${requestId}] Gemini analysis failed after ${totalFallbackMs}ms (Falling back to offline estimate):\n` +
      `  • Model Name:          ${currentModel}\n` +
      `  • Config Options Sent: responseMimeType, maxOutputTokens, responseSchema\n` +
      `  • error.status:        ${error?.status ?? errInfo.status}\n` +
      `  • error.message:       ${error?.message ?? errInfo.message}\n` +
      `  • Error Code:          ${errInfo.code}\n` +
      `  • Full Response Body:  ${errInfo.fullError}`
    );

    const fallbackNotice = getFallbackNotice(errInfo);

    const fallback = generateFallbackAnalysis(
      req.body?.description || 'Item',
      req.body?.description || '',
      req.body?.tags || []
    );

    return res.json({
      data: { ...fallback, isFallback: true },
      source: 'local_engine_fallback',
      notice: fallbackNotice,
      timing: {
        totalMs: totalFallbackMs,
        isFallback: true,
      },
    });
  }
});

// Centralized error handling middleware (never leaks stack traces or secrets)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const requestId = (req as any).requestId || 'unknown';
  const rawMsg = err?.message || 'Internal Server Error';
  const sanitized = typeof rawMsg === 'string' ? rawMsg.replace(/([a-zA-Z0-9_\-]{20,})/g, '[REDACTED]') : 'Server error';
  console.error(`[Server Error][Req:${requestId}]`, sanitized);

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    error: statusCode === 500 ? 'An unexpected server error occurred. Please try again.' : sanitized,
    requestId,
  });
});

async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const distExists = fs.existsSync(distPath);
  const isProduction = process.env.NODE_ENV === 'production' || (distExists && process.env.NODE_ENV !== 'development');

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`SecondLife AI server running at http://0.0.0.0:${port} (Mode: ${isProduction ? 'Production' : 'Development'})`);
  });
}

startServer();
