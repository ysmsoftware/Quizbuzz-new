import React from 'react';
import { MessageTemplate } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Mail, Lock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface TemplateCardProps {
  template: MessageTemplate;
  selected?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function TemplateCard({
  template,
  selected = false,
  onSelect,
  onEdit,
  onDelete,
}: TemplateCardProps) {
  const getChannelIcon = () => {
    switch (template.channel) {
      case 'whatsapp':
        return <MessageCircle className="h-4 w-4" />;
      case 'email':
        return <Mail className="h-4 w-4" />;
      case 'both':
        return (
          <div className="flex gap-1">
            <MessageCircle className="h-4 w-4" />
            <Mail className="h-4 w-4" />
          </div>
        );
    }
  };

  const channelLabel = {
    whatsapp: 'WhatsApp',
    email: 'Email',
    both: 'Both',
  }[template.channel];

  return (
    <Card
      onClick={onSelect}
      className={cn(
        'p-4 cursor-pointer transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary bg-primary/5'
      )}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{template.name}</h3>
            {template.isSystem && (
              <div className="flex items-center gap-1 mt-1">
                <Lock className="h-3 w-3" />
                <Badge variant="secondary" className="text-xs">
                  System Template
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <p className="text-sm text-muted-foreground line-clamp-2">
          {template.body}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {getChannelIcon()}
            <span>{channelLabel}</span>
          </div>

          {template.variables.length > 0 && (
            <span className="text-xs bg-muted px-2 py-1 rounded">
              {template.variables.length} variable{template.variables.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Actions */}
        {!template.isSystem && (onEdit || onDelete) && (
          <div className="flex gap-2 pt-2">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="flex-1 text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex-1 text-xs px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
