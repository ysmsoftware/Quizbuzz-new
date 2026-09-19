'use client';

// Visual (drag & drop) certificate editor, built on GrapesJS. Loaded lazily by the editor page
// (next/dynamic, ssr:false) — GrapesJS is ~1MB minified.
//
// The editor is mounted when the page opens and destroyed when it closes; the HTML it edits is a
// snapshot taken at mount, and edits flow back out through `onChange` (debounced) and `apiRef.flush()`
// (synchronous, used by Save). The parent never pushes new HTML in while the editor is open, so there
// is no two-way sync to get out of step.
// Full-document <-> editor conversion (styles, @page, {{placeholders}}, web fonts) lives in
// lib/utils/certificate-visual.ts; layout geometry (snapping, align, nudge, grid) in visual-editor-tools.ts.

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import grapesjs, { type Component, type Editor, type ToolbarButtonProps } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import {
    Undo2, Redo2, Move, Square, Trash2, Grid3x3, Magnet, ZoomIn, ZoomOut, Maximize,
    AlignStartVertical, AlignCenterVertical, AlignEndVertical,
    AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
    AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CERTIFICATE_AVAILABLE_PLACEHOLDERS } from '@/lib/utils/ai-prompts';
import { toEditorSource, fromEditorOutput, PRIMARY_STANDIN } from '@/lib/utils/certificate-visual';
import { EDITOR_FONTS, FONT_STACK_OPTIONS, googleFontsHref } from '@/lib/utils/certificate-fonts';
import type { OrgLogoPosition } from '@/lib/api/certificate-templates.api';
import {
    MM_TO_PX, alignSelected, distributeSelected, installNudgeKeys, installSnapping, setGrid, zeroLeadingMargins,
    type AlignMode,
} from './visual-editor-tools';

const RULER = 18; // px thickness of the rulers

export interface VisualEditorApi {
    /** Exports pending edits to a full HTML document; null when nothing changed since mount. */
    flush: () => string | null;
}

interface Props {
    /** Full HTML document to start from (snapshot at mount). */
    html: string;
    pageWidthMm: number;
    pageHeightMm: number;
    orgLogoPosition: OrgLogoPosition;
    onChange: (html: string) => void;
    apiRef: MutableRefObject<VisualEditorApi | null>;
}

// orgLogoUrl / primaryColor are only meaningful as an <img src> / CSS value, not as visible text.
const TEXT_FIELDS = CERTIFICATE_AVAILABLE_PLACEHOLDERS.filter((v) => v !== 'orgLogoUrl' && v !== 'primaryColor');

/** GrapesJS only draws resize handles (all eight) on components flagged `resizable` — by default just images. */
const makeResizable = (c: Component) => {
    if (c.get('type') !== 'wrapper') c.set('resizable', true);
};

/**
 * GrapesJS positions a freshly-dragged element relative to the canvas unless an ancestor's OWN style says
 * `position: absolute|relative` — it can't see positioning that comes from a CSS class (as it does in most
 * templates, e.g. a `.content { position: absolute }` wrapper), so the element would jump by the container's
 * offset. Copy each positioned element's computed position into its own style so containers are recognized.
 */
function exposePositionedContainers(editor: Editor) {
    const win = editor.Canvas.getWindow();
    editor.getWrapper()?.find('*').forEach((c) => {
        const el = c.getEl();
        const pos = el && win.getComputedStyle(el).position;
        if (pos && pos !== 'static' && !c.getStyle().position) c.addStyle({ position: pos });
    });
}

/**
 * Non-exported overlay in the canvas showing where the platform will draw the logos
 * (mirrors backend certificate.branding.ts: 42x14mm boxes, 20mm from the page edges),
 * so the design leaves room for them.
 */
