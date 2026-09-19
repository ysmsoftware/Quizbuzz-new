// Layout tools for the visual certificate editor, operating on a GrapesJS editor: freezing an element
// to an explicit px box, arrow-key nudging, align/distribute, drag snapping with alignment lines, and a
// grid overlay. Kept apart from the React component so the geometry is easy to read on its own.
//
// Everything works in the canvas iframe's own coordinate space (unscaled "frame px", what
// getBoundingClientRect returns inside the iframe) — never in screen px — so zoom doesn't matter.

import type { Component, Editor } from 'grapesjs';

export const MM_TO_PX = 96 / 25.4;
export const GRID_MM = 10;

const ACCENT = '#ec4899';
const num = (v: unknown) => parseFloat(String(v ?? ''));
const isPx = (v: unknown) => /px$/.test(String(v ?? ''));

/**
 * GrapesJS measures an element's border box, but CSS `top`/`left` place its MARGIN edge — so an element
 * with `margin-top: 22px` visibly jumps 22px the moment it becomes absolute. Zero the leading margins.
 */
export function zeroLeadingMargins(comp: Component) {
    const el = comp.getEl();
    if (!el) return;
    const cs = el.ownerDocument.defaultView!.getComputedStyle(el);
    const fix: Record<string, string> = {};
    if (parseFloat(cs.marginTop)) fix['margin-top'] = '0px';
    if (parseFloat(cs.marginLeft)) fix['margin-left'] = '0px';
    if (Object.keys(fix).length) comp.addStyle(fix);
}

/**
 * Pins an element to an explicit absolute box (left/top/width in px) at exactly its current visual
 * position — whatever it was before: static, or absolute with %/mm/right/bottom offsets. Measured BEFORE
 * changing anything, since taking an element out of the flow / zeroing margins moves it.
 */
export function freezeBox(comp: Component): HTMLElement | null {
    const el = comp.getEl();
    if (!el) return null;
    const st = comp.getStyle();
    const pinned =
        st.position === 'absolute' && isPx(st.left) && isPx(st.top) && (st.right === undefined || st.right === 'auto') && !parseFloat(String(st['margin-left'] ?? 0)) && !parseFloat(String(st['margin-top'] ?? 0));
    if (pinned) return el;

    const box = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth };
    const fix: Record<string, string> = {
        position: 'absolute',
        left: `${box.left}px`,
        top: `${box.top}px`,
        right: 'auto',
        bottom: 'auto',
        'margin-left': '0px',
        'margin-top': '0px',
    };
    // Absolute positioning shrink-wraps a full-width block, so keep the width it had.
    if (!/(px|mm|%)$/.test(String(st.width ?? ''))) fix.width = `${box.width}px`;
    comp.addStyle(fix);
    return el;
}

export function nudgeSelected(editor: Editor, dx: number, dy: number) {
    editor.getSelectedAll().forEach((c) => {
        if (!freezeBox(c)) return;
        const st = c.getStyle();
        c.addStyle({ left: `${num(st.left) + dx}px`, top: `${num(st.top) + dy}px` });
    });
}

