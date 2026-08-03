'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificateTemplatesApi } from '@/lib/api/certificate-templates.api';
import { toast } from 'sonner';

export function useCertificateTemplates() {
    return useQuery({
        queryKey: ['certificate-templates'],
        queryFn: () => certificateTemplatesApi.list(),
    });
}

export function useCertificateTemplate(id: string | null) {
    return useQuery({
        queryKey: ['certificate-template', id],
        queryFn: () => certificateTemplatesApi.getById(id as string),
        enabled: !!id,
    });
}

export function useCreateCertificateTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: { name: string; description?: string | null; htmlContent: string }) => certificateTemplatesApi.create(body),
        onSuccess: () => {
            toast.success('Certificate template saved');
            queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
        },
        onError: (err: any) => toast.error(err.message || 'Failed to save template'),
    });
}

export function useUpdateCertificateTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: { name?: string; description?: string | null; htmlContent?: string } }) =>
            certificateTemplatesApi.update(id, body),
        onSuccess: () => {
            toast.success('Certificate template updated');
            queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
        },
        onError: (err: any) => toast.error(err.message || 'Failed to update template'),
    });
}

export function useDeleteCertificateTemplate() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => certificateTemplatesApi.remove(id),
        onSuccess: () => {
            toast.success('Certificate template deleted');
            queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
        },
        onError: (err: any) => toast.error(err.message || 'Failed to delete template'),
    });
}

export function usePreviewCertificateTemplate() {
    return useMutation({
        mutationFn: (body: { templateId?: string; htmlContent?: string }) => certificateTemplatesApi.preview(body),
        onError: (err: any) => toast.error(err.message || 'Failed to preview template'),
    });
}

/**
 * Runs a saved template through the real generation queue/worker/Puppeteer pipeline
 * (not the plain-HTML preview). No onSuccess/onError toasts here — TestGenerateDialog
 * manages one single loading→success/error toast itself (via toast.loading + the same
 * id), so a second toast from this hook would just duplicate/race with it.
 */
export function useTestGenerateCertificateTemplate() {
    return useMutation({
        mutationFn: ({ id, body }: { id: string; body: { participantName?: string; percentage?: number; rank?: number } }) =>
            certificateTemplatesApi.testGenerate(id, body),
    });
}
