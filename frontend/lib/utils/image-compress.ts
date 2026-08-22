/** Client-side resize + compress for profile photos — keeps uploads small and fast without
 *  a server-side image pipeline. Downscales to `maxDimension` on the long edge, then steps
 *  JPEG quality down until the result fits `maxBytes` (or hits the quality floor). */
export async function compressImage(
  file: File,
  { maxDimension = 512, maxBytes = 500 * 1024, minQuality = 0.5 }: { maxDimension?: number; maxBytes?: number; minQuality?: number } = {}
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.85;
  let blob: Blob | null = await canvasToBlob(canvas, quality);
  while (blob && blob.size > maxBytes && quality > minQuality) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  if (!blob) return file;

  const name = file.name.replace(/\.\w+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}
