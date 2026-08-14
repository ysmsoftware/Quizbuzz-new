'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { FieldErrorMap } from '../../campaign-schema';

export function BasicsStep({
  name,
  onChange,
  errors = {},
}: {
  name: string;
  onChange: (name: string) => void;
  errors?: FieldErrorMap;
}) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Basics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label>Campaign Name *</Label>
        <Input
          autoFocus
          value={name}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Winter Sprint Referral Drive"
          aria-invalid={!!errors.name}
          className={cn(errors.name && 'border-destructive focus-visible:ring-destructive/20')}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        <p className="text-xs text-muted-foreground">This is what your team will use to identify the campaign — it's not shown to ambassadors.</p>
      </CardContent>
    </Card>
  );
}
