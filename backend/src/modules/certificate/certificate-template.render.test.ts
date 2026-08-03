import { renderCustomTemplateHtml } from "./certificate.template";
import { CertificateMetadata } from "./certificate.types";

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
});
