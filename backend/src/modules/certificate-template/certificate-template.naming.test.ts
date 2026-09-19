import { nextCopyName } from "./certificate-template.naming";

describe("nextCopyName", () => {
    it("appends (copy) to a fresh name", () => {
        expect(nextCopyName("Summit", new Set(["Summit"]))).toBe("Summit (copy)");
    });

    it("numbers further copies from 2", () => {
        expect(nextCopyName("Summit", new Set(["Summit", "Summit (copy)"]))).toBe("Summit (copy 2)");
        expect(nextCopyName("Summit", new Set(["Summit", "Summit (copy)", "Summit (copy 2)"]))).toBe("Summit (copy 3)");
    });

    it("duplicating a copy makes a sibling of the original, not '(copy) (copy)'", () => {
        expect(nextCopyName("Summit (copy)", new Set(["Summit", "Summit (copy)"]))).toBe("Summit (copy 2)");
        expect(nextCopyName("Summit (copy 2)", new Set(["Summit", "Summit (copy)", "Summit (copy 2)"]))).toBe("Summit (copy 3)");
    });

    it("fills the first free gap", () => {
        expect(nextCopyName("Summit", new Set(["Summit", "Summit (copy 2)"]))).toBe("Summit (copy)");
    });

    it("never exceeds the 120-char name limit", () => {
        const long = "x".repeat(120);
        const out = nextCopyName(long, new Set([long]));
        expect(out.length).toBeLessThanOrEqual(120);
        expect(out.endsWith(" (copy)")).toBe(true);
    });
});
