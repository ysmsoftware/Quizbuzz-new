'use client';

import { useState, useEffect } from 'react';
import {
    useCreateCertificateTemplate,
    useUpdateCertificateTemplate,
    usePreviewCertificateTemplate,
} from '@/lib/hooks/useCertificateTemplates';
import { certificateTemplatesApi, TemplatePreviewResult } from '@/lib/api/certificate-templates.api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Award, Eye, Upload, CheckCircle2, Copy, Check, FileText, ArrowRight, ArrowLeft, Code, AlertTriangle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { buildCertificateAiPrompt, CERTIFICATE_AVAILABLE_PLACEHOLDERS as AVAILABLE_PLACEHOLDERS } from '@/lib/utils/ai-prompts';

/** Inject auto-scaling script into iframe srcDoc so preview fits 100% inside container without cropping */
function formatPreviewSrcDoc(rawHtml: string): string {
    if (!rawHtml) return '';
    const autoScaleScript = `
    <script>
      function fitToWindow() {
        try {
          var doc = document.documentElement;
          var body = document.body;
          if (!body) return;
          var contentWidth = Math.max(doc.scrollWidth, body.scrollWidth, 1000);
          var containerWidth = window.innerWidth;
          if (contentWidth > 0 && containerWidth > 0) {
            var scale = containerWidth / contentWidth;
            doc.style.transform = 'scale(' + scale + ')';
            doc.style.transformOrigin = 'top left';
            doc.style.width = (100 / scale) + '%';
            doc.style.height = (100 / scale) + '%';
          }
        } catch (e) {}
      }
      window.addEventListener('resize', fitToWindow);
      document.addEventListener('DOMContentLoaded', fitToWindow);
      window.addEventListener('load', fitToWindow);
      setTimeout(fitToWindow, 50);
      setTimeout(fitToWindow, 300);
    </script>
  `;
    if (rawHtml.includes('</head>')) {
        return rawHtml.replace('</head>', `${autoScaleScript}</head>`);
    }
    return `${autoScaleScript}${rawHtml}`;
}

export interface CertificateTemplateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    editingId?: string | null;
    onSuccess?: () => void;
}

