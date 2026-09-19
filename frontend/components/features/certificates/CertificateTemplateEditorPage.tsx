'use client';

// Full-page visual editor for a certificate template (route: /org/certificates/templates/[id],
// with id "new" for a fresh template). Covers the whole viewport, including the org sidebar/header
// — `fixed inset-0 z-50`: Radix portals (select menus, dialogs) mount later in <body> and still
// stack above it. The code editor + live preview stays in CertificateTemplateModal.

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, History, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import {
    certificateTemplatesApi,
    ORG_LOGO_POSITION_OPTIONS,
    PAGE_SIZE_OPTIONS,
    type OrgLogoPosition,
    type PageSizePreset,
    type TemplatePreviewResult,
} from '@/lib/api/certificate-templates.api';
import { useCreateCertificateTemplate, useUpdateCertificateTemplate } from '@/lib/hooks/useCertificateTemplates';
import { clearDraft, loadDraft, saveDraft, type CertificateDraft } from '@/lib/utils/certificate-draft';
import type { CertificateStarter } from '@/lib/utils/certificate-starters';
import { CertificatePreviewFrame } from './CertificatePreviewFrame';
import { StarterGallery } from './StarterGallery';
import type { VisualEditorApi } from './CertificateVisualEditor';

const TEMPLATES_PATH = '/org/certificates/templates';

// GrapesJS is ~1MB minified — fetched only when this page opens.
const CertificateVisualEditor = dynamic(() => import('./CertificateVisualEditor'), {
    ssr: false,
    loading: () => <Centered label="Loading editor..." />,
});

function Centered({ label }: { label: string }) {
    return (
        <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
                <p className="text-xs text-muted-foreground">{label}</p>
            </div>
        </div>
    );
}

