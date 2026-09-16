import { compressImage } from './image-compress';

const MAX_UPLOAD_BYTES = 512 * 1024; // 512 KB cap

/** Shared compress→PUT→strip-query-string body for the "reward goodie image" presigned
 *  uploads (ambassador campaign rewards, contest prizes) — the only thing that differs
 *  between callers is which endpoint hands back the presigned URL. */
export async function uploadViaPresignedUrl(
  file: File,
  requestUploadUrl: (args: { filename: string; mimeType: string }) => Promise<{ data: { url: string; storageKey: string } }>,
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file');
  const compressed = await compressImage(file, { maxBytes: MAX_UPLOAD_BYTES });
  const { data } = await requestUploadUrl({ filename: compressed.name, mimeType: compressed.type });
  const putRes = await fetch(data.url, { method: 'PUT', body: compressed, headers: { 'Content-Type': compressed.type } });
  if (!putRes.ok) throw new Error('Upload to storage failed');
  return data.url.split('?')[0]!;
}
