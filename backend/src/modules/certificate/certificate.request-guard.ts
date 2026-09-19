import dns from "dns/promises";
import net from "net";
import type { Page } from "puppeteer";
import logger from "../../config/logger";

/** True for loopback / link-local (cloud metadata) / RFC1918 / ULA addresses. */
export function isPrivateIp(ip: string): boolean {
    if (net.isIPv6(ip)) {
        const v = ip.toLowerCase();
        if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
        return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
    }
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * Custom-template pages may only fetch public http(s) hosts (plus `allowedHosts`, the
 * org/app logo hosts, which may legitimately be private in dev). Everything else — internal
 * IPs, cloud metadata, file:// — is aborted, so a template can't make this worker probe or
 * render internal resources into a PDF.
 * ponytail: resolve-then-fetch has a DNS-rebinding window; pin to the resolved IP if this matters.
 */
export async function guardRequests(page: Page, allowedHosts: string[]): Promise<void> {
    const verdicts = new Map<string, boolean>(allowedHosts.map((h) => [h, true]));
    await page.setRequestInterception(true);
    page.on("request", async (req) => {
        try {
            const url = new URL(req.url());
            if (url.protocol === "data:" || url.protocol === "about:" || url.protocol === "blob:") return void req.continue();
            if (url.protocol !== "http:" && url.protocol !== "https:") return void req.abort("blockedbyclient");

            const host = url.hostname.replace(/^\[|\]$/g, "");
            let ok = verdicts.get(host);
            if (ok === undefined) {
                const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
                ok = addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
                verdicts.set(host, ok);
            }
            if (ok) return void req.continue();
            logger.warn(`[certificate-worker] Blocked template request to non-public host: ${host}`);
            await req.abort("blockedbyclient");
        } catch {
            await req.abort("blockedbyclient").catch(() => undefined);
        }
    });
}
