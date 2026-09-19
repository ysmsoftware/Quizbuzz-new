// Local draft recovery for the visual certificate editor: a crashed tab, an accidental reload or a lost
// network must not throw away a design. Drafts live in localStorage per template ("new" for an unsaved one),
// are written while editing, and are removed on a successful save. Every access is guarded — storage can be
// unavailable (private mode, quota) and the editor must work fine without it.

export interface CertificateDraft {
    name: string;
    html: string;
    orgLogoPosition: string;
    pageSize: string | null;
    savedAt: number;
}

const key = (id: string | null) => `qb:certificate-draft:${id ?? 'new'}`;

export function loadDraft(id: string | null): CertificateDraft | null {
    try {
        const raw = localStorage.getItem(key(id));
        if (!raw) return null;
        const d = JSON.parse(raw) as Partial<CertificateDraft>;
        return typeof d.html === 'string' && typeof d.name === 'string' ? (d as CertificateDraft) : null;
    } catch {
        return null;
    }
}

export function saveDraft(id: string | null, draft: Omit<CertificateDraft, 'savedAt'>): void {
    try {
        localStorage.setItem(key(id), JSON.stringify({ ...draft, savedAt: Date.now() }));
    } catch {
        /* storage unavailable or full — drafts are best-effort */
    }
}

export function clearDraft(id: string | null): void {
    try {
        localStorage.removeItem(key(id));
    } catch {
        /* nothing to clear */
    }
}
