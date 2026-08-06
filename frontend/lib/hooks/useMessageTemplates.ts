import { useQuery } from '@tanstack/react-query';
import { messageService } from '@/lib/services/message-service';
import type { MessageTemplate } from '@/lib/types';

/**
 * Message templates are global to the authenticated organisation.
 *
 * This previously took an `orgId` that every call site passed as the literal
 * `'org-1'`. That value never reached the server — `messageService.getTemplates()`
 * ignores its argument and calls `crmApi.getMessageTemplates()` with no parameters,
 * and the backend scopes results from the auth token. Its only real effect was to
 * make the react-query cache key a shared constant across organisations. Removed
 * rather than threaded through, since there is nothing for the caller to supply.
 */
export function useMessageTemplates() {
    const templatesQuery = useQuery({
        queryKey: ['message-templates'],
        queryFn: () => messageService.getTemplates(),
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
