import { CloudinaryAsset, CloudinaryTransformationInfo } from '../types';
import { supabase } from './supabase';
import { compressAndResizeImage } from '../utils/imageCompressor';

/**
 * CLOUDINARY CONFIGURATION (PRODUCTION ARCHITECTURE)
 * Cloudinary API Keys and Secrets are kept strictly server-side in .env.
 * The frontend fetches public configuration (cloud name) and dispatches
 * uploads either directly via secure signatures (POST /api/cloudinary/signature)
 * or through the secure server fallback endpoint (/api/upload).
 */

export const CLOUDINARY_CLOUD_NAME = "server-managed";
export const CLOUDINARY_UPLOAD_PRESET = "server-managed";

let cachedCloudName = 'demo';
let isServerConfigured = false;
let configFetched = false;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Validates file type and size on client
 */
export function validateImageFile(file: File | Blob): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMB} MB) exceeds maximum allowed limit of 10 MB.`,
    };
  }

  const fileType = file.type?.toLowerCase() || '';
  const fileName = (file as File).name?.toLowerCase() || '';
  const hasAllowedExt = /\.(jpe?g|png|webp|heic)$/i.test(fileName);
  const hasAllowedMime = ALLOWED_MIME_TYPES.includes(fileType);

  if (fileType && !hasAllowedMime && !hasAllowedExt) {
    return {
      valid: false,
      error: 'Invalid file format. Allowed formats: JPG, PNG, WEBP, and HEIC.',
    };
  }

  return { valid: true };
}

/**
 * Fetches non-sensitive Cloudinary configuration from the server.
 */
export async function syncCloudinaryConfigFromServer(): Promise<{ cloudName: string; isConfigured: boolean }> {
  try {
    const res = await fetch('/api/config/cloudinary');
    if (res.ok) {
      const data = await res.json();
      cachedCloudName = data.cloudName || 'demo';
      isServerConfigured = Boolean(data.configured);
      configFetched = true;
      return { cloudName: cachedCloudName, isConfigured: isServerConfigured };
    }
  } catch (err) {
    console.debug('Cloudinary config sync error (using local cache):', err);
  }
  return { cloudName: cachedCloudName, isConfigured: isServerConfigured };
}

// Initial eager sync in browser environment
if (typeof window !== 'undefined') {
  syncCloudinaryConfigFromServer();
}

export function getActiveCloudName(): string {
  return cachedCloudName;
}

export function getActiveUploadPreset(): string {
  return 'server-managed';
}

export function isUsingPlaceholderConfig(): boolean {
  return !isServerConfigured;
}

/**
 * Legacy compatibility helper: notifies user that credentials belong in .env
 */
export function saveCustomCloudinaryConfig(_cloudName: string, _preset: string) {
  console.info('Production mode: Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your server .env file.');
}

/**
 * Builds Cloudinary delivery URL with specified transformations
 */
export function buildCloudinaryUrl(
  publicId: string,
  transformations: string,
  cloudName: string = getActiveCloudName()
): string {
  const cloud = (cloudName === 'server-managed' || cloudName === 'YOUR_CLOUD_NAME' || !cloudName) ? 'demo' : cloudName;
  const cleanId = publicId.replace(/^\//, '');
  return `https://res.cloudinary.com/${cloud}/image/upload/${transformations}/${cleanId}`;
}

/**
 * a) Cleaned cutout: e_background_removal
 */
export function buildCleanedCutoutUrl(publicId: string, cloudName?: string): string {
  return buildCloudinaryUrl(publicId, 'e_background_removal,f_auto,q_auto', cloudName);
}

/**
 * b) Thumbnails: c_fill,g_auto,w_400,h_400,f_auto,q_auto on every listing card
 */
export function buildThumbnailUrl(publicId: string, cloudName?: string, w = 400, h = 400): string {
  return buildCloudinaryUrl(publicId, `c_fill,g_auto,w_${w},h_${h},f_auto,q_auto`, cloudName);
}

/**
 * c) Damage close-up: use c_crop/g_auto zoom on the item to show a "Focus area" image
 */
export function buildDamageCloseupUrl(publicId: string, cloudName?: string): string {
  return buildCloudinaryUrl(publicId, 'c_crop,g_auto,w_500,h_500,z_1.7,f_auto,q_auto', cloudName);
}

