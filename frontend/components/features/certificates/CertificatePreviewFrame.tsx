'use client';

import { useLayoutEffect, useRef, useState } from 'react';

const MM_TO_PX = 96 / 25.4; // CSS px per mm

/**
 * Server-rendered certificate HTML shown at its real page size, scaled (CSS transform) to the
 * container's width inside a scrollable box — so the whole page is always reachable by scrolling,
 * at any page size, instead of being cropped to the container height.
 *
 * sandbox="allow-same-origin" without allow-scripts: nothing in the template can execute, while
 * logo <img> requests to loopback hosts (local storage in dev) still work — a fully sandboxed
 * frame has an opaque origin and those are blocked.
 */
export function CertificatePreviewFrame({
    html,
    widthMm,
    heightMm,
    className = '',
}: {
    html: string;
    widthMm: number;
    heightMm: number;
    className?: string;
}) {
    const boxRef = useRef<HTMLDivElement>(null);
    const [boxWidth, setBoxWidth] = useState(0);
    useLayoutEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const measure = () => setBoxWidth(el.clientWidth);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const pageW = widthMm * MM_TO_PX;
    const pageH = heightMm * MM_TO_PX;
    const scale = boxWidth > 24 ? (boxWidth - 24) / pageW : 1; // 24 = the box's p-3 on both sides

    return (
        <div ref={boxRef} className={`overflow-auto rounded-xl border bg-muted/40 p-3 ${className}`}>
            <div className="relative mx-auto bg-white shadow-md" style={{ width: pageW * scale, height: pageH * scale }}>
                <iframe
                    srcDoc={html}
                    sandbox="allow-same-origin"
                    title="Certificate Template Preview"
                    scrolling="no"
                    className="absolute top-0 left-0 border-0"
                    style={{ width: pageW, height: pageH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                />
            </div>
        </div>
    );
}
