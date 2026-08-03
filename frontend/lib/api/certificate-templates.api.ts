import { get, post, patch, del } from './apiClient';

export interface CertificateTemplateListItem {
    id:          string;
    name:        string;
    description?: string | null;
    variables:   string[];
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
    create: async (body: { name: string; description?: string | null; htmlContent: string }) =>
        (await post<{ template: CertificateTemplateDetail; unknownPlaceholders: string[] }>('/certificate-templates', body)).data,
    update: async (id: string, body: { name?: string; description?: string | null; htmlContent?: string }) =>
        (await patch<{ template: CertificateTemplateDetail; unknownPlaceholders: string[] }>(`/certificate-templates/${id}`, body)).data,
    remove: async (id: string) => (await del<{ message: string }>(`/certificate-templates/${id}`)).data,
    preview: async (body: { templateId?: string; htmlContent?: string }) =>
        (await post<TemplatePreviewResult>('/certificate-templates/preview', body)).data,
    /**
     * Runs the template through the real BullMQ queue + certificate.worker.ts + Puppeteer
     * pipeline (not the plain-HTML preview) and returns a genuine downloadable PDF URL.
     * Can take several seconds — it's a real queued job, not a synchronous render.
     */
    testGenerate: async (id: string, body: { participantName?: string; percentage?: number; rank?: number }) =>
        (await post<TestGenerateResult>(`/certificate-templates/${id}/test-generate`, body)).data,
};