function drawLogoGuides(editor: Editor, pos: OrgLogoPosition, wMm: number, hMm: number) {
    const doc = editor.Canvas.getDocument();
    if (!doc) return;
    doc.getElementById('qb-guides')?.remove();

    const box = (label: string, at: string, x: number, y: number, color: string) =>
        `<div style="position:absolute;left:${x}mm;top:${y}mm;width:42mm;height:14mm;border:1px dashed ${color};background:${color}22;` +
        `color:${color};font:600 9px Arial,sans-serif;display:flex;align-items:center;justify-content:center;text-align:center">${label}<br/>${at}</div>`;

    const inset = 20, w = 42, h = 14;
    const xs = { left: inset, center: (wMm - w) / 2, right: wMm - inset - w };
    const ys = { top: inset, bottom: hMm - inset - h };
    const appAt = pos === 'top-left' ? 'right' : 'left';
    let html = box('QuizBuzz logo', 'always here', xs[appAt], ys.top, '#d9480f');
    if (pos !== 'none') {
        const [v, hz] = pos.split('-') as ['top' | 'bottom', 'left' | 'center' | 'right'];
        html += box('Your logo', pos, xs[hz], ys[v], '#1a3a6b');
    }
    const el = doc.createElement('div');
    el.id = 'qb-guides';
    el.setAttribute('style', 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483646');
    el.innerHTML = html;
    doc.documentElement.appendChild(el);
}

/** Fits the whole page into the canvas and centers it, using GrapesJS's own viewport math (infiniteCanvas mode). */
function fitPage(editor: Editor, canvasEl: HTMLElement | null) {
    // The ResizeObserver's first callback fires before GrapesJS has created the frame, and fitViewport() dereferences it.
    if (!canvasEl || !canvasEl.clientWidth || !canvasEl.clientHeight || !editor.Canvas.getFrame()) return;
    editor.Canvas.fitViewport({ gap: 16 });
}

// ─── Blocks ──────────────────────────────────────────────────────────────────

/**
 * New blocks are created free-positioned, so they stack above the template's own (also absolutely positioned)
 * elements and can be grabbed straight away. A static block dropped over a positioned one would sit underneath
 * it, un-clickable. `PRIMARY_STANDIN` colors export as {{primaryColor}}, so those follow the org's brand color.
 */
const placed = (style: Record<string, string>) => ({ ...style, position: 'absolute', left: '140px', top: '140px' });
const P = PRIMARY_STANDIN;

function registerBlocks(editor: Editor) {
    const bm = editor.Blocks;
    const el = 'Elements', dec = 'Decor & layout', fld = 'Certificate fields';

    bm.add('text', { label: 'Text', category: el, content: { type: 'text', content: 'Double-click to edit', style: placed({ 'font-size': '18px', padding: '4px' }) } });
    bm.add('heading', { label: 'Heading', category: el, content: { type: 'text', tagName: 'h1', content: 'Heading', style: placed({ 'font-size': '32px', 'font-weight': 'bold', padding: '4px' }) } });
    bm.add('image', { label: 'Image (URL)', category: el, select: true, activate: true, content: { type: 'image', style: placed({ width: '120px' }) } });
    bm.add('box', { label: 'Box', category: el, content: { tagName: 'div', style: placed({ width: '160px', height: '80px', border: '1px solid #999999' }) } });
    bm.add('line', { label: 'Line', category: el, content: { tagName: 'div', style: placed({ width: '220px', height: '2px', 'background-color': '#333333' }) } });

    bm.add('signature', {
        label: 'Signature line', category: dec,
        content: {
            tagName: 'div', style: placed({ width: '220px', 'text-align': 'center' }),
            components: [
                { tagName: 'div', style: { 'border-top': '1px solid #333333', height: '0px', 'margin-bottom': '6px' } },
                { type: 'text', content: 'Authorized signature', style: { 'font-size': '13px', color: '#555555' } },
            ],
        },
    });
    bm.add('seal', {
        label: 'Seal / badge', category: dec,
        content: {
            tagName: 'div',
            style: placed({
                width: '110px', height: '110px', 'border-radius': '50%', border: `4px double ${P}`, color: P, 'text-align': 'center',
                display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'font-weight': 'bold', 'font-size': '15px', 'letter-spacing': '2px',
            }),
            components: [{ type: 'text', content: 'OFFICIAL<br/>SEAL', style: { 'line-height': '1.3' } }],
        },
    });
    bm.add('two-columns', {
        label: 'Two columns', category: dec,
        content: {
            tagName: 'div', style: placed({ width: '520px', display: 'flex', gap: '24px' }),
            components: [
                { tagName: 'div', style: { flex: '1', padding: '8px', border: '1px dashed #bbbbbb', 'min-height': '60px' }, components: [{ type: 'text', content: 'Left column' }] },
                { tagName: 'div', style: { flex: '1', padding: '8px', border: '1px dashed #bbbbbb', 'min-height': '60px' }, components: [{ type: 'text', content: 'Right column' }] },
            ],
        },
    });
    bm.add('border-frame', { label: 'Border frame', category: dec, content: { tagName: 'div', style: { position: 'absolute', top: '12mm', left: '12mm', right: '12mm', bottom: '12mm', border: `2px solid ${P}`, 'pointer-events': 'none' } } });
    bm.add('ornament', {
        label: 'Divider ornament', category: dec,
        content: {
            tagName: 'div', style: placed({ width: '260px', height: '14px', display: 'flex', 'align-items': 'center', gap: '10px' }),
            components: [
                { tagName: 'div', style: { flex: '1', height: '1px', 'background-color': P } },
                { tagName: 'div', style: { width: '9px', height: '9px', 'background-color': P, transform: 'rotate(45deg)' } },
                { tagName: 'div', style: { flex: '1', height: '1px', 'background-color': P } },
            ],
        },
    });

    for (const key of TEXT_FIELDS) {
        bm.add(`ph-${key}`, { label: `{{${key}}}`, category: fld, content: { type: 'text', content: `{{${key}}}`, style: placed({ 'font-size': '20px', padding: '4px' }) } });
    }
}

// ─── Toolbar bits ────────────────────────────────────────────────────────────

/** Compact toolbar button; `on` highlights toggles. (Module level: defining it inside the editor would remount every button each render.) */
function Tb({ title, on, disabled, onClick, children }: { title: string; on?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <Button type="button" variant={on ? 'default' : 'outline'} size="sm" className="h-7 gap-1.5 px-2 text-xs" title={title} aria-label={title} disabled={disabled} onClick={onClick}>
            {children}
        </Button>
    );
}

const Sep = () => <span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden="true" />;

// ─── Rulers ──────────────────────────────────────────────────────────────────

/** A millimetre ruler along the page: `origin` is where the page's edge sits on screen, `zoom` the canvas scale. */
function Ruler({ axis, length, origin, zoom, pageMm }: { axis: 'x' | 'y'; length: number; origin: number; zoom: number; pageMm: number }) {
    const pxPerMm = MM_TO_PX * zoom;
    const minor = [1, 2, 5, 10, 20, 50, 100].find((s) => s * pxPerMm >= 6) ?? 100;
    const labelEvery = [10, 20, 50, 100, 200].find((s) => s * pxPerMm >= 40 && s % minor === 0) ?? 200;

    const ticks: ReactNode[] = [];
    for (let mm = 0; mm <= pageMm; mm += minor) {
        const pos = origin + mm * pxPerMm;
        if (pos < -1 || pos > length + 1) continue;
        const major = mm % labelEvery === 0;
        const len = major ? 9 : 4;
        ticks.push(
            axis === 'x' ? (
                <g key={mm}>
                    <line x1={pos} x2={pos} y1={RULER - len} y2={RULER} />
                    {major && <text x={pos + 2} y={9} fontSize="8" stroke="none" fill="currentColor">{mm}</text>}
                </g>
            ) : (
                <g key={mm}>
                    <line y1={pos} y2={pos} x1={RULER - len} x2={RULER} />
                    {major && <text transform={`translate(9 ${pos + 2}) rotate(-90)`} textAnchor="end" fontSize="8" stroke="none" fill="currentColor">{mm}</text>}
                </g>
            ),
        );
    }
    const size = axis === 'x' ? { width: length, height: RULER } : { width: RULER, height: length };
    return (
        <svg
            {...size}
            className="absolute text-muted-foreground bg-card border-border/70"
            style={axis === 'x' ? { left: RULER, top: 0, borderBottomWidth: 1 } : { left: 0, top: RULER, borderRightWidth: 1 }}
            stroke="currentColor" strokeWidth="1" aria-hidden="true"
        >
            {ticks}
        </svg>
    );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CertificateVisualEditor({ html, pageWidthMm, pageHeightMm, orgLogoPosition, onChange, apiRef }: Props) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const blocksRef = useRef<HTMLDivElement>(null);
    const selectorsRef = useRef<HTMLDivElement>(null);
    const stylesRef = useRef<HTMLDivElement>(null);
    const traitsRef = useRef<HTMLDivElement>(null);
    const layersRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Editor | null>(null);

    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    // Latest values for the effects below, without re-running them.
    const latest = useRef({ html, pageWidthMm, pageHeightMm, orgLogoPosition });
    latest.current = { html, pageWidthMm, pageHeightMm, orgLogoPosition };

    const [tab, setTab] = useState<'style' | 'settings' | 'layers'>('style');
    // Free move is the default: certificates are laid out by placing things, not by re-ordering a flow.
    const [freeMove, setFreeMove] = useState(true);
    const freeMoveRef = useRef(true);
    const [outlines, setOutlines] = useState(true);
    const [snap, setSnap] = useState(true);
    const snapRef = useRef(true);
    const [grid, setGridOn] = useState(false);
    const gridRef = useRef(false);
    const [selCount, setSelCount] = useState(0);
    /** Where the page sits inside the canvas element and at what zoom — drives the rulers and the zoom readout. */
    const [view, setView] = useState({ x: 0, y: 0, w: 0, h: 0, zoom: 1 });
    const zoomRef = useRef(1);

    /** Re-reads the page's on-screen position/zoom from the canvas. */
    const syncView = () => {
        const editor = editorRef.current, canvasEl = canvasRef.current, frameEl = editor?.Canvas.getFrameEl();
        if (!editor || !canvasEl || !frameEl) return;
        const cr = canvasEl.getBoundingClientRect(), fr = frameEl.getBoundingClientRect();
        const zoom = editor.Canvas.getZoom() / 100;
        zoomRef.current = zoom;
        setView({ x: fr.left - cr.left, y: fr.top - cr.top, w: cr.width, h: cr.height, zoom });
    };

    /** Zooms keeping the point at the middle of the canvas fixed. */
    const zoomTo = (target: number) => {
        const editor = editorRef.current, canvasEl = canvasRef.current, frameEl = editor?.Canvas.getFrameEl();
        if (!editor || !canvasEl || !frameEl) return;
        const cr = canvasEl.getBoundingClientRect();
        const cx = cr.width / 2, cy = cr.height / 2;
        const z0 = editor.Canvas.getZoom() / 100;
        const f0 = frameEl.getBoundingClientRect();
        const px = (cx - (f0.left - cr.left)) / z0, py = (cy - (f0.top - cr.top)) / z0; // page point under the canvas center
        const z1 = Math.min(3, Math.max(0.1, target));
        editor.Canvas.setZoom(z1 * 100);
        const f1 = frameEl.getBoundingClientRect();
        const { x, y } = editor.Canvas.getCoords();
        editor.Canvas.setCoords(x + (cx - px * z1 - (f1.left - cr.left)), y + (cy - py * z1 - (f1.top - cr.top)));
        syncView();
    };

    useEffect(() => {
        const src = toEditorSource(latest.current.html);
        let dirty = false;
        let ready = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        // Each editor instance renders its panels into its own throwaway div: React StrictMode's discarded
        // first editor can append UI *after* cleanup ran, which would otherwise duplicate the panels.
        const mounts = [blocksRef, selectorsRef, stylesRef, traitsRef, layersRef].map((r) => r.current!.appendChild(document.createElement('div')));
        const [blocksEl, selectorsEl, stylesEl, traitsEl, layersEl] = mounts;

        const editor = grapesjs.init({
            container: canvasRef.current!,
            height: '100%',
            width: 'auto',
            fromElement: false,
            storageManager: false,
            noticeOnUnload: false,
            protectedCss: '',
            components: src.html,
            style: src.css,
            panels: { defaults: [] },
            // Pan (space+drag / middle mouse) and zoom (ctrl+wheel), and the one supported way to zoom a frame without breaking drag/resize.
            canvas: { infiniteCanvas: true },
            // Images by URL only (no file upload / base64), matching the rest of the template system.
            assetManager: { upload: false, embedAsBase64: false },
            deviceManager: {
                default: 'page',
                devices: [{ id: 'page', name: 'Page', width: `${Math.round(latest.current.pageWidthMm * MM_TO_PX)}px`, height: `${Math.round(latest.current.pageHeightMm * MM_TO_PX)}px` }],
            },
            blockManager: { appendTo: blocksEl!, blocks: [] },
            // componentFirst: style edits (and drags/resizes) apply to the selected element itself, not to every element sharing its CSS class.
            selectorManager: { appendTo: selectorsEl!, componentFirst: true },
            styleManager: { appendTo: stylesEl! },
            traitManager: { appendTo: traitsEl! },
            layerManager: { appendTo: layersEl! },
        });
        editorRef.current = editor;

        registerBlocks(editor);

        const exportHtml = () => {
            // getHtml() returns the wrapper as <body ...>…</body>; only its contents belong in our document body.
            const body = editor.getHtml({ cleanId: true });
            const inner = /^\s*<body[^>]*>([\s\S]*)<\/body>\s*$/.exec(body)?.[1] ?? body;
            return fromEditorOutput({ html: inner, css: editor.getCss({ avoidProtected: true }) ?? '' }, src);
        };
        const push = () => {
            if (!dirty) return null;
            clearTimeout(timer);
            const out = exportHtml();
            onChangeRef.current(out);
            return out;
        };
        apiRef.current = { flush: push };

        const fitZoom = () => {
            fitPage(editor, canvasRef.current);
            syncView();
        };
        const ro = new ResizeObserver(fitZoom);
        ro.observe(canvasRef.current!);
        editor.Canvas.getModel().on('change:zoom change:x change:y', syncView);

        editor.on('component:add', makeResizable);
        editor.on('dmode:start', ({ target }: { target: Component }) => zeroLeadingMargins(target));
        installSnapping(editor, {
            enabled: () => snapRef.current,
            gridVisible: () => gridRef.current,
            zoom: () => zoomRef.current,
            pageSizePx: () => ({ w: latest.current.pageWidthMm * MM_TO_PX, h: latest.current.pageHeightMm * MM_TO_PX }),
        });

        // In drag mode GrapesJS rewrites `top`/`left` on every resize from canvas-relative numbers (the rect's t/l), which are wrong
        // for an element inside a positioned container — resizing from the bottom edge would move it. Width/height are reliable, so
        // derive the position from them: only a top-edge handle moves `top` (by the height change), only a left-edge handle moves `left`.
        type ResizeRect = { w: number; h: number };
        let resizeStart: { handle: string; rect: ResizeRect; top: number; left: number } | undefined;
        editor.on('component:resize:start', ({ component, rect, event }: { component: Component; rect: ResizeRect; event: Event }) => {
            const st = component.getStyle();
            const handle = /resizer-h-(\w\w)/.exec((event.target as HTMLElement | null)?.className ?? '')?.[1] ?? '';
            resizeStart = { handle, rect: { w: rect.w, h: rect.h }, top: parseFloat(String(st.top ?? '0')) || 0, left: parseFloat(String(st.left ?? '0')) || 0 };
        });
        editor.on('component:resize:update', ({ component, rect, style }: { component: Component; rect: ResizeRect; style: Record<string, unknown> }) => {
            if (!resizeStart) return;
            const el = component.getEl();
            if (!el || el.ownerDocument.defaultView!.getComputedStyle(el).position === 'static') {
                delete style.top; // top/left mean nothing on a static element
                delete style.left;
                return;
            }
            const { handle, rect: r0, top, left } = resizeStart;
            style.top = `${Math.round(handle[0] === 't' ? top - (rect.h - r0.h) : top)}px`;
            style.left = `${Math.round(handle[1] === 'l' ? left - (rect.w - r0.w) : left)}px`;
        });

        // Arrow keys nudge the selection: one listener on the editor page and one inside the canvas iframe (attached once it exists).
        const removeNudgers = [installNudgeKeys(editor, document)];

        // In free-move mode the toolbar's ✥ handle is hidden: it starts a drag in the editor's document and continues it in the
        // canvas iframe's, mixing two coordinate spaces (the element jumps). Dragging the element itself stays inside the iframe.
        let moveItem: ToolbarButtonProps | undefined;
        editor.on('component:selected', (c: Component) => {
            setTab('style');
            const items = c.get('toolbar');
            if (!Array.isArray(items)) return;
            moveItem ??= items.find((i) => i.command === 'tlb-move');
            const rest = items.filter((i) => i.command !== 'tlb-move');
            if (!freeMoveRef.current && moveItem) rest.splice(1, 0, moveItem);
            c.set('toolbar', rest);
        });
        editor.on('component:selected component:deselected', () => setSelCount(editor.getSelectedAll().length));

        editor.on('load', () => {
            // GrapesJS renders the selector manager into `appendTo` at init and again on load without clearing the first — keep the last render only.
            Array.from(selectorsEl!.querySelectorAll('.gjs-clm-tags')).slice(0, -1).forEach((n) => n.remove());
            editor.getWrapper()?.find('*').forEach(makeResizable); // everything parsed from the template before this handler existed
            exposePositionedContainers(editor);
            editor.setDragMode('absolute');
            const frameDoc = editor.Canvas.getDocument();
            if (frameDoc) removeNudgers.push(installNudgeKeys(editor, frameDoc));
            ready = true;
            editor.setDevice('page');
            editor.runCommand('sw-visibility');

            // Web fonts: the picker lists them, and the canvas loads them so previews match the PDF (the export gets its own <link>).
            const fontProp = editor.StyleManager.getProperty('typography', 'font-family') as unknown as { set: (k: string, v: unknown) => void } | undefined;
            fontProp?.set('options', FONT_STACK_OPTIONS);
            const head = editor.Canvas.getDocument()?.head;
            if (head) {
                for (const href of [googleFontsHref([...EDITOR_FONTS.map((f) => f.spec), ...src.googleSpecs]), ...src.links]) {
                    if (!href) continue;
                    const link = head.ownerDocument.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = href;
                    head.appendChild(link);
                }
            }

            editor.UndoManager.clear();
            fitZoom();
            drawLogoGuides(editor, latest.current.orgLogoPosition, latest.current.pageWidthMm, latest.current.pageHeightMm);
        });
        editor.on('update', () => {
            if (!ready) return;
            dirty = true;
            clearTimeout(timer);
            timer = setTimeout(push, 250);
        });

        return () => {
            push(); // don't lose edits made in the last 250ms before the tab closed
            clearTimeout(timer);
            ro.disconnect();
            removeNudgers.forEach((off) => off());
            apiRef.current = null;
            editor.destroy();
            editorRef.current = null;
            mounts.forEach((m) => m.remove());
        };
        // Init once per mount; live props go through `latest` and the effect below.
    }, []);

    // Page size / logo position can change while the editor is open.
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor || !editor.Canvas.getDocument()) return;
        editor.Devices.get('page')?.set({ width: `${Math.round(pageWidthMm * MM_TO_PX)}px`, height: `${Math.round(pageHeightMm * MM_TO_PX)}px` });
        editor.setDevice('page');
        drawLogoGuides(editor, orgLogoPosition, pageWidthMm, pageHeightMm);
        setGrid(editor, gridRef.current, pageWidthMm, pageHeightMm);
        fitPage(editor, canvasRef.current);
        syncView();
    }, [pageWidthMm, pageHeightMm, orgLogoPosition]);

    const run = (fn: (e: Editor) => void) => () => editorRef.current && fn(editorRef.current);

    const tabBtn = (id: typeof tab, label: string) => (
        <button
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 py-1.5 text-[11px] font-semibold uppercase tracking-wider border-b-2 transition-colors ${tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
            {label}
        </button>
    );

    const icon = 'h-3.5 w-3.5';
    const align = (mode: AlignMode, title: string, node: ReactNode) => (
        <Tb title={title} disabled={selCount === 0} onClick={run((e) => alignSelected(e, mode))}>{node}</Tb>
    );

    return (
        <div className="qb-gjs flex flex-col h-full min-h-0 gap-2">
            <style>{`
                /* the default UI reserves space for panels we don't use */
                .qb-gjs .gjs-cv-canvas { top: 0 !important; width: 100% !important; height: 100% !important; }
                /* one block per row so {{placeholder}} labels aren't truncated */
                .qb-gjs .gjs-block { width: 100%; min-height: 34px; margin: 0 0 4px; padding: 6px 10px; flex-direction: row; justify-content: flex-start; }
                .qb-gjs .gjs-blocks-c { padding: 6px; }
                .qb-gjs .gjs-block__media { display: none; }
                .qb-gjs .gjs-block-label { font-size: 12px; }
            `}</style>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <Tb title="Undo (Ctrl+Z)" onClick={run((e) => e.UndoManager.undo())}><Undo2 className={icon} /></Tb>
                <Tb title="Redo (Ctrl+Shift+Z)" onClick={run((e) => e.UndoManager.redo())}><Redo2 className={icon} /></Tb>
                <Sep />
                <Tb
                    title="On: drag elements anywhere on the page. Off: dragging re-orders elements in the page flow"
                    on={freeMove}
                    onClick={run((e) => { const next = !freeMove; freeMoveRef.current = next; e.setDragMode(next ? 'absolute' : ''); setFreeMove(next); const sel = e.getSelected(); if (sel) { e.select(); e.select(sel); } })}
                >
                    <Move className={icon} /> Free move
                </Tb>
                <Tb
                    title="Snap to the page, other elements and (when shown) the grid while dragging"
                    on={snap}
                    onClick={() => { snapRef.current = !snap; setSnap(!snap); }}
                >
                    <Magnet className={icon} /> Snap
                </Tb>
                <Tb
                    title="Show a 10mm grid (dragged elements also snap to it)"
                    on={grid}
                    onClick={run((e) => { gridRef.current = !grid; setGridOn(!grid); setGrid(e, !grid, pageWidthMm, pageHeightMm); })}
                >
                    <Grid3x3 className={icon} /> Grid
                </Tb>
                <Tb
                    title="Show element outlines"
                    on={outlines}
                    onClick={run((e) => { if (outlines) e.stopCommand('sw-visibility'); else e.runCommand('sw-visibility'); setOutlines(!outlines); })}
                >
                    <Square className={icon} /> Outlines
                </Tb>
                <Sep />
                {align('left', 'Align left (one element: to its container; several: to the group)', <AlignStartVertical className={icon} />)}
                {align('hcenter', 'Center horizontally', <AlignCenterVertical className={icon} />)}
                {align('right', 'Align right', <AlignEndVertical className={icon} />)}
                {align('top', 'Align top', <AlignStartHorizontal className={icon} />)}
                {align('vcenter', 'Center vertically', <AlignCenterHorizontal className={icon} />)}
                {align('bottom', 'Align bottom', <AlignEndHorizontal className={icon} />)}
                <Tb title="Distribute horizontally — equal gaps (select 3 or more; Shift+click to multi-select)" disabled={selCount < 3} onClick={run((e) => distributeSelected(e, 'x'))}><AlignHorizontalSpaceBetween className={icon} /></Tb>
                <Tb title="Distribute vertically — equal gaps (select 3 or more)" disabled={selCount < 3} onClick={run((e) => distributeSelected(e, 'y'))}><AlignVerticalSpaceBetween className={icon} /></Tb>
                <Sep />
                <Tb title="Delete selected (Delete)" disabled={selCount === 0} onClick={run((e) => { e.getSelectedAll().forEach((c) => c.remove()); })}><Trash2 className={icon} /> Delete</Tb>

                <div className="ml-auto flex items-center gap-1.5">
                    <Tb title="Zoom out" onClick={() => zoomTo(zoomRef.current / 1.25)}><ZoomOut className={icon} /></Tb>
                    <span className="w-11 text-center text-xs tabular-nums text-muted-foreground" aria-live="polite">{Math.round(view.zoom * 100)}%</span>
                    <Tb title="Zoom in" onClick={() => zoomTo(zoomRef.current * 1.25)}><ZoomIn className={icon} /></Tb>
                    <Tb title="Actual size (100%)" onClick={() => zoomTo(1)}>100%</Tb>
                    <Tb title="Fit the whole page" onClick={run((e) => { fitPage(e, canvasRef.current); syncView(); })}><Maximize className={icon} /> Fit</Tb>
                </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1 shrink-0">
                Click an element, then drag it to move it or drag its square handles to resize. Shift+click selects several; arrow keys nudge (Shift: 10px). Ctrl+scroll zooms, scroll or Space+drag pans. Dashed boxes show where the logos are added — keep them clear.
            </p>

            <div className="flex flex-1 min-h-0 gap-2">
                {/* Blocks */}
                <div className="w-52 shrink-0 overflow-y-auto rounded-lg border border-border/70 bg-card">
                    <div ref={blocksRef} />
                </div>

                {/* Canvas with rulers */}
                <div className="relative flex-1 min-w-0 rounded-lg border border-border/70 overflow-hidden bg-muted/30">
                    <div className="absolute left-0 top-0 bg-card border-r border-b border-border/70" style={{ width: RULER, height: RULER }} />
                    {view.w > 0 && (
                        <>
                            <Ruler axis="x" length={Math.max(0, view.w)} origin={view.x} zoom={view.zoom} pageMm={pageWidthMm} />
                            <Ruler axis="y" length={Math.max(0, view.h)} origin={view.y} zoom={view.zoom} pageMm={pageHeightMm} />
                        </>
                    )}
                    <div ref={canvasRef} className="absolute" style={{ top: RULER, left: RULER, right: 0, bottom: 0 }} />
                </div>

                {/* Style / Settings / Layers */}
                <div className="w-72 shrink-0 flex flex-col rounded-lg border border-border/70 bg-card min-h-0">
                    <div className="flex shrink-0 border-b border-border/60">
                        {tabBtn('style', 'Style')}
                        {tabBtn('settings', 'Settings')}
                        {tabBtn('layers', 'Layers')}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                        <div className={tab === 'style' ? '' : 'hidden'}>
                            <div ref={selectorsRef} />
                            <div ref={stylesRef} />
                        </div>
                        <div ref={traitsRef} className={tab === 'settings' ? '' : 'hidden'} />
                        <div ref={layersRef} className={tab === 'layers' ? '' : 'hidden'} />
                    </div>
                </div>
            </div>
        </div>
    );
}
