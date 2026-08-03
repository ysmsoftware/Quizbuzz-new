export interface CreateCertificateTemplateInput {
    organizationId: string;
    name:           string;
    description?:   string | null;
    htmlContent:    string;
    variables:      string[];
}

export interface UpdateCertificateTemplateInput {
    name?:        string;
    description?: string | null;
    htmlContent?: string;
    variables?:   string[];
}

export interface CertificateTemplateResult {
    id:             string;
    organizationId: string;
    name:           string;
    description:    string | null;
    htmlContent:    string;
    variables:      string[];
    createdAt:      Date;
    updatedAt:      Date;
}

/** List view omits htmlContent — keeps the list payload small; full content is fetched via getById when editing. */
export interface CertificateTemplateListItem {
    id:          string;
    name:        string;
    description: string | null;
    variables:   string[];
    createdAt:   Date;
    updatedAt:   Date;
}

export interface TemplatePreviewResult {
    html:                string;
    detectedVariables:   string[];
    unknownPlaceholders: string[];
    /**
     * Physical page size (mm) the PDF will actually render at — derived from the
     * template's own `@page { size: ... }` CSS rule if present (matches how
     * certificate.worker.ts's preferCSSPageSize honors it), else the A4 landscape
     * default every template falls back to. Lets the preview canvas match the
     * real print output instead of always assuming A4 landscape.
     */
    pageWidthMm:  number;
    pageHeightMm: number;
}

/** Optional overrides for the "Test Generate PDF" sample data — everything else stays fixed dummy data. */
export interface TestGenerateInput {
    participantName?: string | undefined;
    percentage?:      number | undefined;
    rank?:            number | undefined;
}

export interface TestGenerateResult {
    url: string;
    key: string;
}
