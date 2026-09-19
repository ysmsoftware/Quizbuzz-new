import { renderCustomTemplateHtml } from "./certificate.template";
import { CertificateMetadata } from "./certificate.types";
import { injectBranding } from "./certificate.branding";

describe("renderCustomTemplateHtml", () => {
    const mockMetadata: CertificateMetadata = {
        participantName: "Alex Mercer",
        contestTitle: "Annual Coding Championship 2026",
        issuedAt: "2026-08-01T00:00:00.000Z",
        score: 95,
        percentage: 95.0,
        rank: 1,
        timeTakenSecs: 1200,
        orgName: "Acme Corp",
        orgLogoUrl: "https://example.com/logo.png",
        primaryColor: "#0055ff",
    };

    it("substitutes known placeholders correctly", () => {
        const htmlTemplate = `<h1>{{participantName}}</h1><p>Scored {{percentage}}% in {{contestTitle}} for {{orgName}}</p>`;
        const output = renderCustomTemplateHtml(htmlTemplate, mockMetadata, "CERT-12345");

        expect(output).toContain("<h1>Alex Mercer</h1>");
        expect(output).toContain("95%");
        expect(output).toContain("Annual Coding Championship 2026");
        expect(output).toContain("Acme Corp");
    });

    it("replaces unknown placeholders with empty string", () => {
        const htmlTemplate = `<div>{{participantName}} - {{invalidPlaceholder}} - {{anotherTypo}}</div>`;
        const output = renderCustomTemplateHtml(htmlTemplate, mockMetadata, "CERT-12345");

        expect(output).toBe("<div>Alex Mercer -  - </div>");
        expect(output).not.toContain("{{invalidPlaceholder}}");
        expect(output).not.toContain("{{anotherTypo}}");
    });

    it("returns unchanged string if no placeholders exist", () => {
        const htmlTemplate = `<div>Static Certificate Content</div>`;
        const output = renderCustomTemplateHtml(htmlTemplate, mockMetadata, "CERT-12345");

        expect(output).toBe("<div>Static Certificate Content</div>");
    });

    it("HTML-escapes substituted values (participant names are user-supplied)", () => {
        const output = renderCustomTemplateHtml(`<p>{{participantName}}</p>`, { ...mockMetadata, participantName: `<img src="http://169.254.169.254/x">` }, "C1");
        expect(output).not.toContain("<img");
        expect(output).toContain("&lt;img");
    });

    it("blanks a non-http(s) orgLogoUrl and a non-hex primaryColor", () => {
        const output = renderCustomTemplateHtml(
            `<img src="{{orgLogoUrl}}"><i style="color:{{primaryColor}}">`,
            { ...mockMetadata, orgLogoUrl: "javascript:alert(1)", primaryColor: "red;}</style><x" },
            "C1",
        );
        expect(output).toContain(`src=""`);
        expect(output).toContain("color:#1a3a6b");
    });

    it("strips iframes, embeds, event handlers and meta-refresh from the template", () => {
        const output = renderCustomTemplateHtml(
            `<iframe src="http://10.0.0.1/"></iframe><object data="x"></object><img src="a.png" onerror="x()"><meta http-equiv="refresh" content="0;url=http://10.0.0.1"><p>ok</p>`,
            mockMetadata, "C1",
        );
        expect(output).not.toMatch(/iframe|<object|onerror|refresh/i);
        expect(output).toContain("<p>ok</p>");
    });
});

describe("injectBranding", () => {
    const base = { appLogoUrl: "https://cdn.example.com/qb.png", orgLogoUrl: "https://cdn.example.com/org.png", orgName: "Acme", orgLogoPosition: "bottom-center" as const, pageSize: null };

    it("puts the QuizBuzz logo top-left and the org logo at the chosen position, before </body>", () => {
        const out = injectBranding("<html><body><p>x</p></body></html>", base);
        expect(out).toMatch(/class="qb-logo qb-top-left" src="https:\/\/cdn.example.com\/qb.png"/);
        expect(out).toMatch(/class="qb-logo qb-bottom-center" src="https:\/\/cdn.example.com\/org.png"/);
        expect(out.indexOf("qb-logo qb-top-left")).toBeLessThan(out.indexOf("</body>"));
    });

    it("moves the QuizBuzz logo to top-right when the org claims top-left", () => {
        const out = injectBranding("<body></body>", { ...base, orgLogoPosition: "top-left" });
        expect(out).toContain('class="qb-logo qb-top-right" src="https://cdn.example.com/qb.png"');
        expect(out).toContain('class="qb-logo qb-top-left" src="https://cdn.example.com/org.png"');
    });

    it("skips the org logo for position none or when the org has no logo, but keeps the QuizBuzz logo", () => {
        expect(injectBranding("<body></body>", { ...base, orgLogoPosition: "none" })).not.toContain("org.png");
        const out = injectBranding("<body></body>", { ...base, orgLogoUrl: null });
        expect(out).not.toContain("org.png");
        expect(out).toContain("qb.png");
    });

    it("forces the page size when a preset is set, and leaves it alone when null", () => {
        expect(injectBranding("<body></body>", { ...base, pageSize: "a4-portrait" })).toContain("@page{size:A4 portrait;margin:0}");
        expect(injectBranding("<body></body>", base)).not.toContain("@page");
    });
});