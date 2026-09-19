// Ready-made designs the visual editor can start from. All are A4 landscape (297 x 210mm) and follow the
// logo-safe layout rules the platform enforces (see buildCertificateAiPrompt rule 8): frames stay within the
// outer 12mm, the top-left/top-right/bottom logo boxes (42 x 14mm, 20mm in from the edges) are left clear,
// and text starts at least 38mm below the top edge. Placeholders are only ones the backend resolves, and
// `{{primaryColor}}` is used for accents so a template follows the organization's brand color.
// Web fonts come in through a <link>; see certificate-fonts.ts for why not system fonts.

export interface CertificateStarter {
    id: string;
    name: string;
    description: string;
    html: string;
}

const PAGE = `* { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 297mm; height: 210mm; overflow: hidden; background: #ffffff; }`;

const fontLink = (spec: string) =>
    `<link href="https://fonts.googleapis.com/css2?family=${spec}&display=swap" rel="stylesheet" />`;

const CLASSIC = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Certificate</title>
<style>
  ${PAGE}
  .frame { position: absolute; top: 8mm; left: 8mm; right: 8mm; bottom: 8mm; border: 2px solid {{primaryColor}}; }
  .content { position: absolute; top: 42mm; left: 30mm; right: 30mm; text-align: center; font-family: Georgia, serif; }
  .title { font-size: 34px; font-weight: bold; color: {{primaryColor}}; }
  .sub { margin-top: 10px; font-size: 14px; color: #666; letter-spacing: 2px; text-transform: uppercase; font-family: Arial, sans-serif; }
  .name { margin-top: 22px; font-size: 40px; font-weight: bold; color: #1a1a1a; border-bottom: 2px solid {{primaryColor}}; display: inline-block; padding: 0 24px 6px; }
  .body { margin-top: 20px; font-size: 15px; color: #555; font-family: Arial, sans-serif; }
  .contest { margin-top: 10px; font-size: 22px; font-weight: bold; color: {{primaryColor}}; }
  .foot { position: absolute; bottom: 11mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; font-size: 10px; color: #999; font-family: Arial, sans-serif; }
</style>
</head>
<body>
  <div class="frame"></div>
  <div class="content">
    <div class="title">Certificate of Achievement</div>
    <div class="sub">This certifies that</div>
    <div class="name">{{participantName}}</div>
    <div class="body">has successfully completed</div>
    <div class="contest">{{contestTitle}}</div>
    <div class="body">{{contestDate}} &middot; Score {{percentage}}% &middot; Rank #{{rank}}</div>
  </div>
  <div class="foot"><span>Issued {{issuedAt}}</span><span>ID {{certificateId}}</span></div>
</body>
</html>`;

const MODERN = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Certificate</title>
${fontLink('Montserrat:wght@400;600;700')}
<style>
  ${PAGE}
  .band { position: absolute; top: 0; left: 0; bottom: 0; width: 14mm; background: {{primaryColor}}; }
  .edge { position: absolute; top: 0; left: 14mm; bottom: 0; width: 2mm; background: {{primaryColor}}; opacity: 0.25; }
  .content { position: absolute; top: 46mm; left: 44mm; right: 30mm; font-family: 'Montserrat', sans-serif; }
  .kicker { font-size: 13px; letter-spacing: 5px; text-transform: uppercase; color: #8a8a8a; }
  .title { margin-top: 8px; font-size: 46px; font-weight: 700; color: #111111; line-height: 1.1; }
  .rule { width: 40mm; height: 3px; background: {{primaryColor}}; margin: 20px 0; }
  .name { font-size: 38px; font-weight: 600; color: {{primaryColor}}; }
  .body { margin-top: 14px; font-size: 15px; color: #555555; line-height: 1.6; }
  .contest { margin-top: 6px; font-size: 20px; font-weight: 600; color: #111111; }
  .foot { position: absolute; bottom: 11mm; left: 44mm; right: 30mm; display: flex; justify-content: space-between; font-family: 'Montserrat', sans-serif; font-size: 10px; color: #999999; }
</style>
</head>
<body>
  <div class="band"></div>
  <div class="edge"></div>
  <div class="content">
    <div class="kicker">Certificate</div>
    <div class="title">of Achievement</div>
    <div class="rule"></div>
    <div class="body">Awarded to</div>
    <div class="name">{{participantName}}</div>
    <div class="body">for outstanding performance in</div>
    <div class="contest">{{contestTitle}}</div>
    <div class="body">{{contestDate}} &middot; Score {{percentage}}% &middot; Rank #{{rank}}</div>
  </div>
  <div class="foot"><span>Issued {{issuedAt}}</span><span>ID {{certificateId}}</span></div>
</body>
</html>`;

const MINIMAL = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Certificate</title>
${fontLink('Cormorant+Garamond:ital,wght@0,400;0,600;1,400')}
<style>
  ${PAGE}
  .frame { position: absolute; top: 10mm; left: 10mm; right: 10mm; bottom: 10mm; border: 1px solid #c9c9c9; }
  .content { position: absolute; top: 52mm; left: 30mm; right: 30mm; text-align: center; font-family: 'Cormorant Garamond', serif; color: #222222; }
  .kicker { font-size: 14px; letter-spacing: 8px; text-transform: uppercase; color: {{primaryColor}}; }
  .name { margin-top: 26px; font-size: 58px; font-style: italic; font-weight: 400; line-height: 1.1; }
  .line { width: 60mm; height: 1px; background: {{primaryColor}}; margin: 20px auto; }
  .body { font-size: 18px; color: #555555; line-height: 1.6; }
  .contest { margin-top: 4px; font-size: 26px; font-weight: 600; }
  .foot { position: absolute; bottom: 14mm; left: 20mm; right: 20mm; display: flex; justify-content: space-between; font-family: 'Cormorant Garamond', serif; font-size: 12px; color: #999999; }
</style>
</head>
<body>
  <div class="frame"></div>
  <div class="content">
    <div class="kicker">Certificate of Achievement</div>
    <div class="name">{{participantName}}</div>
    <div class="line"></div>
    <div class="body">has successfully completed</div>
    <div class="contest">{{contestTitle}}</div>
    <div class="body">{{contestDate}}</div>
  </div>
  <div class="foot"><span>Issued {{issuedAt}}</span><span>ID {{certificateId}}</span></div>
</body>
</html>`;

const ELEGANT = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Certificate</title>
${fontLink('Playfair+Display:wght@400;700&family=Great+Vibes&family=Lora:ital,wght@0,400;1,400')}
<style>
  ${PAGE}
  .outer { position: absolute; top: 8mm; left: 8mm; right: 8mm; bottom: 8mm; border: 2px solid #b08d2f; }
  .inner { position: absolute; top: 12mm; left: 12mm; right: 12mm; bottom: 12mm; border: 1px solid {{primaryColor}}; }
  .dot { position: absolute; width: 4mm; height: 4mm; background: #b08d2f; transform: rotate(45deg); }
  .tl { top: 10mm; left: 10mm; margin: -2mm 0 0 -2mm; } .tr { top: 10mm; right: 10mm; margin: -2mm -2mm 0 0; }
  .bl { bottom: 10mm; left: 10mm; margin: 0 0 -2mm -2mm; } .br { bottom: 10mm; right: 10mm; margin: 0 -2mm -2mm 0; }
  .content { position: absolute; top: 40mm; left: 30mm; right: 30mm; text-align: center; }
  .title { font-family: 'Playfair Display', serif; font-size: 30px; font-weight: 700; letter-spacing: 6px; text-transform: uppercase; color: {{primaryColor}}; }
  .sub { margin-top: 8px; font-family: 'Lora', serif; font-style: italic; font-size: 15px; color: #777777; }
  .name { margin-top: 12px; font-family: 'Great Vibes', cursive; font-size: 68px; color: #1a1a1a; line-height: 1.15; }
  .body { margin-top: 10px; font-family: 'Lora', serif; font-size: 15px; color: #555555; }
  .contest { margin-top: 8px; font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; color: {{primaryColor}}; }
  .foot { position: absolute; bottom: 16mm; left: 24mm; right: 24mm; display: flex; justify-content: space-between; font-family: 'Lora', serif; font-size: 10px; color: #999999; }
</style>
</head>
<body>
  <div class="outer"></div>
  <div class="inner"></div>
  <div class="dot tl"></div><div class="dot tr"></div><div class="dot bl"></div><div class="dot br"></div>
  <div class="content">
    <div class="title">Certificate of Achievement</div>
    <div class="sub">is proudly presented to</div>
    <div class="name">{{participantName}}</div>
    <div class="body">for successfully completing</div>
    <div class="contest">{{contestTitle}}</div>
    <div class="body">{{contestDate}} &middot; Score {{percentage}}% &middot; Rank #{{rank}}</div>
  </div>
  <div class="foot"><span>Issued {{issuedAt}}</span><span>ID {{certificateId}}</span></div>
</body>
</html>`;

const BLANK = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Certificate</title>
<style>
  ${PAGE}
</style>
</head>
<body></body>
</html>`;

export const CERTIFICATE_STARTERS: CertificateStarter[] = [
    { id: 'classic', name: 'Classic', description: 'Serif title, a single navy frame — timeless and formal.', html: CLASSIC },
    { id: 'modern', name: 'Modern', description: 'Bold sans-serif with a colored side band, left-aligned.', html: MODERN },
    { id: 'minimal', name: 'Minimal', description: 'Hairline frame, generous whitespace, italic serif name.', html: MINIMAL },
    { id: 'elegant', name: 'Elegant', description: 'Double gold-and-brand border with a script name.', html: ELEGANT },
    { id: 'blank', name: 'Blank page', description: 'An empty page — add everything yourself.', html: BLANK },
];

const SAMPLE: Record<string, string> = {
    participantName: 'Jordan Sample',
    contestTitle: 'Sample Contest 2026',
    contestDate: '19 September 2026',
    issuedAt: '19 September 2026',
    score: '87',
    percentage: '87.5',
    rank: '2',
    timeTakenSecs: '1725',
    orgName: 'Your Organization',
    certificateId: 'PREVIEW-0000001',
    primaryColor: '#1a3a6b',
    orgLogoUrl: '',
};

/** Fills placeholders with sample values — for gallery thumbnails only (real certificates are rendered server-side). */
export function fillSampleData(html: string): string {
    return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => SAMPLE[k] ?? '');
}