/**
 * Phase 5B: Responsive srcset generator with width breakpoints (320, 640, 960)
 */
export function buildCloudinarySrcSet(
  publicId: string,
  widths: number[] = [320, 640, 960],
  cloudName: string = getActiveCloudName()
): string {
  if (!publicId) return '';
  return widths
    .map((w) => `${buildCloudinaryUrl(publicId, `c_fill,g_auto,w_${w},f_auto,q_auto`, cloudName)} ${w}w`)
    .join(', ');
}

/**
 * Phase 5B: Low-Quality Image Placeholder (LQIP) with heavy blur (e_blur:1000)
 */
export function buildLqipUrl(
  publicId: string,
  cloudName: string = getActiveCloudName()
): string {
  if (!publicId) return '';
  return buildCloudinaryUrl(publicId, 'c_fill,g_auto,w_40,e_blur:1000,f_auto,q_10', cloudName);
}

/**
 * Phase 5B: Optimized condition video delivery URL (f_auto, q_auto)
 */
export function buildCloudinaryVideoUrl(
  publicId: string,
  transformations: string = 'f_auto,q_auto',
  cloudName: string = getActiveCloudName()
): string {
  const cloud = (cloudName === 'server-managed' || cloudName === 'YOUR_CLOUD_NAME' || !cloudName) ? 'demo' : cloudName;
  const cleanId = publicId.replace(/^\//, '');
  return `https://res.cloudinary.com/${cloud}/video/upload/${transformations}/${cleanId}`;
}

/**
 * Phase 5B: Video poster frame image generated by Cloudinary (so_0 on video URL)
 */
export function buildVideoPosterUrl(
  publicId: string,
  cloudName: string = getActiveCloudName()
): string {
  const cloud = (cloudName === 'server-managed' || cloudName === 'YOUR_CLOUD_NAME' || !cloudName) ? 'demo' : cloudName;
  const cleanId = publicId.replace(/^\//, '').replace(/\.[^/.]+$/, '');
  return `https://res.cloudinary.com/${cloud}/video/upload/so_0,f_auto,q_auto/${cleanId}.jpg`;
}

/**
 * Encodes text safely for Cloudinary l_text transformation parameters.
 * Cloudinary interprets unencoded commas and slashes as delimiters.
 */
function safeCloudinaryText(text: string): string {
  return encodeURIComponent(text)
    .replace(/,/g, '%2C')
    .replace(/\//g, '%2F')
    .replace(/\?/g, '%3F')
    .replace(/#/g, '%23')
    .replace(/!/g, '%21');
}

/**
 * d) Shareable impact card: l_text overlay transformations on a branded base image
 * Text: "I saved X kg waste and Y kg CO2 with SecondLife AI"
 */
export function buildShareableImpactCardUrl(
  publicId: string,
  wasteSavedKg: number,
  co2SavedKg: number,
  userName: string,
  cloudName?: string
): string {
  const textMessage = safeCloudinaryText(`I saved ${wasteSavedKg} kg waste and ${co2SavedKg} kg CO2 with SecondLife AI`);
  const authorText = safeCloudinaryText(`Action by ${userName} • #CircularEconomy`);
  
  // Cloudinary layered text overlay transformations
  const transformations = [
    'c_fill,w_800,h_500,b_rgb:1b4d3e',
    'e_brightness:-20',
    `l_text:Arial_32_bold:${textMessage},co_rgb:ffffff,g_center,y_-30`,
    `l_text:Arial_20:${authorText},co_rgb:86efac,g_center,y_50`,
    'l_text:Arial_18_bold:SecondLife%20AI%20%7C%20Smart%20Choices.%20Longer%20Lives.,co_rgb:2e9e6b,g_south,y_30',
  ].join('/');

  return buildCloudinaryUrl(publicId || 'sample', transformations, cloudName);
}

/**
 * Converts File or Blob to base64 string
 */
function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Measures delivered bytes vs original bytes using HEAD request through server proxy
 */
export async function measureDeliveredBytes(
  deliveryUrl: string,
  originalBytes?: number
): Promise<{
  deliveredBytes: number;
  originalBytes: number;
  savedPercent: number;
  formattedOriginal: string;
  formattedDelivered: string;
}> {
  try {
    const params = new URLSearchParams({
      url: deliveryUrl,
      originalBytes: String(originalBytes || 0),
    });
    const res = await fetch(`/api/cloudinary/measure?${params.toString()}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug('Failed to measure delivered bytes via server, using estimation:', err);
  }

  // Graceful estimation fallback
  const orig = originalBytes && originalBytes > 0 ? originalBytes : 1.5 * 1024 * 1024;
  const deliv = Math.round(orig * 0.22); // typical webp/q_auto savings
  const saved = Math.round(((orig - deliv) / orig) * 100);

  return {
    deliveredBytes: deliv,
    originalBytes: orig,
    savedPercent: saved,
    formattedOriginal: (orig / (1024 * 1024)).toFixed(2) + ' MB',
    formattedDelivered: (deliv / 1024).toFixed(1) + ' KB',
  };
}

/**
 * Performs signed upload directly to Cloudinary when authenticated,
 * falling back gracefully to server endpoint `/api/upload`.
 */
export async function uploadImageToCloudinary(
  file: File | Blob,
  onProgress?: (progress: number) => void,
  sessionToken?: string
): Promise<{ asset: CloudinaryAsset; notice?: string }> {
  // 1. Enforce file size and type limits on client
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file.');
  }

  // Ensure freshest config
  if (!configFetched) {
    await syncCloudinaryConfigFromServer();
  }

  const localPreviewUrl = URL.createObjectURL(file);

  // Pre-compress and resize image in browser (max 1600px, quality 0.85, skip tiny images)
  if (onProgress) onProgress(10);
  const compression = await compressAndResizeImage(file, 1600, 0.85);
  const uploadFile = compression.file;
  const precompressedBase64 = compression.base64;

  // 2. Determine auth token
  let authToken = sessionToken;
  if (!authToken) {
    try {
      const { data } = await supabase.auth.getSession();
      authToken = data.session?.access_token;
    } catch (e) {
      // not logged in
    }
  }

  // 3. Try Direct Signed Upload if authenticated
  if (authToken) {
    try {
      if (onProgress) onProgress(20);
      const fileName = (uploadFile as File).name || 'upload.jpg';
      const mimeType = uploadFile.type || 'image/jpeg';

      const sigRes = await fetch('/api/cloudinary/signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fileName,
          fileSize: uploadFile.size,
          mimeType,
        }),
      });

      if (sigRes.ok) {
        const sigData = await sigRes.json();
        if (onProgress) onProgress(35);

        // Upload directly to Cloudinary using the signature
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('api_key', sigData.apiKey);
        formData.append('timestamp', String(sigData.timestamp));
        formData.append('signature', sigData.signature);
        formData.append('folder', sigData.folder);
        if (sigData.moderation) {
          formData.append('moderation', sigData.moderation);
        }
        if (sigData.tags) {
          formData.append('tags', sigData.tags);
        }

        const cloud = sigData.cloudName || getActiveCloudName();
        const uploadUrl = `https://api.cloudinary.com/v1_1/${cloud}/image/upload`;

        const uploadRes = await fetch(uploadUrl, {
          method: 'POST',
          body: formData,
        });

        if (onProgress) onProgress(80);

        if (uploadRes.ok) {
          const cloudData = await uploadRes.json();
          console.log('[Cloudinary Direct Upload Response]:', cloudData);

          // Check moderation status from upload response
          let moderationStatus: 'approved' | 'rejected' | 'pending' | 'unmoderated' = 'unmoderated';
          if (Array.isArray(cloudData.moderation) && cloudData.moderation.length > 0) {
            const firstMod = cloudData.moderation[0];
            moderationStatus = firstMod.status || 'pending';
          } else if (cloudData.moderation_status) {
            moderationStatus = cloudData.moderation_status;
          }

          if (moderationStatus === 'rejected') {
            throw new Error("This photo can't be used. Please upload a clear photo of the item.");
          }

          const originalBytes = cloudData.bytes || uploadFile.size;
          const publicId = cloudData.public_id;
          const originalUrl = cloudData.secure_url || buildCloudinaryUrl(publicId, 'f_auto,q_auto', cloud);
          const cleanedUrl = buildCleanedCutoutUrl(publicId, cloud);
          const thumbnailUrl = buildThumbnailUrl(publicId, cloud);
          const damageCloseupUrl = buildDamageCloseupUrl(publicId, cloud);
          const shareableCardUrl = buildShareableImpactCardUrl(publicId, 2.5, 4.8, 'SecondLife Contributor', cloud);

          // Instant estimate of delivered bytes so we don't delay analysis with blocking network HEAD request
          const estDelivered = Math.round(originalBytes * 0.18);
          const estSaved = Math.max(0, Math.round(((originalBytes - estDelivered) / originalBytes) * 100));

          if (onProgress) onProgress(100);

          const asset: CloudinaryAsset = {
            publicId,
            originalUrl,
            cleanedUrl,
            thumbnailUrl,
            damageCloseupUrl,
            shareableCardUrl,
            tags: Array.isArray(cloudData.tags) ? cloudData.tags : [],
            bytes: originalBytes,
            deliveredBytes: estDelivered,
            savedPercent: estSaved,
            moderationStatus,
            phash: cloudData.phash || undefined,
            isDemoFallback: false,
            transformations: [
              {
                name: 'Signed Secure Upload',
                code: 'folder_scoped_signed',
                description: `Scoped to user directory (${sigData.folder})`,
                status: 'applied',
              },
              {
                name: 'Auto-Format & Quality',
                code: 'f_auto,q_auto',
                description: `Saved ${estSaved}% bandwidth`,
                status: 'applied',
              },
              {
                name: 'AI Background Cutout',
                code: 'e_background_removal',
                description: 'Pre-generated cutout asset',
                status: 'applied',
              },
            ],
          };

          // Update delivered measurement in background without blocking
          measureDeliveredBytes(thumbnailUrl, originalBytes).then((measurement) => {
            if (measurement && measurement.deliveredBytes) {
              asset.deliveredBytes = measurement.deliveredBytes;
              asset.savedPercent = measurement.savedPercent;
            }
          }).catch(() => {});

          return { asset };
        }
      }
    } catch (err: any) {
      if (err.message?.includes("This photo can't be used")) {
        throw err;
      }
      console.warn('Direct signed upload failed, falling back to server /api/upload:', err);
    }
  }

  // 4. Server-mediated upload fallback (/api/upload)
  try {
    if (onProgress) onProgress(30);
    const base64Data = precompressedBase64 || await fileToBase64(uploadFile);
    if (onProgress) onProgress(55);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        imageBase64: base64Data,
        mimeType: uploadFile.type || 'image/jpeg',
        fileSize: uploadFile.size,
      }),
    });

    if (onProgress) onProgress(85);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed with HTTP ${res.status}`);
    }

    const data = await res.json();

    // If server flagged moderation as rejected
    if (data.asset?.moderationStatus === 'rejected') {
      throw new Error("This photo can't be used. Please upload a clear photo of the item.");
    }

    if (onProgress) onProgress(100);

    return {
      asset: data.asset,
      notice: data.notice,
    };
  } catch (err: any) {
    if (err.message?.includes("This photo can't be used")) {
      throw err;
    }
    console.warn('Server upload error, falling back to client-safe preview:', err);

    // Fallback safely to local preview without crashing
    const demoPublicId = `fallback_${Date.now()}`;
    const asset: CloudinaryAsset = {
      publicId: demoPublicId,
      originalUrl: localPreviewUrl,
      cleanedUrl: localPreviewUrl,
      thumbnailUrl: localPreviewUrl,
      damageCloseupUrl: localPreviewUrl,
      shareableCardUrl: buildShareableImpactCardUrl('sample', 2.8, 5.4, 'SecondLife Hero', 'demo'),
      tags: [],
      bytes: file.size,
      deliveredBytes: Math.round(file.size * 0.25),
      savedPercent: 75,
      moderationStatus: 'unmoderated',
      phash: 'a1b2c3d4e5f60718',
      isDemoFallback: true,
      transformations: [
        {
          name: 'AI Background Removal',
          code: 'e_background_removal',
          description: 'Local preview fallback (check server logs/connectivity)',
          status: 'fallback',
        },
        {
          name: 'Thumbnail Optimization',
          code: 'c_fill,g_auto',
          description: 'Client-side crop fallback',
          status: 'fallback',
        },
      ],
    };

    return {
      asset,
      notice: `Media upload warning: ${err.message || 'Offline mode'}. Rendering with local fallback.`,
    };
  }
}

/**
 * Phase 5B: Validates short condition video file (max 15 seconds, max 30 MB)
 */
export async function validateVideoFile(file: File): Promise<{ valid: boolean; error?: string; duration?: number }> {
  const maxSizeBytes = 30 * 1024 * 1024; // 30 MB
  if (file.size > maxSizeBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Video size (${sizeMb} MB) exceeds maximum allowed limit of 30 MB.`,
    };
  }

  // Duration verification via HTML5 video element
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const blobUrl = URL.createObjectURL(file);
    video.src = blobUrl;

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(blobUrl);
      const duration = video.duration;
      if (duration > 15.5) {
        resolve({
          valid: false,
          error: `Video length (${Math.round(duration)}s) exceeds maximum allowed limit of 15 seconds.`,
          duration,
        });
      } else {
        resolve({ valid: true, duration });
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      resolve({ valid: true });
    };
  });
}

