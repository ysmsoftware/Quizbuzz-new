const MAX_NAME_LENGTH = 120; // keep in sync with createTemplateSchema.name
const COPY_SUFFIX_RE = / \(copy(?: \d+)?\)$/;

/**
 * "Name (copy)", then "Name (copy 2)", "Name (copy 3)", … — the first one not already taken in the org.
 * Duplicating a copy yields another sibling of the original ("Name (copy 2)"), never "Name (copy) (copy)".
 */
export function nextCopyName(name: string, taken: ReadonlySet<string>): string {
    const base = name.replace(COPY_SUFFIX_RE, "");
    for (let n = 1; ; n++) {
        const suffix = n === 1 ? " (copy)" : ` (copy ${n})`;
        const candidate = base.slice(0, MAX_NAME_LENGTH - suffix.length) + suffix;
        if (!taken.has(candidate)) return candidate;
    }
}
