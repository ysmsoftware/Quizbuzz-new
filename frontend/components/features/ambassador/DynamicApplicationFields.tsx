'use client';

import { z } from 'zod';
import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ApplicationFieldDef } from '@/lib/types/ambassador';

const INPUT_TYPE: Record<ApplicationFieldDef['type'], string> = {
  TEXT: 'text',
  EMAIL: 'email',
  PHONE: 'tel',
  NUMBER: 'number',
  SELECT: 'text', // unused — SELECT renders <Select>, not <Input>
  DATE: 'date',
};

/** Builds a runtime Zod object schema for a type's applicationFields — one key per field. */
export function buildZodSchemaFor(fields: ApplicationFieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    let schema: z.ZodTypeAny =
      field.type === 'SELECT' && field.options?.length
        ? z.enum(field.options as [string, ...string[]])
        : field.type === 'EMAIL'
          ? z.string().email('Enter a valid email')
          : z.string();

    if (!field.required) {
      schema = schema.optional().or(z.literal(''));
    } else if (field.type !== 'SELECT') {
      schema = (schema as z.ZodString).min(1, `${field.label} is required`);
    }

    shape[field.key] = schema;
  }
  return z.object(shape);
}

interface DynamicApplicationFieldsProps {
  fields: ApplicationFieldDef[];
  register: UseFormRegister<any>;
  control: Control<any>;
  errors: FieldErrors<any>;
}

export function DynamicApplicationFields({ fields, register, control, errors }: DynamicApplicationFieldsProps) {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.key} className="space-y-2">
          <Label htmlFor={field.key}>
            {field.label}
            {field.required && <span className="text-destructive"> *</span>}
          </Label>

          {field.type === 'SELECT' ? (
            <Controller
              name={field.key}
              control={control}
              render={({ field: controllerField }) => (
                <Select value={controllerField.value} onValueChange={controllerField.onChange}>
                  <SelectTrigger id={field.key} className="w-full">
                    <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : (
            <Input id={field.key} type={INPUT_TYPE[field.type]} {...register(field.key)} />
          )}

          {errors[field.key] && (
            <p className="text-sm text-destructive">{String(errors[field.key]?.message)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
