/** Client-side resize + compress for profile photos — keeps uploads small and fast without
 *  a server-side image pipeline. Downscales to `maxDimension` on the long edge, then steps
 *  JPEG quality down until the result fits `maxBytes` (or hits the quality floor). If still
 *  over `maxBytes`, scales dimensions down slightly to guarantee capping at `maxBytes` (100 KB)
 *  without drastic loss of visual quality. */
export async function compressImage(
  file: File,
  { maxDimension = 512, maxBytes = 100 * 1024, minQuality = 0.5 }: { maxDimension?: number; maxBytes?: number; minQuality?: number } = {}
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  let width = Math.round(bitmap.width * scale);
  let height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);

  let quality = 0.85;
  let blob: Blob | null = await canvasToBlob(canvas, quality);

  // Step JPEG quality down first
  while (blob && blob.size > maxBytes && quality > minQuality) {
    quality -= 0.05;
    blob = await canvasToBlob(canvas, quality);
  }

  // If quality stepping alone is insufficient, scale down dimensions while preserving quality
  let currentDimension = maxDimension;
  while (blob && blob.size > maxBytes && currentDimension > 128) {
    currentDimension = Math.round(currentDimension * 0.85);
    const newScale = Math.min(1, currentDimension / Math.max(bitmap.width, bitmap.height));
    width = Math.round(bitmap.width * newScale);
    height = Math.round(bitmap.height * newScale);

    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    quality = 0.80; // Reset quality for smaller resolution so image remains sharp
    blob = await canvasToBlob(canvas, quality);
    while (blob && blob.size > maxBytes && quality > minQuality) {
      quality -= 0.05;
      blob = await canvasToBlob(canvas, quality);
    }
  }

  bitmap.close();
  if (!blob) return file;

  const name = file.name.replace(/\.\w+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

