# Sample Certificate Templates — Manual Test Kit

Three `.html` files, each testing a different part of the custom certificate template
feature. Written from the org-admin's point of view — open your app, go to
**Certificates → Manage Templates** (`/org/certificates/templates`), and upload each one
yourself using the steps below.

## Before you start

You'll need at least one contest with a **SUBMITTED + evaluated** participant to actually
issue a test certificate end-to-end (the "Issue" step). If you don't have one handy, you
can still fully test the upload/preview/save/edit/delete flow for all three files without
issuing anything — that alone exercises most of the feature.

---

## Template 1 — `01-classic-default-a4-landscape.html`

**What it tests:** the happy path. A clean, complete certificate design using every
known system variable, with no `@page` rule declared — so it should default to A4
landscape (297mm × 210mm), same as every built-in certificate.

**Steps:**
1. Click **New Template**, name it something like "Classic Default Test".
2. Paste the file's contents into the HTML box, or use **Upload .html file** and pick it.
3. Click **Preview Template**.
4. **Expect:** the preview badge next to "Live Render Preview" reads `297mm × 210mm`. All
   placeholder badges show green ("Recognized variables") — none should show amber.
   The rendered preview shows a sample name ("Jordan Sample"), a sample contest,
   score/rank/time pills, and an issued date/cert ID footer, all filled in.
5. Click **Save Template**. It should appear in the table with its detected variables
   listed as badges.
6. Go to a contest's certificate page, pick "Classic Default Test" from the template
   dropdown, and issue one certificate. Once the worker processes it, open the generated
   PDF and confirm it's A4 landscape and matches the preview.

---

## Template 2 — `02-custom-pagesize-with-logo-image.html`

**What it tests:** the page-size fidelity fix, plus image loading — both a
`{{orgLogoUrl}}`-driven image and a hardcoded external image URL.

This template declares `@page { size: letter landscape; margin: 0; }` — **279mm × 216mm**,
deliberately not A4. It also has two images: one sourced from your org's own logo
(`{{orgLogoUrl}}`) and one hardcoded to a public placeholder image URL
(`https://placehold.co/64x64/...`) in the top-right corner — a small gold star badge.

**Steps:**
1. Upload it the same way, name it "Custom Page Size Test".
2. Click **Preview Template**.
3. **Expect:** the preview badge now reads `279mm × 216mm`, **not** `297mm × 210mm` — that
   confirms the template's own declared page size is being honored instead of being
   silently forced into A4 landscape.
4. **Expect:** the gold star badge image (top-right) always loads — it's a public URL, not
   dependent on your org's data.
5. **Expect:** the second logo image loads *only if your organization has a `logoUrl` set*
   in its profile. If it doesn't, you'll see a small broken-image icon there instead —
   that's correct, expected behavior (not a bug): the placeholder substitutes to an empty
   string, so `<img src="">` renders as broken, both in preview and in the final PDF. Set
   an org logo first if you want to see this path fully populated.
5. Save, then issue a real certificate with it and check the generated PDF is genuinely
   279mm × 216mm (Letter landscape), not A4 — open it in any PDF viewer and check the page
   size/properties, or just note it looks visibly less elongated than Template 1's output.

---

## Template 3 — `03-edge-case-typos-and-script-test.html`

**What it tests:** unknown/misspelled placeholder handling, and that `<script>` tags get
stripped before a template is ever stored or rendered — this is the security check.

This file has a `<script>alert(...)</script>` tag in the `<head>`, one correctly-spelled
placeholder group, and two deliberately broken ones: `{{particpantName}}` (typo of
`participantName`) and `{{customAwardTitle}}` (a plausible one-off custom field that isn't
supported in v1 — the product decision was system fields only, no admin-defined custom
fields).

Note: if you just double-click this file to open it directly in a browser (outside the
app), the alert **will** pop up — that's expected, it's a plain webpage at that point and
nothing has sanitized it yet. The actual test is what happens once it goes *through the
app's upload flow*, in step 3 below.

**Steps:**
1. Upload it, name it "Edge Case Test".
2. Click **Preview Template**.
3. **Expect:** no alert popup appears in your browser — if one does, sanitization isn't
   stripping `<script>` tags and that's a real bug to report back.
4. **Expect:** under "Unrecognized placeholders (will render blank)" you should see two
   amber badges: `{{particpantName}}` and `{{customAwardTitle}}`.
5. **Expect:** in the rendered preview, the "known" line shows real sample data in green,
   while the typo/unsupported line shows empty brackets `[ ]` with no literal
   `{{particpantName}}` or `{{customAwardTitle}}` text leaking through.
6. Save it, then re-open it for editing (**Edit** button) — confirm the HTML shown in the
   edit box still has no `<script>` tag in it (proving it was stripped at save time, not
   just hidden by the preview).

---

## What "all working" looks like across all three

- Upload accepts both paste-into-textarea and file-upload paths for all three files.
- Save button stays disabled until you've clicked Preview at least once, for every file.
- Each template's detected-variables list in the main table matches what its preview
  showed.
- Issuing a certificate with any of the three produces a PDF that visually matches its
  preview — including, for Template 2, the non-default page size.
- Deleting a template (trash icon + confirm dialog) removes it from the table and from
  the template picker dropdown on the contest certificates page.
