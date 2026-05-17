'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { MessageTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useMessageTemplates } from '@/lib/hooks/useMessageTemplates';
import { TemplateBuilder } from '@/components/features/messaging/TemplateBuilder';
import { TemplateCard } from '@/components/features/messaging/TemplateCard';

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [templateBuilderOpen, setTemplateBuilderOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);

  const {
    templates,
    systemTemplates,
    customTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    loading,
  } = useMessageTemplates('org-1');

  const filteredSystemTemplates = systemTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomTemplates = customTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateTemplate = async (
    template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      await createTemplate(template);
      toast.success('Template created successfully');
      setTemplateBuilderOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      toast.error('Failed to create template');
    }
  };

  const handleUpdateTemplate = async (
    template: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!selectedTemplate) return;

    try {
      await updateTemplate(selectedTemplate.id, template);
      toast.success('Template updated successfully');
      setTemplateBuilderOpen(false);
      setSelectedTemplate(null);
    } catch (err) {
      toast.error('Failed to update template');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const success = await deleteTemplate(id);
      if (success) {
        toast.success('Template deleted successfully');
      } else {
        toast.error('Cannot delete system templates');
      }
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const handleEditTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setTemplateBuilderOpen(true);
  };

  const handleOpenNew = () => {
    setSelectedTemplate(null);
    setTemplateBuilderOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Message Templates</h1>
          <p className="text-muted-foreground mt-2">
            Manage organization-wide message templates
          </p>
        </div>
        <Button onClick={handleOpenNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Templates</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Search by template name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* System Templates */}
      {filteredSystemTemplates.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">System Templates</h2>
            <p className="text-sm text-muted-foreground">
              Default templates that are automatically triggered for specific events
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredSystemTemplates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom Templates */}
      {filteredCustomTemplates.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold">Custom Templates</h2>
            <p className="text-sm text-muted-foreground">
              Templates created by your organization
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCustomTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={() => handleEditTemplate(template)}
                onDelete={() => handleDeleteTemplate(template.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {templates.length === 0 && !loading && (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p className="mb-4">No templates found</p>
            <Button onClick={handleOpenNew}>Create Your First Template</Button>
          </CardContent>
        </Card>
      )}

      {/* No Search Results */}
      {templates.length > 0 &&
        filteredSystemTemplates.length === 0 &&
        filteredCustomTemplates.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p>No templates matching "{searchQuery}"</p>
            </CardContent>
          </Card>
        )}

      {/* Template Builder Modal */}
      <TemplateBuilder
        open={templateBuilderOpen}
        onOpenChange={setTemplateBuilderOpen}
        onSave={selectedTemplate ? handleUpdateTemplate : handleCreateTemplate}
        initialTemplate={selectedTemplate || undefined}
      />
    </div>
  );
}