/** Arrow keys nudge the selection 1px (Shift: 10px). Reads `event.key` (keyCode is deprecated and absent on some synthetic events). */
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** Attaches the nudge listener to a document (the editor page and the canvas iframe both need one); returns a remover. */
export function installNudgeKeys(editor: Editor, doc: Document): () => void {
    const onKey = (ev: KeyboardEvent) => {
        // GrapesJS re-dispatches keys pressed inside the canvas iframe on the editor page as synthetic (untrusted) events; the iframe's
        // own listener already handled that press, so the page-level one must ignore them or every keypress would nudge twice.
        if (doc === document && !ev.isTrusted) return;
        const dir = ARROWS[ev.key];
        if (!dir || ev.ctrlKey || ev.metaKey || ev.altKey) return;
        if (editor.getModel().isEditing() || editor.Canvas.isInputFocused()) return; // typing in a text element / an input
        // Arrow keys belong to inputs, open menus/lists and dialogs, not to the canvas.
        if ((ev.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"], [role="dialog"]')) return;
        if (!editor.getSelectedAll().length) return;
        ev.preventDefault();
        const step = ev.shiftKey ? 10 : 1;
        nudgeSelected(editor, dir[0] * step, dir[1] * step);
    };
    doc.addEventListener('keydown', onKey);
    return () => doc.removeEventListener('keydown', onKey);
}

// ─── Align / distribute ──────────────────────────────────────────────────────

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
const rectOf = (el: HTMLElement): Rect => el.getBoundingClientRect();

/** The area a lone element aligns within: its positioned container's padding box (the whole page for the body). */
function containerRect(el: HTMLElement): Rect {
    const doc = el.ownerDocument;
    const parent = el.offsetParent as HTMLElement | null;
    if (!parent || parent === doc.body || parent === doc.documentElement) {
        const w = doc.documentElement.clientWidth, h = doc.documentElement.clientHeight;
        return { left: 0, top: 0, right: w, bottom: h, width: w, height: h };
    }
    const r = parent.getBoundingClientRect();
    const left = r.left + parent.clientLeft, top = r.top + parent.clientTop;
    return { left, top, right: left + parent.clientWidth, bottom: top + parent.clientHeight, width: parent.clientWidth, height: parent.clientHeight };
}

/** One element aligns to its container; two or more align to their shared bounding box. */
export function alignSelected(editor: Editor, mode: AlignMode) {
    const comps = editor.getSelectedAll().filter((c) => c.getEl());
    if (!comps.length) return;
    comps.forEach(freezeBox);
    const els = comps.map((c) => c.getEl()!);

    const ref: Rect = (() => {
        if (els.length === 1) return containerRect(els[0]!);
        const rs = els.map(rectOf);
        const left = Math.min(...rs.map((r) => r.left)), top = Math.min(...rs.map((r) => r.top));
        const right = Math.max(...rs.map((r) => r.right)), bottom = Math.max(...rs.map((r) => r.bottom));
        return { left, top, right, bottom, width: right - left, height: bottom - top };
    })();

    comps.forEach((c, i) => {
        const r = rectOf(els[i]!);
        const st = c.getStyle();
        switch (mode) {
            case 'left': return c.addStyle({ left: `${num(st.left) + (ref.left - r.left)}px` });
            case 'hcenter': return c.addStyle({ left: `${num(st.left) + ((ref.left + ref.right) / 2 - (r.left + r.right) / 2)}px` });
            case 'right': return c.addStyle({ left: `${num(st.left) + (ref.right - r.right)}px` });
            case 'top': return c.addStyle({ top: `${num(st.top) + (ref.top - r.top)}px` });
            case 'vcenter': return c.addStyle({ top: `${num(st.top) + ((ref.top + ref.bottom) / 2 - (r.top + r.bottom) / 2)}px` });
            case 'bottom': return c.addStyle({ top: `${num(st.top) + (ref.bottom - r.bottom)}px` });
        }
    });
}

/** Equal gaps between three or more elements along an axis; the outermost two stay where they are. */
export function distributeSelected(editor: Editor, axis: 'x' | 'y') {
    const comps = editor.getSelectedAll().filter((c) => c.getEl());
    if (comps.length < 3) return;
    comps.forEach(freezeBox);
    const key = axis === 'x' ? 'left' : 'top';
    const size = axis === 'x' ? 'width' : 'height';
    const items = comps.map((c) => ({ c, r: rectOf(c.getEl()!) })).sort((a, b) => a.r[key] - b.r[key]);
    const first = items[0]!.r, last = items[items.length - 1]!.r;
    const span = last[axis === 'x' ? 'right' : 'bottom'] - first[key];
    const gap = (span - items.reduce((sum, { r }) => sum + r[size], 0)) / (items.length - 1);

    let cursor = first[key];
    items.forEach(({ c, r }) => {
        c.addStyle({ [key]: `${num(c.getStyle()[key]) + (cursor - r[key])}px` });
        cursor += r[size] + gap;
    });
}

// ─── Grid overlay ────────────────────────────────────────────────────────────

/** A non-exported grid drawn over the page (in the canvas iframe, so it scales and pans with it). */
export function setGrid(editor: Editor, visible: boolean, pageWidthMm: number, pageHeightMm: number) {
    const doc = editor.Canvas.getDocument();
    if (!doc) return;
    doc.getElementById('qb-grid')?.remove();
    if (!visible) return;
    const line = 'rgba(59,130,246,0.22)';
    const el = doc.createElement('div');
    el.id = 'qb-grid';
    el.setAttribute(
        'style',
        `position:absolute;left:0;top:0;width:${pageWidthMm}mm;height:${pageHeightMm}mm;pointer-events:none;z-index:2147483645;` +
            `background-image:linear-gradient(to right,${line} 1px,transparent 1px),linear-gradient(to bottom,${line} 1px,transparent 1px);` +
            `background-size:${GRID_MM}mm ${GRID_MM}mm;`,
    );
    doc.documentElement.appendChild(el);
}

// ─── Snapping with alignment lines ───────────────────────────────────────────

export interface SnapContext {
    enabled: () => boolean;
    gridVisible: () => boolean;
    /** Canvas zoom as a fraction (0.42 = 42%). */
    zoom: () => number;
    pageSizePx: () => { w: number; h: number };
}

type Best = { diff: number; line: number; span: [number, number] } | null;

/**
 * While an element is dragged, snap its edges/center to the page, its container and every other element
 * (and to grid lines when the grid is shown), and draw the alignment lines. GrapesJS has its own guide
 * snapping, but it works in canvas-relative units that don't match the zoomed frame, so it is switched off
 * and this does the job in frame px, within 6 screen px.
 */
export function installSnapping(editor: Editor, ctx: SnapContext) {
    // Disable the built-in guides (they'd fight this): the drag command reads them through these two methods.
    const cmd = editor.Commands.get('core:component-drag') as unknown as { getGuidesStatic: () => unknown[]; getGuidesTarget: () => unknown[] } | undefined;
    if (cmd) {
        cmd.getGuidesStatic = () => [];
        cmd.getGuidesTarget = () => [];
    }

    const clear = () => editor.Canvas.getDocument()?.getElementById('qb-snap')?.remove();

    const apply = (target: Component, final: boolean) => {
        const el = target.getEl();
        const st = target.getStyle();
        if (!ctx.enabled() || !el || st.position !== 'absolute') return clear();

        const doc = el.ownerDocument;
        const z = ctx.zoom() || 1;
        const threshold = 6 / z;
        const page = ctx.pageSizePx();
        const t = rectOf(el);
        const tx = [t.left, t.left + t.width / 2, t.right];
        const ty = [t.top, t.top + t.height / 2, t.bottom];

        let bx: Best = null, by: Best = null;
        const offer = (cLines: number[], tLines: number[], span: [number, number], cur: Best): Best => {
            let best = cur;
            for (const c of cLines) for (const v of tLines) {
                const d = c - v;
                if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.diff))) best = { diff: d, line: c, span };
            }
            return best;
        };

        // The page itself: its edges and center lines.
        bx = offer([0, page.w / 2, page.w], tx, [0, page.h], bx);
        by = offer([0, page.h / 2, page.h], ty, [0, page.w], by);

        // Every other rendered element that isn't inside the dragged one (ancestors are fine — their edges/center are useful).
        let seen = 0;
        for (const other of Array.from(doc.body.querySelectorAll<HTMLElement>('*'))) {
            if (other === el || el.contains(other) || ++seen > 300) continue;
            const r = rectOf(other);
            if (r.width < 2 || r.height < 2) continue;
            bx = offer([r.left, r.left + r.width / 2, r.right], tx, [Math.min(t.top, r.top), Math.max(t.bottom, r.bottom)], bx);
            by = offer([r.top, r.top + r.height / 2, r.bottom], ty, [Math.min(t.left, r.left), Math.max(t.right, r.right)], by);
        }

        if (ctx.gridVisible()) {
            const step = GRID_MM * MM_TO_PX;
            bx = offer(tx.map((v) => Math.round(v / step) * step), tx, [0, page.h], bx);
            by = offer(ty.map((v) => Math.round(v / step) * step), ty, [0, page.w], by);
        }

        const move: Record<string, string> = {};
        const tenth = (v: number) => Math.round(v * 10) / 10; // sub-pixel scaling noise shouldn't leak into the saved CSS
        if (bx) move.left = `${tenth(num(st.left) + bx.diff)}px`;
        if (by) move.top = `${tenth(num(st.top) + by.diff)}px`;
        if (Object.keys(move).length) target.addStyle(move, { avoidStore: !final });

        clear();
        if (!bx && !by) return;
        const w = 1.5 / z; // keep the line ~1.5 screen px at any zoom
        const line = (css: string) => `<div style="position:absolute;background:${ACCENT};${css}"></div>`;
        const overlay = doc.createElement('div');
        overlay.id = 'qb-snap';
        overlay.setAttribute('style', 'position:absolute;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647');
        overlay.innerHTML =
            (bx ? line(`left:${bx.line - w / 2}px;top:${bx.span[0]}px;width:${w}px;height:${bx.span[1] - bx.span[0]}px`) : '') +
            (by ? line(`top:${by.line - w / 2}px;left:${by.span[0]}px;height:${w}px;width:${by.span[1] - by.span[0]}px`) : '');
        doc.documentElement.appendChild(overlay);
    };

    editor.on('dmode:move', ({ target }: { target: Component }) => apply(target, false));
    editor.on('dmode:end', ({ target }: { target: Component }) => {
        apply(target, true);
        clear();
    });
}
