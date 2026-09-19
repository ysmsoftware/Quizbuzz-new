import { get, post, patch, del } from './apiClient';

export type OrgLogoPosition = 'none' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
/** `null` = auto: the template's own `@page` rule, else A4 landscape. */
export type PageSizePreset = 'a4-landscape' | 'a4-portrait' | 'letter-landscape' | 'letter-portrait';

export const ORG_LOGO_POSITION_OPTIONS: { value: OrgLogoPosition; label: string }[] = [
    { value: 'top-left', label: 'Top left' },
    { value: 'top-center', label: 'Top center' },
    { value: 'top-right', label: 'Top right' },
    { value: 'bottom-left', label: 'Bottom left' },
    { value: 'bottom-center', label: 'Bottom center' },
    { value: 'bottom-right', label: 'Bottom right' },
    { value: 'none', label: "None (I'll place {{orgLogoUrl}} myself)" },
];

export const PAGE_SIZE_OPTIONS: { value: PageSizePreset; label: string }[] = [
    { value: 'a4-landscape', label: 'A4 landscape (297 × 210 mm)' },
    { value: 'a4-portrait', label: 'A4 portrait (210 × 297 mm)' },
    { value: 'letter-landscape', label: 'Letter landscape (279 × 216 mm)' },
    { value: 'letter-portrait', label: 'Letter portrait (216 × 279 mm)' },
];

/** Fields the template author controls, shared by create / update / preview requests. */
export interface TemplateLayoutFields {
    orgLogoPosition?: OrgLogoPosition;
    pageSize?: PageSizePreset | null;
}

export interface CertificateTemplateListItem {
    id:          string;
    name:        string;
    description?: string | null;
    variables:   string[];
    orgLogoPosition: OrgLogoPosition;
    pageSize:    PageSizePreset | null;
    createdAt:   string;
    updatedAt:   string;
}

export interface CertificateTemplateDetail extends CertificateTemplateListItem {
    htmlContent: string;
}

export interface TemplatePreviewResult {
    html:                string;
    detectedVariables:   string[];
    unknownPlaceholders: string[];
    /** Physical page size (mm) the final PDF will actually render at — see backend TemplatePreviewResult doc comment. */
    pageWidthMm:  number;
    pageHeightMm: number;
}

export interface TestGenerateResult {
    url: string;
    key: string;
}

export const certificateTemplatesApi = {
    list:   async () => (await get<CertificateTemplateListItem[]>('/certificate-templates')).data,
    getById: async (id: string) => (await get<CertificateTemplateDetail>(`/certificate-templates/${id}`)).data,
    create: async (body: { name: string; description?: string | null; htmlContent: string } & TemplateLayoutFields) =>
        (await post<{ template: CertificateTemplateDetail; unknownPlaceholders: string[] }>('/certificate-templates', body)).data,
    update: async (id: string, body: { name?: string; description?: string | null; htmlContent?: string } & TemplateLayoutFields) =>
        (await patch<{ template: CertificateTemplateDetail; unknownPlaceholders: string[] }>(`/certificate-templates/${id}`, body)).data,
    remove: async (id: string) => (await del<{ message: string }>(`/certificate-templates/${id}`)).data,
    preview: async (body: { templateId?: string; htmlContent?: string } & TemplateLayoutFields) =>
        (await post<TemplatePreviewResult>('/certificate-templates/preview', body)).data,
    /**
     * Runs the template through the real BullMQ queue + certificate.worker.ts + Puppeteer
     * pipeline (not the plain-HTML preview) and returns a genuine downloadable PDF URL.
     * Can take several seconds — it's a real queued job, not a synchronous render.
     */
    testGenerate: async (id: string, body: { participantName?: string; percentage?: number; rank?: number }) =>
        (await post<TestGenerateResult>(`/certificate-templates/${id}/test-generate`, body)).data,
};
