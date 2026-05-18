import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageService } from '@/lib/services/message-service';
import type { MessageTemplate } from '@/lib/types';

export function useMessageTemplates(orgId: string) {
    const queryClient = useQueryClient();

    const templatesQuery = useQuery({
        queryKey: ['message-templates', orgId],
        queryFn: () => messageService.getTemplates(orgId),
        enabled: !!orgId,
    });

    const createMutation = useMutation({
        mutationFn: (template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>) =>
            messageService.createTemplate(template),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['message-templates', orgId] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<MessageTemplate> }) =>
            messageService.updateTemplate(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['message-templates', orgId] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => messageService.deleteTemplate(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['message-templates', orgId] });
        },
    });

    const templates = templatesQuery.data?.data ?? [];

    return {
        templates,
        systemTemplates: templates.filter((template: MessageTemplate) => template.isSystem),
        customTemplates: templates.filter((template: MessageTemplate) => !template.isSystem),
        createTemplate: createMutation.mutateAsync,
        updateTemplate: async (id: string, data: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>) =>
            updateMutation.mutateAsync({ id, data }),
        deleteTemplate: deleteMutation.mutateAsync,
        loading:
            templatesQuery.isLoading ||
            createMutation.isLoading ||
            updateMutation.isLoading ||
            deleteMutation.isLoading,
    };
}
