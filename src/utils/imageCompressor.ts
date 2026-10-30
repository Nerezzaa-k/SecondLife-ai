/**
 * Browser-side image compression & resizing utility.
 * Speeds up photo upload & AI processing by:
 * - Constraining long side to 1600px maximum (preserving exact aspect ratio)
 * - Compressing to JPEG quality ~0.85
 * - Skipping compression for tiny images (< 250KB and <= 1600px, or dimensions <= 400px)
 */

export interface CompressionResult {
  file: File | Blob;
  base64: string;
  wasResized: boolean;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  durationMs: number;
}

/**
 * Converts a File or Blob to base64 Data URL
 */
export function blobToBase64(blob: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Resizes and compresses an image in the browser before upload.
 */
export async function compressAndResizeImage(
  input: File | Blob,
  maxLongSide = 1280,
  quality = 0.85
): Promise<CompressionResult> {
  const t0 = performance.now();
  const originalBytes = input.size;

  // Ignore non-images (e.g. videos or pdfs)
  if (input.type && !input.type.startsWith('image/')) {
    const base64 = await blobToBase64(input);
    return {
      file: input,
      base64,
      wasResized: false,
      originalBytes,
      compressedBytes: originalBytes,
      width: 0,
      height: 0,
      durationMs: Math.round(performance.now() - t0),
    };
  }

  return new Promise<CompressionResult>((resolve) => {
    const objectUrl = URL.createObjectURL(input);
    const img = new Image();

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: width, naturalHeight: height } = img;
      const longSide = Math.max(width, height);

      // Skip resizing for tiny images (e.g. dimensions already <= 1600px and under 250 KB)
      const isTinyImage = (longSide <= maxLongSide && originalBytes <= 250 * 1024) || longSide <= 400;
      if (isTinyImage) {
        const base64 = await blobToBase64(input);
        const durationMs = Math.round(performance.now() - t0);
        console.log(`[ImageCompressor] Skipped resizing for small image (${width}x${height}, ${(originalBytes / 1024).toFixed(1)} KB) in ${durationMs}ms`);
        resolve({
          file: input,
          base64,
          wasResized: false,
          originalBytes,
          compressedBytes: originalBytes,
          width,
          height,
          durationMs,
        });
        return;
      }

      // Calculate new dimensions preserving exact aspect ratio
      let targetWidth = width;
      let targetHeight = height;

      if (longSide > maxLongSide) {
        if (width >= height) {
          targetWidth = maxLongSide;
          targetHeight = Math.round((height * maxLongSide) / width);
        } else {
          targetHeight = maxLongSide;
          targetWidth = Math.round((width * maxLongSide) / height);
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        const base64 = await blobToBase64(input);
        resolve({
          file: input,
          base64,
          wasResized: false,
          originalBytes,
          compressedBytes: originalBytes,
          width,
          height,
          durationMs: Math.round(performance.now() - t0),
        });
        return;
      }

      // Smooth scaling settings
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Export as JPEG with specified quality
      canvas.toBlob(
        async (compressedBlob) => {
          const durationMs = Math.round(performance.now() - t0);
          if (!compressedBlob) {
            const base64 = await blobToBase64(input);
            resolve({
              file: input,
              base64,
              wasResized: false,
              originalBytes,
              compressedBytes: originalBytes,
              width,
              height,
              durationMs,
            });
            return;
          }

          // If compression somehow produced a larger file than original, keep original
          if (compressedBlob.size >= originalBytes && longSide <= maxLongSide) {
            const base64 = await blobToBase64(input);
            console.log(`[ImageCompressor] Kept original image because compressed was not smaller (${(originalBytes / 1024).toFixed(1)} KB)`);
            resolve({
              file: input,
              base64,
              wasResized: false,
              originalBytes,
              compressedBytes: originalBytes,
              width,
              height,
              durationMs,
            });
            return;
          }

          // Convert blob to File if original input was a File (maintaining name)
          const fileName = (input as File).name
            ? (input as File).name.replace(/\.[^/.]+$/, '') + '.jpg'
            : 'item_photo.jpg';

          const compressedFile = new File([compressedBlob], fileName, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });

          const base64 = await blobToBase64(compressedBlob);
          const compressedBytes = compressedBlob.size;
          const savedPercent = Math.round(((originalBytes - compressedBytes) / originalBytes) * 100);

          console.log(
            `[ImageCompressor] Compressed in ${durationMs}ms: ` +
            `${width}x${height} -> ${targetWidth}x${targetHeight}, ` +
            `${(originalBytes / 1024).toFixed(1)} KB -> ${(compressedBytes / 1024).toFixed(1)} KB (-${savedPercent}%)`
          );

          resolve({
            file: compressedFile,
            base64,
            wasResized: true,
            originalBytes,
            compressedBytes,
            width: targetWidth,
            height: targetHeight,
            durationMs,
          });
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = async () => {
      URL.revokeObjectURL(objectUrl);
      const base64 = await blobToBase64(input);
      resolve({
        file: input,
        base64,
        wasResized: false,
        originalBytes,
        compressedBytes: originalBytes,
        width: 0,
        height: 0,
        durationMs: Math.round(performance.now() - t0),
      });
    };

    img.src = objectUrl;
  });
}
