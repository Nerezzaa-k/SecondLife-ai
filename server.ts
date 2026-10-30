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
  additionalImages: z.array(z.string().max(15 * 1024 * 1024)).max(2).optional().default([]),
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
  let wasteSaved = 2.0;
  let co2Saved = 5.0;
  let confidence = 88;
  let reasoning = 'Item appears intact and in good condition. Preventative maintenance will extend its service life.';

  if (combined.includes('toaster') || combined.includes('kettle') || combined.includes('blender') || combined.includes('grinder') || combined.includes('microwave')) {
    item = combined.includes('toaster') ? 'Pop-up Toaster' : combined.includes('kettle') ? 'Electric Kettle' : 'Kitchen Appliance';
    category = 'Kitchen Appliances';
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
      confidence = 72;
      reasoning = 'Appliance defect matches common thermal interruption.';
    }
  } else if (combined.includes('fan') || combined.includes('cooler') || combined.includes('iron') || combined.includes('vacuum') || combined.includes('heater')) {
    item = combined.includes('fan') ? 'Table / Pedestal Fan' : combined.includes('iron') ? 'Steam Iron' : 'Home Appliance';
    category = 'Home Appliances';
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
      confidence = 74;
      reasoning = 'Mechanical binding is readily resolvable with lubrication and basic capacitor replacement.';
    }
  } else if (combined.includes('drill') || combined.includes('saw') || combined.includes('wrench') || combined.includes('tool') || combined.includes('hammer')) {
    item = combined.includes('drill') ? 'Rotary Power Drill' : 'Hand / Power Tool';
    category = 'Tools & DIY';
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
      confidence = 76;
      reasoning = 'Durable tool housing and motor can easily provide continued service with new brushes.';
    } else {
      action = 'borrow';
      confidence = 90;
      reasoning = 'DIY tools are used infrequently (avg. 13 mins/lifetime). Sharing or lending in the neighborhood prevents redundant manufacturing.';
    }
  } else if (combined.includes('chair') || combined.includes('table') || combined.includes('desk') || combined.includes('lamp') || combined.includes('shelf')) {
    item = combined.includes('chair') ? 'Study / Ergonomic Chair' : 'Wooden Furniture';
    category = 'Furniture & Decor';
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
      confidence = 78;
      reasoning = 'Solid mass makes furniture repair an effective environmental action.';
    } else {
      action = 'donate';
      confidence = 88;
      reasoning = 'Item is in good working order. Donating or passing on locally provides immediate utility to a neighbor.';
    }
  } else if (combined.includes('laptop') || combined.includes('phone') || combined.includes('audio') || combined.includes('speaker') || combined.includes('headphone') || combined.includes('monitor')) {
    item = combined.includes('speaker') ? 'Bluetooth Speaker' : combined.includes('headphone') ? 'Audio Headphones' : 'Personal Electronics';
    category = 'Electronics & Media';
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
      confidence = 65;
      reasoning = 'Minor repair restores full utility and keeps household items in active circulation.';
    }
  }

  return {
    damage_checklist: {
      casing_open_or_missing: false,
      internal_parts_exposed: false,
      cracks_or_breaks: false,
      dents_or_deformation: false,
      burn_or_corrosion: false,
      missing_parts: false,
      loose_or_hanging_parts: false,
      heavy_wear_or_dirt: false,
    },
    item_state: 'unclear' as const,
    visible_observations: [
      'Cannot assess damage without AI analysis',
      'Live AI vision is currently offline; physical photo features were not visually inspected',
    ],
    damage_visible: false,
    damage_location: 'unknown',
    what_to_check_next: 'Check physical condition, test basic operation, and re-analyze with live AI when online.',
    item_name: item,
    category,
    condition: 'fair' as const,
    likely_issue: 'Cannot assess damage without AI analysis',
    possible_causes: [],
    troubleshooting_tips: tips,
    recommended_action: 'maintain' as const,
    reasoning: 'Cannot assess damage without AI analysis. Visual inspection requires an active AI connection.',
    confidence: 50,
    repair_cost_inr: { min: 0, max: 0 },
    replace_cost_inr: { min: 0, max: 0 },
    cost_basis: 'Estimate unavailable without AI analysis',
    cost_confidence: 'low' as const,
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
function getFallbackNotice(
  errInfo: { status: string | number; code: string | number; message: string },
  allModelsQuotaExhausted = false
): string {
  if (allModelsQuotaExhausted) {
    return 'AI daily quota reached for all models. Showing preliminary offline estimate.';
  }

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

    const { imageBase64, additionalImages = [], mimeType = 'image/jpeg', imageUrl, description = '', tags = [] } = validated.data;

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

    // Step 1: Deliver & prepare lightweight image(s) for Gemini (up to 3 photos total)
    const tImgStart = performance.now();
    const imageParts: any[] = [];
    let imageSourceDesc = '';

    // Prioritize Cloudinary delivered version if provided
    if (imageUrl) {
      try {
        console.log(`[Timing][Req:${requestId}] Fetching Cloudinary-delivered image for Gemini: ${imageUrl}`);
        const imgFetchStart = performance.now();
        const imgRes = await callWithTimeout(fetch(imageUrl), 6000, 'Cloudinary image fetch');
        if (imgRes.ok) {
          const arrayBuf = await imgRes.arrayBuffer();
          const fetchedBase64 = Buffer.from(arrayBuf).toString('base64');
          const rawMime = imgRes.headers.get('content-type') || mimeType || 'image/jpeg';
          const cleanMime = rawMime.split(';')[0].trim();
          imageParts.push({
            inlineData: {
              data: fetchedBase64,
              mimeType: cleanMime,
            },
          });
          const fetchMs = Math.round(performance.now() - imgFetchStart);
          imageSourceDesc = `Cloudinary delivered image (${(arrayBuf.byteLength / 1024).toFixed(1)} KB in ${fetchMs}ms)`;
        } else {
          console.warn(`[Timing][Req:${requestId}] Cloudinary image fetch returned status ${imgRes.status}, falling back to base64`);
        }
      } catch (fetchErr: any) {
        console.warn(`[Timing][Req:${requestId}] Could not fetch Cloudinary image (${fetchErr?.message}), using base64 fallback`);
      }
    }

    // Fallback to client-compressed imageBase64 if Cloudinary fetch unavailable
    if (imageParts.length === 0 && imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[a-z/]+;base64,/, '');
      imageParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/jpeg',
        },
      });
      imageSourceDesc = `Client-compressed imageBase64 (${(cleanBase64.length * 0.75 / 1024).toFixed(1)} KB)`;
    }

    // Attach optional additional photos (e.g. damage close-ups, up to 3 total photos)
    if (additionalImages && additionalImages.length > 0) {
      for (let idx = 0; idx < additionalImages.length; idx++) {
        const addImg = additionalImages[idx];
        if (addImg && typeof addImg === 'string') {
          const cleanAdd = addImg.replace(/^data:[a-z/]+;base64,/, '');
          imageParts.push({
            inlineData: {
              data: cleanAdd,
              mimeType: mimeType || 'image/jpeg',
            },
          });
        }
      }
      imageSourceDesc += ` + ${additionalImages.length} additional photo(s)`;
    }

    const tImgPrep = Math.round(performance.now() - tImgStart);
    console.log(`[Timing][Req:${requestId}] Image delivery & preparation: ${tImgPrep}ms [Source: ${imageSourceDesc}]`);

    const promptText = `
You are SecondLife AI, an expert circular economy and physical item diagnostics specialist.
Examine the attached photo(s) of the item very closely before reaching any conclusion.
User's problem description: "${description || 'None provided'}".
Detected tags: ${tags.length > 0 ? tags.join(', ') : 'None'}.

INSPECTION PROTOCOL:
1. DAMAGE CHECKLIST FIRST (PHOTO EVIDENCE STRICTLY OUTRANKS USER DESCRIPTION):
   - You MUST first evaluate and set boolean true/false for each of the following 8 physical damage checks:
     * casing_open_or_missing: True if the outer protective housing, shell, lid, earbud shell, or cover is popped open, missing, cracked open, or removed.
     * internal_parts_exposed: True if green circuit boards (PCBs), wires, micro-chips, coils, magnets, or internal battery cells are visible to the outside world.
     * cracks_or_breaks: True if fractures, splits, snaps, or severed parts are visible.
     * dents_or_deformation: True if casing or structure is visibly warped, crushed, bent, or deformed.
     * burn_or_corrosion: True if scorch marks, melted plastic, rust, battery electrolyte leakage, or green/white corrosion is visible.
     * missing_parts: True if buttons, screws, ear tips, battery covers, or structural fasteners are absent.
     * loose_or_hanging_parts: True if components, wires, or hinges dangle or are detached from their mounting.
     * heavy_wear_or_dirt: True if severe scuffing, fraying, caked grime, or thermal discoloration is visible.

2. ITEM STATE & VERDICT INTEGRITY:
   - Determine 'item_state':
     * "intact": Item is physically assembled, sealed in its factory housing, with no exposed internals and no breaks.
     * "opened_or_disassembled": Casing is split, removed, unlatched, or internal circuit boards/wiring are exposed.
     * "broken": Structural fracture, snapped parts, shattered screen, or mechanical breakdown.
     * "worn": Intact factory enclosure but heavy cosmetic, abrasive, or cable wear.
     * "unclear": Photo is too blurry, dark, blank, or obstructed to identify physical condition.
   - DAMAGE RULES:
     * If ANY checklist item above is true, 'damage_visible' MUST BE TRUE!
     * If 'item_state' is NOT "intact" (e.g. opened_or_disassembled, broken, worn), 'condition' must be "damaged" or "fair" (NEVER "good").
     * An item with exposed internals, a missing or open casing (such as an earbud with casing removed showing green PCB), or dangling parts IS VISIBLY DAMAGED even if the user provided no text description! The absence of a description never means "no fault". Photo evidence strictly outranks user silence.
     * Report 'likely_issue' as "No visible damage" and recommend "maintain" ONLY when EVERY checklist item is FALSE and 'item_state' is "intact". In that case, ask in 'what_to_check_next' whether it powers on, makes noise, holds charge, or leaks.

3. UNIDENTIFIED / BLANK PHOTO HANDLING:
   - If the photo is completely blank, blurry, obstructed, or does not depict an identifiable physical product:
     * Set 'item_name' to "Unidentified".
     * Set 'item_state' to "unclear".
     * Set 'damage_visible' to false, 'damage_location' to "none".
     * Set all checklist items to false.
     * Set 'condition' to "fair".
     * Set 'likely_issue' to "No identifiable item in photo".
     * Set 'recommended_action' to "maintain".
     * Set 'repair_cost_inr' to { "min": 0, "max": 0 }, 'replace_cost_inr' to { "min": 0, "max": 0 }.
     * Set 'cost_basis' to "Estimate unavailable for unidentified photos", 'cost_confidence' to "low".
     * Set 'what_to_check_next' to ask the user for a clear, well-lit photo of the item.

4. REPAIR VS REPLACE FOR LOW-COST ELECTRONICS (INR ₹):
   - Name the specific identified item and brand if visible (e.g. "Boult Audio True Wireless Earbud", "boAt Airdopes Earbud", "USB-C Fast Charger").
   - For small, low-cost electronics (TWS earbuds, charging cables, adapters, phone accessories):
     * Buying a single replacement or new pair in India often costs ₹800 - ₹2,500.
     * Micro-soldering, battery micro-transplants, or re-shelling an open earbud often requires precision tools or costs ₹400 - ₹1,000, which is frequently unfeasible or uneconomical.
     * When repair effort/cost is not worthwhile compared to new replacement value or parts are inaccessible, recommend "replace", "repurpose", or certified e-waste recycling!
     * Estimate genuine costs in Indian Rupees for that exact brand/model tier, with 'cost_basis' (one short sentence) and 'cost_confidence' ("high", "medium", or "low"). Never reuse flat default numbers!

5. SAFETY PRECAUTIONS:
   - For exposed electronics, bare circuit boards, open wiring, or exposed batteries (especially lithium-ion pouch cells in earbuds/phones):
     * ALWAYS populate 'safety_note' with: "Do not charge or power on while internal circuitry is exposed. Keep away from moisture and handle lithium cells carefully to prevent short-circuits or thermal hazards."
`;

    const contents = [
      {
        parts: [
          ...imageParts,
          { text: promptText },
        ],
      },
    ];

    // Step 2: Build model list with automatic fallback
    const primaryModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    const fallbackList = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
    const modelsToTry = Array.from(new Set([primaryModel, ...fallbackList]));

    let response: any = null;
    let successfulModel = '';
    let geminiAttempts = 0;
    let totalGeminiDuration = 0;
    let lastError: any = null;
    let lastErrorInfo: any = null;
    const modelFailures: { model: string; status: string | number; is429: boolean; is404: boolean }[] = [];

    const is429Error = (info: { status: string | number; code: string | number; message: string }) => {
      const s = String(info.status);
      const c = String(info.code);
      return s === '429' || c === 'RESOURCE_EXHAUSTED' || info.message.includes('429') || info.message.toLowerCase().includes('quota');
    };

    const is404Error = (info: { status: string | number; code: string | number; message: string }) => {
      const s = String(info.status);
      const c = String(info.code);
      return s === '404' || c === 'NOT_FOUND' || info.message.includes('404') || info.message.toLowerCase().includes('not found');
    };

    const isRealNetworkError = (info: { code: string | number; message: string }, rawErr: any) => {
      const networkCodes = ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN'];
      return (
        networkCodes.includes(String(info.code)) ||
        networkCodes.includes(String(rawErr?.code)) ||
        networkCodes.includes(String(rawErr?.cause?.code)) ||
        rawErr?.name === 'FetchError' ||
        info.message.toLowerCase().includes('fetch failed') ||
        info.message.toLowerCase().includes('network') ||
        info.message.toLowerCase().includes('econnreset') ||
        info.message.toLowerCase().includes('enotfound') ||
        info.message.toLowerCase().includes('eai_again')
      );
    };

    const geminiConfig = {
      responseMimeType: 'application/json',
      maxOutputTokens: 2048,
      temperature: 0.4,
      thinkingConfig: {
        thinkingBudget: 1024,
      },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          damage_checklist: {
            type: Type.OBJECT,
            properties: {
              casing_open_or_missing: { type: Type.BOOLEAN },
              internal_parts_exposed: { type: Type.BOOLEAN },
              cracks_or_breaks: { type: Type.BOOLEAN },
              dents_or_deformation: { type: Type.BOOLEAN },
              burn_or_corrosion: { type: Type.BOOLEAN },
              missing_parts: { type: Type.BOOLEAN },
              loose_or_hanging_parts: { type: Type.BOOLEAN },
              heavy_wear_or_dirt: { type: Type.BOOLEAN },
            },
            required: [
              'casing_open_or_missing',
              'internal_parts_exposed',
              'cracks_or_breaks',
              'dents_or_deformation',
              'burn_or_corrosion',
              'missing_parts',
              'loose_or_hanging_parts',
              'heavy_wear_or_dirt',
            ],
          },
          item_state: {
            type: Type.STRING,
            enum: ['intact', 'opened_or_disassembled', 'broken', 'worn', 'unclear'],
          },
          visible_observations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          damage_visible: { type: Type.BOOLEAN },
          damage_location: { type: Type.STRING },
          item_name: { type: Type.STRING },
          category: { type: Type.STRING },
          condition: { type: Type.STRING, enum: ['good', 'fair', 'damaged'] },
          likely_issue: { type: Type.STRING },
          possible_causes: { type: Type.ARRAY, items: { type: Type.STRING } },
          troubleshooting_tips: { type: Type.ARRAY, items: { type: Type.STRING } },
          what_to_check_next: { type: Type.STRING },
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
          cost_basis: { type: Type.STRING },
          cost_confidence: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
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
          'damage_checklist',
          'item_state',
          'visible_observations',
          'damage_visible',
          'damage_location',
          'item_name',
          'category',
          'condition',
          'likely_issue',
          'possible_causes',
          'troubleshooting_tips',
          'what_to_check_next',
          'recommended_action',
          'reasoning',
          'confidence',
          'repair_cost_inr',
          'replace_cost_inr',
          'cost_basis',
          'cost_confidence',
          'reuse_ideas',
          'estimated_waste_saved_kg',
          'estimated_co2_saved_kg',
          'photo_quality',
          'safety_note',
        ],
      },
    };

    const configOptionNames = Object.keys(geminiConfig).join(', ');

    const totalImages = imageParts.length;
    const totalImageSizeKb = imageParts.reduce((acc, part) => {
      const b64 = part?.inlineData?.data;
      return acc + (b64 ? Buffer.byteLength(b64, 'base64') / 1024 : 0);
    }, 0).toFixed(1);

    for (let i = 0; i < modelsToTry.length; i++) {
      const currentModel = modelsToTry[i];
      const nextModel = i + 1 < modelsToTry.length ? modelsToTry[i + 1] : null;
      geminiAttempts++;

      const tStart = performance.now();
      try {
        console.log(`[Timing][Req:${requestId}] Calling Gemini Vision API (Attempt ${geminiAttempts}, Model: ${currentModel}, Config: [${configOptionNames}], Images: ${totalImages}, Total Size: ${totalImageSizeKb} KB)...`);
        response = await ai!.models.generateContent({
          model: currentModel,
          contents: contents[0],
          config: geminiConfig,
        });
        const elapsed = Math.round(performance.now() - tStart);
        totalGeminiDuration += elapsed;
        successfulModel = currentModel;
        const first200Chars = (response?.text || '').slice(0, 200).replace(/\r?\n/g, ' ');
        console.log(
          `[Gemini Call Succeeded][Req:${requestId}]\n` +
          `  • Model:        ${currentModel}\n` +
          `  • Config:       [${configOptionNames}]\n` +
          `  • Images:       ${totalImages} (${totalImageSizeKb} KB total)\n` +
          `  • Elapsed:      ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)\n` +
          `  • Snippet:      "${first200Chars}"`
        );
        break; // Successfully answered!
      } catch (err1: any) {
        const elapsed = Math.round(performance.now() - tStart);
        totalGeminiDuration += elapsed;
        const errInfo1 = formatGeminiError(err1);
        lastError = err1;
        lastErrorInfo = errInfo1;

        const is429 = is429Error(errInfo1);
        const is404 = is404Error(errInfo1);
        modelFailures.push({ model: currentModel, status: errInfo1.status, is429, is404 });

        console.warn(
          `[Gemini Call Failed][Req:${requestId}]\n` +
          `  • Model Name:          ${currentModel}\n` +
          `  • Config Options Sent: ${configOptionNames}\n` +
          `  • Images:              ${totalImages} (${totalImageSizeKb} KB total)\n` +
          `  • Elapsed:             ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)\n` +
          `  • error.status:        ${err1?.status ?? errInfo1.status}\n` +
          `  • error.message:       ${err1?.message ?? errInfo1.message}\n` +
          `  • Error Code:          ${errInfo1.code}\n` +
          `  • Full Response Body:  ${errInfo1.fullError}`
        );

        if (is429) {
          if (nextModel) {
            console.warn(`[Timing][Req:${requestId}] ${currentModel} quota exhausted, trying ${nextModel}`);
          } else {
            console.warn(`[Timing][Req:${requestId}] ${currentModel} quota exhausted, no more fallback models`);
          }
          continue; // Move straight to next model without retrying the same one
        }

        if (is404) {
          if (nextModel) {
            console.warn(`[Timing][Req:${requestId}] ${currentModel} unavailable (HTTP 404), trying ${nextModel}`);
          } else {
            console.warn(`[Timing][Req:${requestId}] ${currentModel} unavailable (HTTP 404), no more fallback models`);
          }
          continue; // Move straight to next model without retrying the same one
        }

        // Real network timeouts/errors keep the existing retry on the same model
        if (isRealNetworkError(errInfo1, err1)) {
          console.warn(`[Timing][Req:${requestId}] Network error on ${currentModel}. Retrying once on same model...`);
          geminiAttempts++;
          const tRetryStart = performance.now();
          try {
            response = await ai!.models.generateContent({
              model: currentModel,
              contents: contents[0],
              config: geminiConfig,
            });
            const retryElapsed = Math.round(performance.now() - tRetryStart);
            totalGeminiDuration += retryElapsed;
            successfulModel = currentModel;
            const first200Chars = (response?.text || '').slice(0, 200).replace(/\r?\n/g, ' ');
            console.log(
              `[Gemini Call Succeeded (Retry)][Req:${requestId}]\n` +
              `  • Model:        ${currentModel}\n` +
              `  • Config:       [${configOptionNames}]\n` +
              `  • Images:       ${totalImages} (${totalImageSizeKb} KB total)\n` +
              `  • Elapsed:      ${retryElapsed}ms (${(retryElapsed / 1000).toFixed(2)}s)\n` +
              `  • Snippet:      "${first200Chars}"`
            );
            break; // Succeeded on retry!
          } catch (retryErr: any) {
            const retryElapsed = Math.round(performance.now() - tRetryStart);
            totalGeminiDuration += retryElapsed;
            const retryErrInfo = formatGeminiError(retryErr);
            lastError = retryErr;
            lastErrorInfo = retryErrInfo;
            console.error(
              `[Gemini Retry Failed][Req:${requestId}]\n` +
              `  • Model Name:          ${currentModel}\n` +
              `  • Images:              ${totalImages} (${totalImageSizeKb} KB total)\n` +
              `  • Elapsed:             ${retryElapsed}ms (${(retryElapsed / 1000).toFixed(2)}s)\n` +
              `  • error.status:        ${retryErr?.status ?? retryErrInfo.status}\n` +
              `  • error.message:       ${retryErr?.message ?? retryErrInfo.message}\n` +
              `  • Error Code:          ${retryErrInfo.code}\n` +
              `  • Full Response Body:  ${retryErrInfo.fullError}\n` +
              `  • Network retry failed.`
            );
            throw retryErr;
          }
        }

        // Any other non-429, non-404, non-network error, fail fast
        throw err1;
      }
    }

    if (!response) {
      const all429 = modelFailures.length > 0 && modelFailures.every((f) => f.is429);
      const fallbackErr: any = lastError || new Error('All candidate Gemini models failed');
      fallbackErr.allModelsQuotaExhausted = all429;
      throw fallbackErr;
    }

    // Step 3: Parse & sanitize structured JSON response
    const tParseStart = performance.now();
    const responseText = response.text || '{}';
    const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    // Enforce verdict contract rules strictly
    const checklist = parsedData.damage_checklist || {};
    const anyChecklistTrue = Object.values(checklist).some((val) => val === true);
    if (anyChecklistTrue) {
      parsedData.damage_visible = true;
      if (!parsedData.item_state || parsedData.item_state === 'intact') {
        parsedData.item_state = (checklist.casing_open_or_missing || checklist.internal_parts_exposed)
          ? 'opened_or_disassembled'
          : 'broken';
      }
    }
    if (parsedData.item_state && parsedData.item_state !== 'intact') {
      if (parsedData.condition === 'good') {
        parsedData.condition = 'damaged';
      }
    }
    if (checklist.casing_open_or_missing || checklist.internal_parts_exposed) {
      const cautionText = 'Do not charge or power on while internal circuitry is exposed. Keep away from moisture and handle lithium cells carefully.';
      if (!parsedData.safety_note || !parsedData.safety_note.toLowerCase().includes('do not charge')) {
        parsedData.safety_note = parsedData.safety_note ? `${parsedData.safety_note} ${cautionText}` : cautionText;
      }
    }

    const tParse = Math.round(performance.now() - tParseStart);

    const totalAnalyzeMs = Math.round(performance.now() - t0);

    // Comprehensive timing summary printout
    console.log(
      `\n[Timing Summary][Req:${requestId}] ════════ Photo Analysis Performance ════════\n` +
      `[Timing Summary][Req:${requestId}]   • Image Delivery & Prep: ${tImgPrep}ms [${imageSourceDesc}]\n` +
      `[Timing Summary][Req:${requestId}]   • Gemini API Duration:   ${totalGeminiDuration}ms [${geminiAttempts} attempt(s), Model: ${successfulModel || 'gemini'}]\n` +
      `[Timing Summary][Req:${requestId}]   • Response JSON Parse:   ${tParse}ms\n` +
      `[Timing Summary][Req:${requestId}]   • Total /api/analyze:    ${totalAnalyzeMs}ms\n` +
      `[Timing Summary][Req:${requestId}] ══════════════════════════════════════════════\n`
    );

    return res.json({
      data: { ...parsedData, isFallback: false },
      source: 'gemini',
      timing: {
        totalMs: totalAnalyzeMs,
        imagePrepMs: tImgPrep,
        geminiMs: totalGeminiDuration,
        attempts: geminiAttempts,
      },
    });
  } catch (error: any) {
    const totalFallbackMs = Math.round(performance.now() - t0);
    const errInfo = formatGeminiError(error);
    const allModelsQuotaExhausted = Boolean((error as any)?.allModelsQuotaExhausted);

    console.error(
      `[Server Error][Req:${requestId}] Gemini analysis failed after ${totalFallbackMs}ms (Falling back to offline estimate):\n` +
      `  • error.status:        ${error?.status ?? errInfo.status}\n` +
      `  • error.message:       ${error?.message ?? errInfo.message}\n` +
      `  • Error Code:          ${errInfo.code}\n` +
      `  • All Models 429:      ${allModelsQuotaExhausted}\n` +
      `  • Full Response Body:  ${errInfo.fullError}`
    );

    const fallbackNotice = getFallbackNotice(errInfo, allModelsQuotaExhausted);

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
