// Converts between a certificate template's stored full HTML document and the
// body-HTML + CSS pair the GrapesJS visual editor works with.
//
// GrapesJS only edits body content and parses CSS through the browser's CSSOM, which
// silently drops declarations it can't parse — including `{{primaryColor}}` used as a
// CSS value. `var(--x)` is NOT a safe stand-in: a shorthand like `border: 2px solid var(--x)`
// or a gradient background is dropped entirely. So on the way in, `{{primaryColor}}` (the only
// placeholder that realistically appears in CSS) becomes a real, unique color literal that
// parses everywhere, and any other `{{token}}` in CSS becomes `var(--qb-ph-token)`; both are
// turned back on export. The stand-in is one RGB step off the default navy, so it looks right.
// `@page` rules and <title> are set aside (GrapesJS would lose them) and put back on export.

import { catalogFontsUsedIn, googleFontsHref, specsFromGoogleHref } from './certificate-fonts';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const PAGE_RULE_RE = /@page[^{]*\{[^}]*\}/gi;
const PH_VAR_RE = /var\(\s*--qb-ph-([a-zA-Z0-9_]+)\s*\)/g;

const PRIMARY_RE = /\{\{\s*primaryColor\s*\}\}/g;
/** Stand-in for {{primaryColor}} while editing; blocks that should follow the brand color use it too, and it exports back to the token. */
export const PRIMARY_STANDIN = '#1a3a6c';
const PRIMARY_STANDIN_RE = /#1a3a6c\b|rgb\(\s*26\s*,\s*58\s*,\s*108\s*\)/gi;

const phToCss = (s: string) => s.replace(PRIMARY_RE, PRIMARY_STANDIN).replace(PLACEHOLDER_RE, 'var(--qb-ph-$1)');
const varToPh = (s: string) => s.replace(PH_VAR_RE, '{{$1}}');
const cssToPh = (s: string) => varToPh(s.replace(PRIMARY_STANDIN_RE, '{{primaryColor}}'));

export interface EditorSource {
    /** Body inner HTML, placeholders inside style="" already protected. */
    html: string;
    /** All <style> content merged, `@page` removed, CSS placeholders protected. */
    css: string;
    /** Original `@page { ... }` rules — re-emitted verbatim on export. */
    pageRules: string;
    title: string;
    /** External (https) stylesheets other than Google Fonts — re-emitted as-is on export. */
    links: string[];
    /** Google Fonts `family=` specs from an existing <link> — merged with the fonts the design actually uses. */
    googleSpecs: string[];
}

export function toEditorSource(fullHtml: string): EditorSource {
    const doc = new DOMParser().parseFromString(fullHtml, 'text/html');
    doc.querySelectorAll('script').forEach((n) => n.remove());

    const styles = Array.from(doc.querySelectorAll('style'));
    // Comments first: a comment mentioning `@page` must not be mistaken for a rule.
    let css = styles.map((n) => n.textContent ?? '').join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
    styles.forEach((n) => n.remove());

    const pageRules = (css.match(PAGE_RULE_RE) ?? []).join('\n');
    css = phToCss(css.replace(PAGE_RULE_RE, ''));

    const links: string[] = [];
    const googleSpecs: string[] = [];
    doc.querySelectorAll('link[rel~="stylesheet"]').forEach((l) => {
        const href = l.getAttribute('href') ?? '';
        const specs = specsFromGoogleHref(href);
        if (specs.length) googleSpecs.push(...specs);
        else if (/^https:\/\//i.test(href)) links.push(href);
    });

    const html = doc.body.innerHTML.replace(/style="([^"]*)"/g, (_m, v: string) => `style="${phToCss(v)}"`);
    return { html, css, pageRules, title: doc.title, links, googleSpecs };
}

const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function fromEditorOutput(
    out: { html: string; css: string },
    keep: Pick<EditorSource, 'pageRules' | 'title' | 'links' | 'googleSpecs'>,
): string {
    const css = cssToPh(out.css);
    const style = [keep.pageRules, css].filter(Boolean).join('\n');
    // Web fonts: the fonts the design uses, plus whatever an existing Google Fonts link already covered.
    const fontsHref = googleFontsHref([...keep.googleSpecs, ...catalogFontsUsedIn(css).map((f) => f.spec)]);
    const links = [...keep.links, ...(fontsHref ? [fontsHref] : [])].map((h) => `<link rel="stylesheet" href="${escAttr(h)}" />`);
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escText(keep.title || 'Certificate')}</title>
${links.length ? links.join('\n') + '\n' : ''}<style>
${style}
</style>
</head>
<body>
${varToPh(out.html)}
</body>
</html>`;
}
