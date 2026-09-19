// Fonts offered in the visual certificate editor.
//
// Certificates are rendered to PDF on the server (Alpine Chromium with only `ttf-freefont`), NOT on the
// author's machine: "Georgia", "Arial", "Times New Roman" etc. silently become FreeSerif/FreeSans there while
// the editor canvas shows the real font — so a "web-safe fonts" list would make the PDF differ from what was
// designed. Web fonts loaded by URL (the render step allows public https, and waits for fonts before printing)
// look the same everywhere, so every named font below is a Google Font, and the exported document gets a
// <link> for exactly the ones it uses.

export interface EditorFont {
    /** Family name exactly as written in CSS. */
    name: string;
    /** CSS fallback generic. */
    generic: 'serif' | 'sans-serif' | 'cursive';
    /** Google Fonts css2 `family=` spec, weights included. */
    spec: string;
}

export const EDITOR_FONTS: EditorFont[] = [
    { name: 'Playfair Display', generic: 'serif', spec: 'Playfair Display:ital,wght@0,400;0,700;1,400' },
    { name: 'Cormorant Garamond', generic: 'serif', spec: 'Cormorant Garamond:ital,wght@0,400;0,600;1,400' },
    { name: 'Cinzel', generic: 'serif', spec: 'Cinzel:wght@400;700' },
    { name: 'Lora', generic: 'serif', spec: 'Lora:ital,wght@0,400;0,700;1,400' },
    { name: 'Merriweather', generic: 'serif', spec: 'Merriweather:wght@400;700' },
    { name: 'Libre Baskerville', generic: 'serif', spec: 'Libre Baskerville:ital,wght@0,400;0,700;1,400' },
    { name: 'Montserrat', generic: 'sans-serif', spec: 'Montserrat:wght@400;600;700' },
    { name: 'Poppins', generic: 'sans-serif', spec: 'Poppins:wght@400;600;700' },
    { name: 'Raleway', generic: 'sans-serif', spec: 'Raleway:wght@400;600;700' },
    { name: 'Open Sans', generic: 'sans-serif', spec: 'Open Sans:wght@400;600;700' },
    { name: 'Great Vibes', generic: 'cursive', spec: 'Great Vibes' },
    { name: 'Dancing Script', generic: 'cursive', spec: 'Dancing Script:wght@400;700' },
    { name: 'Pinyon Script', generic: 'cursive', spec: 'Pinyon Script' },
];

/** Options for GrapesJS's font-family property: the value is the full CSS stack. */
export const FONT_STACK_OPTIONS = [
    ...EDITOR_FONTS.map((f) => ({ id: `'${f.name}', ${f.generic}`, label: `${f.name}` })),
    { id: 'serif', label: 'Serif (server default)' },
    { id: 'sans-serif', label: 'Sans-serif (server default)' },
    { id: 'monospace', label: 'Monospace (server default)' },
];

const familyOf = (spec: string) => spec.split(':')[0]!;

/** `family=Name:axes` specs -> one Google Fonts stylesheet URL (null when there are none). */
export function googleFontsHref(specs: string[]): string | null {
    const byFamily = new Map<string, string>();
    for (const spec of specs) byFamily.set(familyOf(spec), spec); // later wins: a catalog spec replaces a bare one
    if (!byFamily.size) return null;
    const params = [...byFamily.values()].map((s) => `family=${encodeURIComponent(s).replace(/%3A/g, ':').replace(/%3B/g, ';').replace(/%2C/g, ',').replace(/%40/g, '@').replace(/%20/g, '+')}`);
    return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}

/** Every catalog font referenced by a `font-family` declaration in the given CSS. */
export function catalogFontsUsedIn(css: string): EditorFont[] {
    const used = new Set<string>();
    for (const m of css.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
        for (const part of m[1]!.split(',')) used.add(part.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
    }
    return EDITOR_FONTS.filter((f) => used.has(f.name.toLowerCase()));
}

/** Family specs referenced by an existing Google Fonts <link href> (e.g. from a hand-written template). */
export function specsFromGoogleHref(href: string): string[] {
    try {
        const u = new URL(href);
        if (u.hostname !== 'fonts.googleapis.com') return [];
        return u.searchParams.getAll('family');
    } catch {
        return [];
    }
}
