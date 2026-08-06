'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { certificateTemplatesApi } from '@/lib/api/certificate-templates.api';
import { AlertTriangle } from 'lucide-react';

/** Pixels-per-mm used to render the full-size iframe before it gets scaled down to fit the card. */
const PX_PER_MM = 3.78;

export interface CertificateTemplateThumbnailProps {
    templateId: string;
    className?: string;
}

/**
 * Renders a small live preview of a saved certificate template inside a card —
 * the same server-rendered HTML (filled with realistic sample data) used by the
 * full editor's live preview, just scaled down to thumbnail size via CSS transform
 * so it reads like a folder/file icon rather than a raw row of text.
 */
export function CertificateTemplateThumbnail({ templateId, className }: CertificateTemplateThumbnailProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['certificate-template-preview-thumb', templateId],
        queryFn: () => certificateTemplatesApi.preview({ templateId }),
        staleTime: 5 * 60 * 1000, // thumbnails don't need to be live — 5 min cache is plenty
        gcTime: 30 * 60 * 1000,
    });

    const widthMm = data?.pageWidthMm ?? 297;
    const heightMm = data?.pageHeightMm ?? 210;
    const baseWidthPx = widthMm * PX_PER_MM;
    const baseHeightPx = heightMm * PX_PER_MM;

    // Measure the card's actual rendered width so the scale factor stays correct
    // across breakpoints/resizes instead of relying on a single fixed card size.
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => {
            const w = el.clientWidth;
            if (w > 0) setScale(w / baseWidthPx);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [baseWidthPx]);

    return (
        <div
            ref={containerRef}
            className={`relative w-full overflow-hidden rounded-lg border border-border/60 bg-white ${className ?? ''}`}
            style={{ aspectRatio: `${widthMm} / ${heightMm}` }}
        >
            {isLoading || scale === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : isError || !data ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-muted/30 text-muted-foreground">
                    <AlertTriangle className="h-5 w-5 opacity-50" />
                    <span className="text-[10px] font-medium">Preview unavailable</span>
                </div>
            ) : (
                <iframe
                    srcDoc={data.html}
                    title="Certificate template preview"
                    className="absolute top-0 left-0 border-0"
                    style={{
                        width: baseWidthPx,
                        height: baseHeightPx,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        pointerEvents: 'none',
                    }}
                    scrolling="no"
                    tabIndex={-1}
                    aria-hidden="true"
                    loading="lazy"
                />
            )}

            {/* Subtle overlay badge so it still reads as "a certificate" even before the iframe paints */}
            {!isLoading && !isError && data && (
                <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
            )}
        </div>
    );
}