/**
 * Phase 5B: Uploads optional short condition video to Cloudinary via signed upload
 */
export async function uploadVideoToCloudinary(
  file: File,
  onProgress?: (progress: number) => void,
  sessionToken?: string
): Promise<{ videoPublicId: string; videoUrl: string; videoPosterUrl: string }> {
  const validation = await validateVideoFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid video file.');
  }

  let authToken = sessionToken;
  if (!authToken) {
    try {
      const { data } = await supabase.auth.getSession();
      authToken = data.session?.access_token;
    } catch {}
  }

  if (!authToken) {
    throw new Error('Please sign in to upload condition videos.');
  }

  if (onProgress) onProgress(20);

  // Request signed video signature
  const sigRes = await fetch('/api/cloudinary/signature', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      fileType: file.type || 'video/mp4',
      fileSize: file.size,
      resourceType: 'video',
    }),
  });

  if (!sigRes.ok) {
    const errorData = await sigRes.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to authorize video upload.');
  }

  const sigData = await sigRes.json();
  if (onProgress) onProgress(45);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', sigData.apiKey);
  formData.append('timestamp', String(sigData.timestamp));
  formData.append('signature', sigData.signature);
  formData.append('folder', sigData.folder);

  const cloud = sigData.cloudName || getActiveCloudName();
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloud}/video/upload`;

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (onProgress) onProgress(85);

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.error('Video upload failed:', errText);
    throw new Error(`Video upload failed with status ${uploadRes.status}`);
  }

  const cloudData = await uploadRes.json();
  if (onProgress) onProgress(100);

  const videoPublicId = cloudData.public_id;
  const videoUrl = buildCloudinaryVideoUrl(videoPublicId, 'f_auto,q_auto', cloud);
  const videoPosterUrl = buildVideoPosterUrl(videoPublicId, cloud);

  return {
    videoPublicId,
    videoUrl,
    videoPosterUrl,
  };
}

/**
 * Phase 5B: Duplicate listing verification using perceptual hash (phash)
 */
export async function checkDuplicateListing(
  phash?: string,
  userId?: string,
  currentListingId?: string
): Promise<{
  isDuplicate: boolean;
  duplicateListing?: {
    id: string;
    title: string;
    ownerId: string;
    createdAt?: string;
    isOwner: boolean;
    distance: number;
  };
  warningMessage?: string;
}> {
  if (!phash) {
    return { isDuplicate: false };
  }

  try {
    const res = await fetch('/api/cloudinary/check-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phash, userId, currentListingId }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to query duplicate detection endpoint:', err);
  }

  return { isDuplicate: false };
}

/**
 * Checks if a Cloudinary transformed URL is ready (since e_background_removal can take 2-3s).
 * Tries loading the image; retries once after delay, then returns true or falls back.
 */
export async function verifyCloudinaryCutoutReady(url: string, retryDelayMs = 2500): Promise<boolean> {
  const tryLoad = (src: string): Promise<boolean> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = `${src}${src.includes('?') ? '&' : '?'}t=${Date.now()}`;
    });

  const firstAttempt = await tryLoad(url);
  if (firstAttempt) return true;

  // Retry once after brief delay
  await new Promise((r) => setTimeout(r, retryDelayMs));
  return await tryLoad(url);
}

