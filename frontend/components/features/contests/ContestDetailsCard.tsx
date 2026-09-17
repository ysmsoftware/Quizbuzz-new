'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil, Check, X, Loader2, AlertCircle, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { markdownComponents } from '@/components/contests/markdown-components';

interface ContestDetailsCardProps {
    value: string;
    onSave: (value: string) => Promise<void>;
    disabled?: boolean;
    className?: string;
}

// The org-side counterpart to the "About This Contest" section on the public
// page — this is the only place `contest.details` (the long-form markdown
// body, distinct from the short `description` field above it) can actually
// be added or changed; there was no editor for it anywhere before this.
// Reuses the same markdownComponents the public page renders with, so the
// live preview here matches what participants will see exactly.
export function ContestDetailsCard({ value, onSave, disabled = false, className }: ContestDetailsCardProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        setDraft(value);
    }, [value]);

    const startEditing = () => {
        setDraft(value);
        setIsEditing(true);
        setStatus('idle');
    };

    const cancelEditing = () => {
        setDraft(value);
        setIsEditing(false);
        setStatus('idle');
        setErrorMessage(null);
    };

    const handleSave = async () => {
        if (draft === value) {
            setIsEditing(false);
            return;
        }
        setStatus('saving');
        try {
            await onSave(draft);
            setStatus('success');
            setIsEditing(false);
            setTimeout(() => setStatus('idle'), 2000);
        } catch (err: any) {
            setStatus('error');
            setErrorMessage(err?.message || 'Failed to save');
        }
    };

    return (
        <Card className={cn('border-border/50', className)}>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
                <div className="flex items-center gap-2">
                    <CardTitle>Full Details</CardTitle>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
                        Markdown supported
                    </span>
                    {status === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    {status === 'success' && <Check className="h-3.5 w-3.5 text-green-500" />}
                    {status === 'error' && (
                        <span className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {errorMessage}
                        </span>
                    )}
                </div>
                {!disabled && !isEditing && (
                    <Button variant="ghost" size="sm" onClick={startEditing} className="gap-1.5">
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                    </Button>
                )}
                {isEditing && (
                    <div className="flex items-center gap-1.5">
                        <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={status === 'saving'}>
                            <X className="h-3.5 w-3.5" />
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSave} disabled={status === 'saving'} className="gap-1.5">
                            {status === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Save
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Markdown source
                            </label>
                            <Textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="## About this Contest&#10;Describe instructions, syllabus, patterns, rules..."
                                className="min-h-[320px] font-mono text-sm resize-y"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Preview
                            </label>
                            <div className="min-h-[320px] rounded-md border border-border/60 bg-muted/20 p-4 overflow-y-auto text-sm text-foreground">
                                {draft.trim() ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                        {draft}
                                    </ReactMarkdown>
                                ) : (
                                    <p className="text-muted-foreground italic">Nothing to preview yet — start typing or paste markdown.</p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : value.trim() ? (
                    <div className="text-sm text-foreground">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                            {value}
                        </ReactMarkdown>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={disabled ? undefined : startEditing}
                        disabled={disabled}
                        className={cn(
                            'flex flex-col items-center justify-center gap-2 w-full rounded-md border border-dashed border-border/60 py-10 text-center',
                            !disabled && 'hover:border-border hover:bg-muted/30 cursor-pointer transition-colors',
                        )}
                    >
                        <FileText className="h-6 w-6 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            No details added yet.{!disabled && ' Click to write the full contest description.'}
                        </p>
                    </button>
                )}
            </CardContent>
        </Card>
    );
}
