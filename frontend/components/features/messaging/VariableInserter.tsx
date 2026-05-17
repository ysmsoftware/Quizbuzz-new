import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface VariableInserterProps {
  variables: string[];
  onInsertVariable: (variable: string) => void;
}

export function VariableInserter({ variables, onInsertVariable }: VariableInserterProps) {
  if (variables.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">
        Available Variables
      </label>
      <div className="flex flex-wrap gap-2">
        {variables.map((variable) => (
          <Badge
            key={variable}
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80 transition-colors"
            onClick={() => onInsertVariable(variable)}
          >
            <Plus className="h-3 w-3 mr-1" />
            {`{{${variable}}}`}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Click to insert variable in the message body
      </p>
    </div>
  );
}
