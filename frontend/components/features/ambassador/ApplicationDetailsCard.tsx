'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DynamicApplicationFields, buildZodSchemaFor } from './DynamicApplicationFields';
import type { ApplicationFieldDef } from '@/lib/types/ambassador';

interface ApplicationDetailsCardProps {
  /** This ambassador's type's current field definitions — fetched fresh from the platform
   *  catalog (not cached from signup time), since an org can add/rename/remove fields for a
   *  type after someone has already signed up. Whatever this list says today is what renders. */
  applicationFields: ApplicationFieldDef[];
  applicationData: Record<string, string>;
  onSave: (data: Record<string, string>) => Promise<unknown>;
}

/** The signup-time answers (college, department, year of study, ...) — entirely driven by
 *  the ambassador's type definition, so a Student vs. Faculty ambassador (or any future
 *  type) sees exactly its own fields, not a hardcoded set. Read-only by default; "Edit"
 *  swaps in the same field renderer the signup form uses. */
export function ApplicationDetailsCard({ applicationFields, applicationData, onSave }: ApplicationDetailsCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm({
    resolver: zodResolver(buildZodSchemaFor(applicationFields)),
    defaultValues: applicationData,
  });

  if (applicationFields.length === 0) return null;

  const onSubmit = form.handleSubmit(async (values) => {
    setIsSaving(true);
    try {
      await onSave(values as Record<string, string>);
      toast.success('Application details updated');
      setIsEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update details');
    } finally {
      setIsSaving(false);
    }
  });

  const cancelEdit = () => {
    form.reset(applicationData);
    setIsEditing(false);
  };

  return (
    <Card className="border-border/50">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Signup details</p>
            <h2 className="text-base font-bold text-foreground mt-0.5">Application information</h2>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline p-2 -m-2"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <DynamicApplicationFields
              fields={applicationFields}
              register={form.register}
              control={form.control}
              errors={form.formState.errors}
            />
            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" size="sm" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save changes'}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} disabled={isSaving}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="divide-y divide-border">
            {applicationFields.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-3 py-2.5">
                <span className="text-[12.5px] text-muted-foreground">{field.label}</span>
                <span className="text-[13px] font-semibold text-foreground text-right">{applicationData[field.key] || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