export function CertificateTemplateEditorPage({ templateId: initialId }: { templateId: string | null }) {
    const router = useRouter();
    const createMutation = useCreateCertificateTemplate();
    const updateMutation = useUpdateCertificateTemplate();

    // null until the first save of a new template; then the created id.
    const [templateId, setTemplateId] = useState(initialId);
    const [loading, setLoading] = useState(!!initialId);
    const [loadError, setLoadError] = useState(false);

    const [name, setName] = useState('');
    const [orgLogoPosition, setOrgLogoPosition] = useState<OrgLogoPosition>('top-right');
    /** 'auto' = null on the server: the template's own @page rule, else A4 landscape. */
    const [pageSize, setPageSize] = useState<PageSizePreset | 'auto'>('auto');
    /** Page size the server detected from the template's own CSS (used while pageSize is 'auto'). */
    const [detectedMm, setDetectedMm] = useState({ w: 297, h: 210 });

    /** Snapshot the editor starts from; null until a design is chosen (new) or the template has loaded (existing). */
    const [startHtml, setStartHtml] = useState<string | null>(null);
    /** Bumped to re-mount the editor with different HTML (restoring a draft); the editor is never fed new HTML while mounted. */
    const [editorKey, setEditorKey] = useState(0);
    const htmlRef = useRef('');
    const visualApiRef = useRef<VisualEditorApi | null>(null);

    /** An unsaved draft found in this browser: offered for restore, never applied silently. */
    const [draft, setDraft] = useState<CertificateDraft | null>(null);
    const [edits, setEdits] = useState(0); // bumped on every change so the draft is re-saved

    const [dirty, setDirty] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirmLeave, setConfirmLeave] = useState(false);

    const [previewing, setPreviewing] = useState(false);
    const [preview, setPreview] = useState<TemplatePreviewResult | null>(null);

    const layout = { orgLogoPosition, pageSize: pageSize === 'auto' ? null : pageSize } as const;
    const presetDims = PAGE_SIZE_OPTIONS.find((o) => o.value === pageSize);
    const pageWidthMm = presetDims?.widthMm ?? detectedMm.w;
    const pageHeightMm = presetDims?.heightMm ?? detectedMm.h;

    /** Pending editor changes are exported synchronously; a debounced onChange may not have fired yet. */
    const currentHtml = () => (visualApiRef.current?.flush() ?? htmlRef.current).trim();

    useEffect(() => {
        if (!initialId) setDraft(loadDraft(null));
    }, [initialId]);

    // Load an existing template. Fetched directly (not via the react-query cache) so the editor
    // never starts from a stale copy of the HTML.
    useEffect(() => {
        if (!initialId) return;
        let cancelled = false;
        (async () => {
            try {
                const detail = await certificateTemplatesApi.getById(initialId);
                if (cancelled) return;
                setName(detail.name);
                setOrgLogoPosition(detail.orgLogoPosition ?? 'none');
                setPageSize(detail.pageSize ?? 'auto');
                htmlRef.current = detail.htmlContent;
                // The server knows how to read the template's own @page size; ask it once so the canvas matches.
                await certificateTemplatesApi
                    .preview({ htmlContent: detail.htmlContent, orgLogoPosition: detail.orgLogoPosition, pageSize: detail.pageSize })
                    .then((r) => !cancelled && setDetectedMm({ w: r.pageWidthMm, h: r.pageHeightMm }))
                    .catch(() => undefined); // fall back to A4 landscape
                if (!cancelled) {
                    setStartHtml(detail.htmlContent);
                    const d = loadDraft(initialId);
                    if (d && d.html.trim() !== detail.htmlContent.trim()) setDraft(d);
                }
            } catch {
                if (!cancelled) setLoadError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [initialId]);

    useEffect(() => {
        if (!dirty) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    // Autosave a local draft while there are unsaved changes (removed on save), so a crashed tab or reload doesn't lose the design.
    useEffect(() => {
        if (!dirty || startHtml === null) return;
        const t = setTimeout(
            () => saveDraft(templateId, { name, html: htmlRef.current, orgLogoPosition, pageSize: pageSize === 'auto' ? null : pageSize }),
            800,
        );
        return () => clearTimeout(t);
    }, [dirty, edits, name, orgLogoPosition, pageSize, templateId, startHtml]);

    const restoreDraft = () => {
        if (!draft) return;
        setName(draft.name);
        setOrgLogoPosition(draft.orgLogoPosition as OrgLogoPosition);
        setPageSize((draft.pageSize as PageSizePreset | null) ?? 'auto');
        htmlRef.current = draft.html;
        setStartHtml(draft.html);
        setEditorKey((k) => k + 1); // re-mount so a running editor picks up the draft's HTML
        setDirty(true);
        setDraft(null);
    };
    const discardDraft = () => {
        clearDraft(templateId);
        setDraft(null);
    };
    const pickStarter = (starter: CertificateStarter) => {
        htmlRef.current = starter.html;
        setStartHtml(starter.html);
    };

    const goBack = () => (dirty ? setConfirmLeave(true) : router.push(TEMPLATES_PATH));

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('Give the template a name before saving');
            return;
        }
        const htmlContent = currentHtml();
        setSaving(true);
        try {
            const saved = templateId
                ? await updateMutation.mutateAsync({ id: templateId, body: { name: name.trim(), htmlContent, ...layout } })
                : await createMutation.mutateAsync({ name: name.trim(), htmlContent, ...layout });
            if (saved.unknownPlaceholders.length > 0) {
                toast.warning(`Unrecognized placeholders will render blank: ${saved.unknownPlaceholders.map((v) => `{{${v}}}`).join(', ')}`);
            }
            setDirty(false);
            clearDraft(templateId);
            clearDraft(null);
            if (!templateId) {
                // A new template now has an id: continue on its own URL (the route remounts and loads the saved copy).
                setTemplateId(saved.template.id);
                router.replace(`${TEMPLATES_PATH}/${saved.template.id}`);
            }
        } catch {
            // the mutation hooks already toast the error (e.g. duplicate name)
        } finally {
            setSaving(false);
        }
    };

    const handlePreview = async () => {
        setPreviewing(true);
        try {
            setPreview(await certificateTemplatesApi.preview({ htmlContent: currentHtml(), ...layout }));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to render the preview');
        } finally {
            setPreviewing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
            {/* Top bar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-2.5 shrink-0">
                <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> Templates
                </Button>
                <div className="h-6 w-px bg-border/70" />
                <Input
                    placeholder="Template name, e.g. Annual Tech Summit Certificate"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setDirty(true); }}
                    className="h-9 w-72 max-w-full"
                />
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your logo</span>
                    <Select value={orgLogoPosition} onValueChange={(v) => { setOrgLogoPosition(v as OrgLogoPosition); setDirty(true); }}>
                        <SelectTrigger className="h-9 w-56 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {ORG_LOGO_POSITION_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Page</span>
                    <Select value={pageSize} onValueChange={(v) => { setPageSize(v as PageSizePreset | 'auto'); setDirty(true); }}>
                        <SelectTrigger className="h-9 w-60 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="auto" className="text-xs">Auto (from template CSS, else A4 landscape)</SelectItem>
                            {PAGE_SIZE_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>}
                    <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewing || startHtml === null} className="h-9 gap-1.5">
                        {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview
                    </Button>
                    <Button onClick={handleSave} disabled={saving || startHtml === null} className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {templateId ? 'Save changes' : 'Save template'}
                    </Button>
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1 min-h-0 p-3">
                {loading ? (
                    <Centered label="Loading template..." />
                ) : loadError ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                        <p className="font-semibold">Couldn&apos;t load this template</p>
                        <p className="text-sm text-muted-foreground">It may have been deleted, or you may not have access to it.</p>
                        <Button variant="outline" onClick={() => router.push(TEMPLATES_PATH)}>Back to templates</Button>
                    </div>
                ) : startHtml !== null ? (
                    <div className="flex h-full flex-col gap-2">
                        {draft && initialId && (
                            <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                                <History className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                <span className="flex-1 min-w-[16rem]">Unsaved changes from {new Date(draft.savedAt).toLocaleString()} were found in this browser.</span>
                                <Button size="sm" onClick={restoreDraft}>Restore them</Button>
                                <Button size="sm" variant="ghost" onClick={discardDraft}>Discard</Button>
                            </div>
                        )}
                        <div className="min-h-0 flex-1">
                            <CertificateVisualEditor
                                key={editorKey}
                                html={startHtml}
                                pageWidthMm={pageWidthMm}
                                pageHeightMm={pageHeightMm}
                                orgLogoPosition={orgLogoPosition}
                                onChange={(h) => { htmlRef.current = h; setDirty(true); setEdits((n) => n + 1); }}
                                apiRef={visualApiRef}
                            />
                        </div>
                    </div>
                ) : !initialId ? (
                    <StarterGallery draft={draft} onPick={pickStarter} onRestoreDraft={restoreDraft} onDiscardDraft={discardDraft} />
                ) : null}
            </div>

            {/* Server-rendered preview: sample data, your real logos, exactly what the PDF uses */}
            <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
                <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[90vh] flex flex-col">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Preview</DialogTitle>
                        <DialogDescription>Rendered with sample data and your real logos — the same output the PDF is generated from.</DialogDescription>
                    </DialogHeader>
                    {preview && (
                        <CertificatePreviewFrame html={preview.html} widthMm={preview.pageWidthMm} heightMm={preview.pageHeightMm} className="flex-1 min-h-0" />
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                        <AlertDialogDescription>Your edits to this template haven&apos;t been saved and will be lost if you leave.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction onClick={() => router.push(TEMPLATES_PATH)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Discard &amp; leave
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
