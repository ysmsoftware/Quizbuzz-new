'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTestGenerateCertificateTemplate } from '@/lib/hooks/useCertificateTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { FlaskConical, Download, RefreshCcw, CheckCircle2, XCircle } from 'lucide-react';

export interface TestGenerateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    templateId: string | null;
    templateName?: string;
}

/**
 * Runs a saved template through the REAL certificate-generation pipeline (queue +
 * worker + Puppeteer) with sample data, so an admin can download and check an actual
 * PDF before issuing anything for real. This is deliberately NOT the same thing as the
 * "Preview" in the upload/edit modal — that's a plain-HTML browser render; this triggers
 * a genuine queued job and doubles as a health check of the queue/worker themselves.
 */
export function TestGenerateDialog({ open, onOpenChange, templateId, templateName }: TestGenerateDialogProps) {
    const testGenerateMutation = useTestGenerateCertificateTemplate();

    const [participantName, setParticipantName] = useState('Jordan Sample');
    const [percentage, setPercentage] = useState('87.5');
    const [rank, setRank] = useState('2');
    const [result, setResult] = useState<{ url: string; key: string } | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const isGenerating = testGenerateMutation.isPending;

    useEffect(() => {
        if (open) {
            setParticipantName('Jordan Sample');
            setPercentage('87.5');
            setRank('2');
            setResult(null);
            setErrorMessage(null);
        }
    }, [open]);

    const handleGenerate = async () => {
        if (!templateId) return;
        setResult(null);
        setErrorMessage(null);

        // A single toast, updated in place as the request progresses — visible even if
        // the admin looks away from the dialog itself. loading() -> success()/error()
        // on the same id replaces the toast rather than stacking a new one.
        const toastId = toast.loading('Generating test certificate via the real queue — this can take a few seconds…');

        try {
            const res = await testGenerateMutation.mutateAsync({
                id: templateId,
                body: {
                    participantName: participantName.trim() || undefined,
                    percentage: percentage.trim() ? Number(percentage) : undefined,
                    rank: rank.trim() ? Number(rank) : undefined,
                },
            });
            setResult(res);
            toast.success('Real PDF generated — ready to download', { id: toastId });
        } catch (err: any) {
            const message = err?.message || 'Failed to generate test certificate';
            setErrorMessage(message);
            toast.error(message, { id: toastId });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FlaskConical className="h-5 w-5 text-primary" /> Test Generate PDF
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Runs {templateName ? <span className="font-medium text-foreground">&ldquo;{templateName}&rdquo;</span> : 'this template'} through
                        the real certificate generation queue and Puppeteer PDF renderer — the exact same pipeline used for real
                        participants — so you can download and check the actual output before issuing anything for real.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Participant Name</Label>
                        <Input value={participantName} onChange={(e) => setParticipantName(e.target.value)} disabled={isGenerating} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Score / Percentage (%)</Label>
                            <Input type="number" min={0} max={100} step="0.1" value={percentage} onChange={(e) => setPercentage(e.target.value)} disabled={isGenerating} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Rank</Label>
                            <Input type="number" min={1} step="1" value={rank} onChange={(e) => setRank(e.target.value)} disabled={isGenerating} />
                        </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        Contest title, dates, org branding, and certificate ID use fixed sample data — only these fields are
                        worth varying to check different scenarios (e.g. a rank 1 perfect score vs. a borderline pass).
                    </p>

                    {/* Prominent in-dialog loading state — impossible to miss even if the
                        admin isn't looking at the button, since a real queued job can take
                        a few seconds. Toast (loading -> success/error) mirrors this too. */}
                    {isGenerating && (
                        <div className="p-3.5 bg-primary/5 border border-primary/30 rounded-lg flex items-center gap-3">
                            <RefreshCcw className="h-5 w-5 text-primary animate-spin shrink-0" />
                            <div className="space-y-0.5">
                                <p className="text-xs font-semibold text-foreground">Generating via the real certificate queue…</p>
                                <p className="text-[11px] text-muted-foreground">
                                    Job enqueued — waiting for the worker to render and upload the PDF. Usually a few seconds.
                                </p>
                            </div>
                        </div>
                    )}

                    {!isGenerating && result && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between gap-2">
                            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5" /> PDF generated successfully
                            </span>
                            <Button size="sm" variant="outline" asChild className="h-7 text-xs gap-1.5">
                                <a href={result.url} target="_blank" rel="noopener noreferrer">
                                    <Download className="h-3.5 w-3.5" /> Download
                                </a>
                            </Button>
                        </div>
                    )}

                    {!isGenerating && errorMessage && (
                        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
                            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                            <span className="text-xs text-destructive font-medium">{errorMessage}</span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    <Button onClick={handleGenerate} disabled={isGenerating || !templateId} className="gap-2">
                        {isGenerating ? (
                            <>
                                <RefreshCcw className="h-4 w-4 animate-spin" /> Generating via queue...
                            </>
                        ) : (
                            <>
                                <FlaskConical className="h-4 w-4" /> Generate Test PDF
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
