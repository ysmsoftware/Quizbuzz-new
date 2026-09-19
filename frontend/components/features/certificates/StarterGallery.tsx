'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CERTIFICATE_STARTERS, fillSampleData, type CertificateStarter } from '@/lib/utils/certificate-starters';
import type { CertificateDraft } from '@/lib/utils/certificate-draft';

const PAGE_PX = { w: 297 * (96 / 25.4), h: 210 * (96 / 25.4) };

/** A certificate rendered at real size and scaled down to the card's width. No scripts and an opaque origin: it's only a picture. */
function Thumb({ html }: { html: string }) {
    const boxRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);
    useLayoutEffect(() => {
        const el = boxRef.current;
        if (!el) return;
        const measure = () => setScale(el.clientWidth / PAGE_PX.w);
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return (
        <div ref={boxRef} className="relative w-full overflow-hidden rounded-lg border border-border/60 bg-white" style={{ aspectRatio: '297 / 210' }}>
            {scale > 0 && (
                <iframe
                    srcDoc={html}
                    sandbox=""
                    title="Design preview"
                    tabIndex={-1}
                    scrolling="no"
                    aria-hidden="true"
                    className="absolute top-0 left-0 border-0 pointer-events-none"
                    style={{ width: PAGE_PX.w, height: PAGE_PX.h, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                />
            )}
        </div>
    );
}

/**
 * "Choose a starting point" for a new template — shown before the editor opens. If an unsaved draft of a new
 * template is still in this browser (crashed tab, accidental reload), offers to carry on with it.
 */
export function StarterGallery({
    draft,
    onPick,
    onRestoreDraft,
    onDiscardDraft,
}: {
    draft: CertificateDraft | null;
    onPick: (starter: CertificateStarter) => void;
    onRestoreDraft: () => void;
    onDiscardDraft: () => void;
}) {
    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto max-w-6xl space-y-6 py-6">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold">Choose a starting point</h1>
                    <p className="text-sm text-muted-foreground">
                        Pick a design to customise — everything can be moved, restyled or replaced in the editor. Fields like the participant name are filled in for each certificate automatically.
                    </p>
                </div>

                {draft && (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                        <History className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span className="flex-1 min-w-[16rem]">
                            You have an unsaved draft{draft.name ? ` (“${draft.name}”)` : ''} from {new Date(draft.savedAt).toLocaleString()}.
                        </span>
                        <Button size="sm" onClick={onRestoreDraft}>Continue draft</Button>
                        <Button size="sm" variant="ghost" onClick={onDiscardDraft}>Discard</Button>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {CERTIFICATE_STARTERS.map((starter) => (
                        <button
                            key={starter.id}
                            type="button"
                            onClick={() => onPick(starter)}
                            className="group flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-3 text-left transition-all hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            <Thumb html={fillSampleData(starter.html)} />
                            <div className="px-1 pb-1">
                                <div className="font-semibold group-hover:text-primary">{starter.name}</div>
                                <div className="text-xs text-muted-foreground">{starter.description}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
