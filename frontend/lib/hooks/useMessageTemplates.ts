import { useQuery } from '@tanstack/react-query';
import { messageService } from '@/lib/services/message-service';
import type { MessageTemplate } from '@/lib/types';

export function useMessageTemplates(orgId: string) {
    const templatesQuery = useQuery({
        queryKey: ['message-templates', orgId],
        queryFn: () => messageService.getTemplates(orgId),
        enabled: !!orgId,
    });

    const templates = templatesQuery.data ?? [];

    return {
        templates,
        systemTemplates: templates,
        customTemplates: [] as MessageTemplate[],
        createTemplate: async (template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
            throw new Error('Templates are managed by the backend.');
        },
        updateTemplate: async (id: string, data: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>) => {
            throw new Error('Templates are managed by the backend.');
        },
        deleteTemplate: async (id: string) => {
            throw new Error('Templates are managed by the backend.');
        },
        loading: templatesQuery.isLoading,
    };
}
