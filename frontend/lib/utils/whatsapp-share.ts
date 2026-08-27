/**
 * Best-effort "send the message with the poster attached" for WhatsApp.
 *
 * WhatsApp's wa.me / api.whatsapp.com share links only ever support pre-filling TEXT — there
 * is no public way to make a wa.me link arrive with an image already attached, so this layers
 * the closest real alternatives, each degrading gracefully to the next:
 *
 *  1. Web Share API with a file (navigator.share/canShare) — where the platform supports
 *     sharing files (most mobile browsers, some desktop browsers), this opens the OS share
 *     sheet with the poster + text together; picking WhatsApp there sends both as one message.
 *  2. Clipboard image copy — where file sharing isn't available, the poster is copied to the
 *     clipboard so the user can paste it (Cmd/Ctrl+V) straight into the WhatsApp chat that
 *     opens, right before sending the pre-filled text.
 *  3. Text-only wa.me link — the guaranteed-to-work fallback when neither applies, there's no
 *     poster, or the poster can't be fetched as a blob (e.g. the storage bucket doesn't allow
 *     cross-origin reads — rendering it via <img> doesn't need CORS, but fetch() to turn it
 *     into a File/Blob does).
 */

export type WhatsAppShareResult = 'shared' | 'clipboard' | 'text-only' | 'cancelled';

async function fetchAsFile(imageUrl: string): Promise<File | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    const ext = blob.type.split('/')[1] || 'jpg';
    return new File([blob], `campaign-poster.${ext}`, { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

export async function shareToWhatsApp({
  text,
  posterImageUrl,
  title,
}: {
  text: string;
  posterImageUrl?: string;
  title?: string;
}): Promise<WhatsAppShareResult> {
  const file = posterImageUrl ? await fetchAsFile(posterImageUrl) : null;

  if (file && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
      // some other share failure (e.g. the target app refused the file) — fall through
    }
  }

  if (file && typeof navigator.clipboard?.write === 'function' && typeof window !== 'undefined' && 'ClipboardItem' in window) {
    try {
       
      await navigator.clipboard.write([new (window as any).ClipboardItem({ [file.type]: file })]);
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      return 'clipboard';
    } catch {
      // clipboard write refused (permissions, unsupported mime) — fall through
    }
  }

  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  return 'text-only';
}