export function CertificateTemplateModal({
    open,
    onOpenChange,
    editingId,
    onSuccess,
}: CertificateTemplateModalProps) {
    const createMutation = useCreateCertificateTemplate();
    const updateMutation = useUpdateCertificateTemplate();
    const previewMutation = usePreviewCertificateTemplate();

    // 1 = Initial Compact Upload Step (for new template creation)
    // 2 = Full 2-Column Editor & Live Preview (for editing or after upload)
    const [step, setStep] = useState<1 | 2>(1);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [htmlContent, setHtmlContent] = useState('');
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [previewResult, setPreviewResult] = useState<TemplatePreviewResult | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [copiedVar, setCopiedVar] = useState<string | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    useEffect(() => {
        if (open) {
            if (editingId) {
                setStep(2); // Directly open full editor when editing existing template
                setIsLoadingDetail(true);
                certificateTemplatesApi.getById(editingId)
                    .then((detail) => {
                        setName(detail.name);
                        setDescription(detail.description ?? '');
                        setHtmlContent(detail.htmlContent);
                    })
                    .catch(() => {
                        toast.error('Failed to load template details');
                    })
                    .finally(() => {
                        setIsLoadingDetail(false);
                    });
            } else {
                setStep(1); // Start with compact upload step for new templates
                setName('');
                setDescription('');
                setHtmlContent('');
                setUploadedFileName(null);
                setPreviewResult(null);
            }
        } else {
            setName('');
            setDescription('');
            setHtmlContent('');
            setUploadedFileName(null);
            setPreviewResult(null);
            setStep(1);
        }
    }, [open, editingId]);

    // Live auto-preview when htmlContent changes (debounced 350ms)
    useEffect(() => {
        if (!open || !htmlContent.trim() || step !== 2) return;

        const timer = setTimeout(() => {
            setIsPreviewLoading(true);
            previewMutation.mutateAsync({
                templateId: editingId ?? undefined,
                htmlContent: htmlContent.trim(),
            })
                .then((res) => {
                    setPreviewResult(res);
                })
                .catch(() => {
                    // Ignore transient preview errors while typing
                })
                .finally(() => {
                    setIsPreviewLoading(false);
                });
        }, 350);

        return () => clearTimeout(timer);
    }, [open, htmlContent, editingId, step]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadedFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                setHtmlContent(content);
                toast.success(`Loaded ${file.name}`);
            }
        };
        reader.readAsText(file);
    };

    const handleCopyVar = (v: string) => {
        const tag = `{{${v}}}`;
        navigator.clipboard.writeText(tag);
        setCopiedVar(v);
        toast.success(`Copied ${tag} to clipboard`);
        setTimeout(() => setCopiedVar(null), 1500);
    };

    const [copiedAiPrompt, setCopiedAiPrompt] = useState(false);
    const handleCopyAiPrompt = () => {
        navigator.clipboard.writeText(buildCertificateAiPrompt());
        setCopiedAiPrompt(true);
        toast.success('Prompt copied — paste it into ChatGPT, Claude, or any AI tool');
        setTimeout(() => setCopiedAiPrompt(false), 2000);
    };

    const handleManualPreview = async () => {
        if (!htmlContent.trim()) return;
        setIsPreviewLoading(true);
        try {
            const res = await previewMutation.mutateAsync({
                templateId: editingId ?? undefined,
                htmlContent: htmlContent.trim(),
            });
            setPreviewResult(res);
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const [showUnrecognizedWarning, setShowUnrecognizedWarning] = useState(false);

    const handleSave = () => {
        if (!name.trim() || !htmlContent.trim()) return;

        // Warn user if there are unrecognized placeholders
        if (previewResult && previewResult.unknownPlaceholders.length > 0) {
            setShowUnrecognizedWarning(true);
            return;
        }

        executeSave();
    };

    const executeSave = async () => {
        if (!name.trim() || !htmlContent.trim()) return;
        setShowUnrecognizedWarning(false);

        const descVal = description.trim() || null;
        if (editingId) {
            await updateMutation.mutateAsync({
                id: editingId,
                body: { name: name.trim(), description: descVal, htmlContent: htmlContent.trim() },
            });
        } else {
            await createMutation.mutateAsync({
                name: name.trim(),
                description: descVal,
                htmlContent: htmlContent.trim(),
            });
        }
        onOpenChange(false);
        onSuccess?.();
    };

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={`flex flex-col p-6 overflow-hidden border border-border/80 shadow-2xl rounded-2xl bg-card transition-all duration-300 ${step === 1
                ? 'max-w-[95vw] sm:max-w-xl max-h-[85vh]'
                : 'max-w-[95vw] lg:max-w-6xl h-[90vh] max-h-[90vh]'
                }`}>

                {/* HEADER */}
                <DialogHeader className="pb-3 border-b border-border/60 shrink-0 flex flex-row items-center justify-between">
                    <div className="space-y-1">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Award className="h-5 w-5 text-primary" />
                            {editingId
                                ? 'Edit Certificate Template'
                                : step === 1
                                    ? 'Upload Custom Certificate Template'
                                    : 'Configure & Preview Certificate Template'
                            }
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {step === 1
                                ? 'Select or paste your HTML template to get started with live rendering.'
                                : 'Configure template details on the left and see the rendered certificate live on the right.'
                            }
                        </DialogDescription>
                    </div>

                    {/* Back Button if in Step 2 during new template creation */}
                    {step === 2 && !editingId && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setStep(1)}
                            className="text-xs gap-1 text-muted-foreground hover:text-foreground shrink-0"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Back to Upload
                        </Button>
                    )}
                </DialogHeader>

                {/* STEP 1: COMPACT UPLOAD STEP (For new templates) */}
                {step === 1 && !editingId && (
                    <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">

                        {/* Config & Size Guidance Box */}
                        <div className="p-3.5 bg-muted/40 border border-border/60 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-foreground font-semibold">
                                <FileText className="h-4 w-4 text-primary" />
                                <span>Template Specifications & Reference</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[11px] text-muted-foreground">
                                <div className="p-2.5 bg-background/60 rounded-lg border border-border/40 space-y-1">
                                    <p className="font-semibold text-foreground">Page Size Default:</p>
                                    <p>Standard A4 Landscape (<code className="font-mono text-[10px] text-primary">297mm × 210mm</code>). Override with CSS <code className="font-mono text-[10px]">@page &#123; size: ... &#125;</code>.</p>
                                </div>
                                <div className="p-2.5 bg-background/60 rounded-lg border border-border/40 space-y-1">
                                    <p className="font-semibold text-foreground">Placeholders Syntax:</p>
                                    <p>Use double curly braces: <code className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">&#123;&#123;participantName&#125;&#125;</code>, <code className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">&#123;&#123;contestTitle&#125;&#125;</code>, etc.</p>
                                </div>
                            </div>
                        </div>

                        {/* Don't know HTML? Generate one with AI */}
                        <div className="p-3.5 bg-primary/5 border border-primary/30 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <span>Don't want to write HTML by hand?</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                                Copy a ready-made prompt describing exactly what this system supports, paste it into
                                ChatGPT, Claude, or any AI tool along with your own design idea, and paste the HTML it
                                gives you back into the box below.
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleCopyAiPrompt}
                                className="h-8 text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                            >
                                {copiedAiPrompt ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {copiedAiPrompt ? 'Copied!' : 'Copy AI Prompt'}
                            </Button>
                        </div>

                        {/* Drag and Drop File Upload Area */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                1. Upload HTML Template File
                            </label>
                            <label className="border-2 border-dashed border-border/80 hover:border-primary/60 bg-muted/20 hover:bg-primary/5 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors space-y-2 group">
                                <input
                                    type="file"
                                    accept=".html,text/html"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Upload className="h-5 w-5 text-primary" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-sm font-semibold text-foreground">
                                        {uploadedFileName ? (
                                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                                                <CheckCircle2 className="h-4 w-4" /> {uploadedFileName}
                                            </span>
                                        ) : (
                                            'Click or drag & drop your .html template file here'
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Supports HTML files up to 200KB</p>
                                </div>
                            </label>
                        </div>

                        {/* Or Paste HTML Textarea */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Code className="h-3.5 w-3.5 text-muted-foreground" /> Or Paste Raw HTML Content
                                </label>
                            </div>
                            <Textarea
                                rows={5}
                                placeholder="<!DOCTYPE html><html><body><h1>Certificate for {{participantName}}</h1></body></html>"
                                className="font-mono text-xs resize-none"
                                value={htmlContent}
                                onChange={(e) => setHtmlContent(e.target.value)}
                            />
                        </div>

                    </div>
                )}

                {/* STEP 1 FOOTER */}
                {step === 1 && !editingId && (
                    <DialogFooter className="pt-3 border-t border-border/60 shrink-0 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button
                            onClick={() => setStep(2)}
                            disabled={!htmlContent.trim()}
                            className="bg-primary text-primary-foreground font-semibold gap-2"
                        >
                            Continue to Live Preview <ArrowRight className="h-4 w-4" />
                        </Button>
                    </DialogFooter>
                )}

                {/* STEP 2: FULL 2-COLUMN EDITOR & LIVE PREVIEW */}
                {step === 2 && (
                    isLoadingDetail ? (
                        <div className="flex-1 flex items-center justify-center min-h-[350px]">
                            <div className="text-center space-y-3">
                                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
                                <p className="text-xs text-muted-foreground">Loading template details...</p>
                            </div>
                        </div>
                    ) : (
                        /* 2-Column Grid Layout */
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 py-4 flex-1 min-h-0 overflow-hidden">

                            {/* LEFT COLUMN: Form Inputs & Cheat-Sheet (5 cols) */}
                            <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto pr-2 max-h-full">

                                {/* 1. Template Name Input */}
                                <div className="space-y-1.5 shrink-0">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Template Name</label>
                                    <Input
                                        placeholder="e.g. Annual Tech Summit Certificate"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="h-10"
                                    />
                                </div>

                                {/* 2. Template Description Input (Optional) */}
                                <div className="space-y-1.5 shrink-0">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description <span className="text-muted-foreground font-normal text-[11px]">(Optional)</span></label>
                                    <Input
                                        placeholder="e.g. Used for hackathon participation awards and summit completion"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="h-10 text-xs"
                                    />
                                </div>

                                {/* 3. Available Dynamic Placeholders Cheat-Sheet */}
                                <div className="p-3 bg-muted/40 border border-border/60 rounded-xl space-y-2 text-xs shrink-0">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                                            <FileText className="h-3.5 w-3.5 text-primary" /> Dynamic Placeholders
                                        </span>
                                        <button
                                            type="button"
                                            onClick={handleCopyAiPrompt}
                                            className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                                            title="Copy a ready-made prompt for ChatGPT/Claude/any AI tool"
                                        >
                                            {copiedAiPrompt ? <Check className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                                            {copiedAiPrompt ? 'Copied!' : 'Copy AI Prompt'}
                                        </button>
                                    </div>
                                    <div className="flex justify-end -mt-1">
                                        <span className="text-[10px] text-muted-foreground">Click a placeholder to copy</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 max-h-[90px] overflow-y-auto p-1 bg-background/50 rounded-lg border border-border/40">
                                        {AVAILABLE_PLACEHOLDERS.map((v) => (
                                            <button
                                                key={v}
                                                type="button"
                                                onClick={() => handleCopyVar(v)}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-secondary/80 hover:bg-primary/20 hover:text-primary transition-colors border border-border/50 text-foreground cursor-pointer"
                                                title={`Click to copy {{${v}}}`}
                                            >
                                                {`{{${v}}}`}
                                                {copiedVar === v ? (
                                                    <Check className="h-3 w-3 text-emerald-600" />
                                                ) : (
                                                    <Copy className="h-2.5 w-2.5 opacity-50" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40 space-y-0.5">
                                        <p className="font-medium text-foreground">Page Size Default:</p>
                                        <p>Defaults to A4 landscape (<code className="font-mono text-[10px]">297mm × 210mm</code>). Override with CSS <code className="font-mono text-[10px]">@page</code>.</p>
                                    </div>
                                </div>

                                {/* 4. HTML Content Textarea + File Upload (Self-Contained Scroll Box) */}
                                <div className="space-y-1.5 flex-1 flex flex-col min-h-0">
                                    <div className="flex justify-between items-center shrink-0">
                                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">HTML Content</label>
                                        <label className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1 font-medium">
                                            <Upload className="h-3.5 w-3.5" /> Upload .html file
                                            <input type="file" accept=".html,text/html" className="hidden" onChange={handleFileUpload} />
                                        </label>
                                    </div>
                                    <div className="relative rounded-xl border border-border/80 bg-background/50 overflow-hidden flex flex-col h-[220px] lg:h-[260px] shrink-0">
                                        <Textarea
                                            placeholder="<!DOCTYPE html><html><body><h1>Certificate for {{participantName}}</h1></body></html>"
                                            className="font-mono text-xs w-full h-full p-3 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 overflow-y-auto bg-transparent"
                                            value={htmlContent}
                                            onChange={(e) => setHtmlContent(e.target.value)}
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* RIGHT COLUMN: Live Render Preview (7 cols) */}
                            <div className="lg:col-span-7 flex flex-col gap-3 bg-muted/20 border border-border/60 rounded-xl p-4 h-full min-h-0 overflow-hidden">
                                {/* Right Header */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className={`h-4 w-4 ${previewResult ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                                        <h3 className="text-sm font-bold">Live Render Preview</h3>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={handleManualPreview}
                                            disabled={!htmlContent.trim() || isPreviewLoading}
                                            className="h-7 px-2.5 text-xs gap-1.5"
                                            title="Refresh Preview"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                            {isPreviewLoading ? 'Rendering...' : 'Refresh'}
                                        </Button>
                                        {previewResult ? (
                                            <Badge variant="outline" className="text-[11px] font-mono bg-background">
                                                {Math.round(previewResult.pageWidthMm ?? 297)}mm × {Math.round(previewResult.pageHeightMm ?? 210)}mm (A4 Landscape)
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[11px] font-mono bg-background text-muted-foreground">
                                                A4 Landscape (297mm × 210mm)
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Recognized / Unrecognized Variable Badges */}
                                {previewResult && (
                                    <div className="space-y-1.5 text-xs shrink-0">
                                        {previewResult.detectedVariables.length > 0 && (
                                            <div className="flex flex-wrap gap-1 items-center">
                                                <span className="font-medium text-muted-foreground text-[11px]">Recognized:</span>
                                                {previewResult.detectedVariables.map((v) => (
                                                    <Badge key={v} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 font-mono text-[10px] py-0">
                                                        {`{{${v}}}`}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}

                                        {previewResult.unknownPlaceholders.length > 0 && (
                                            <div className="flex flex-wrap gap-1 items-center">
                                                <span className="font-medium text-amber-700 dark:text-amber-400 text-[11px]">Unrecognized (will render blank):</span>
                                                {previewResult.unknownPlaceholders.map((v) => (
                                                    <Badge key={v} variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 font-mono text-[10px] py-0">
                                                        {`{{${v}}}`}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Live Iframe Viewport Container */}
                                <div className="flex-1 min-h-0 relative border rounded-xl overflow-hidden bg-white shadow-sm flex items-center justify-center">
                                    {previewResult ? (
                                        <iframe
                                            srcDoc={formatPreviewSrcDoc(previewResult.html)}
                                            title="Certificate Template Preview"
                                            className="w-full h-full border-0 absolute inset-0"
                                        />
                                    ) : (
                                        <div className="text-center p-6 space-y-3 text-muted-foreground">
                                            <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mx-auto">
                                                <Eye className="h-6 w-6 text-muted-foreground/60" />
                                            </div>
                                            <div className="space-y-1 max-w-sm">
                                                <p className="font-semibold text-sm text-foreground">No Live Preview Generated</p>
                                                <p className="text-xs">
                                                    Enter your template HTML on the left to render an automatic full-fidelity live preview here.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    )
                )}

                {/* STEP 2 FOOTER */}
                {step === 2 && (
                    <DialogFooter className="pt-3 border-t border-border/60 shrink-0 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button
                            onClick={handleSave}
                            disabled={!name.trim() || !htmlContent.trim() || createMutation.isPending || updateMutation.isPending || isLoadingDetail}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                            {editingId ? 'Update Template' : 'Save Template'}
                        </Button>
                    </DialogFooter>
                )}

            </DialogContent>
        </Dialog>

        {/* Unrecognized Placeholders Warning Confirmation Dialog */}
        <AlertDialog open={showUnrecognizedWarning} onOpenChange={setShowUnrecognizedWarning}>
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-lg">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        Unrecognized Placeholders Warning
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-xs space-y-2 pt-1 text-foreground/80">
                        <p>
                            Your template contains placeholders that do not match any recognized system variable. On generated certificates, these placeholders will render as blank text.
                        </p>
                        {previewResult && previewResult.unknownPlaceholders.length > 0 && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1.5 my-2">
                                <span className="font-semibold text-amber-800 dark:text-amber-300 text-xs">
                                    Unrecognized Variables ({previewResult.unknownPlaceholders.length}):
                                </span>
                                <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
                                    {previewResult.unknownPlaceholders.map((v) => (
                                        <Badge key={v} variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 font-mono text-[10px]">
                                            {`{{${v}}}`}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                        <p className="font-medium text-foreground">Do you want to go back and fix these placeholders or proceed and save anyway?</p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2 pt-2">
                    <AlertDialogCancel onClick={() => setShowUnrecognizedWarning(false)}>
                        Go Back & Edit
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={executeSave}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                    >
                        Proceed & Save
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
