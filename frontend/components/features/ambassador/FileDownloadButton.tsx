import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Small download link for an ambassador file. `href` is a presigned *attachment* URL — the
 *  server sets Content-Disposition with the "First-Last-ID-Proof.png"-style filename (a plain
 *  `download` attribute is ignored for cross-origin S3 links). */
export function FileDownloadButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-xs">
      <a href={href} aria-label={label} title={label}>
        <Download className="h-3.5 w-3.5" /> Download
      </a>
    </Button>
  );
}
