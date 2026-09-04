'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Controller, useWatch, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { referenceDataService, type CollegeOption } from '@/lib/services/reference-data-service';
import type { ApplicationFieldDef } from '@/lib/types/ambassador';

const INPUT_TYPE: Record<ApplicationFieldDef['type'], string> = {
  TEXT: 'text',
  EMAIL: 'email',
  PHONE: 'tel',
  NUMBER: 'number',
  SELECT: 'text', // unused — SELECT renders <Select>, not <Input>
  DATE: 'date',
};

// Sentinel Select value meaning "not in the catalog" — reveals a free-text fallback input.
const OTHER_VALUE = '__OTHER__';

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

// College/Department SELECT fields (see field.optionsSource) fetch their options live from the
// catalog instead of reading the static field.options list, with an "Other" fallback identical
// in spirit to RegisterClient's — but the submitted value stays a plain name string either way,
// matching the existing applicationData[key] contract (no id is ever stored here).
function LiveSelectField({
  field,
  control,
}: {
  field: ApplicationFieldDef;
  control: Control<any>;
}) {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [isOther, setIsOther] = useState(false);
  const dependsOnValue = useWatch({ control, name: field.dependsOnKey || field.key });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (field.optionsSource === 'colleges') {
        const colleges = await referenceDataService.getColleges();
        if (!cancelled) setOptions(colleges.map((c) => ({ value: c.name, label: c.name })));
        return;
      }
      if (field.optionsSource === 'departments') {
        const collegeName = field.dependsOnKey ? (dependsOnValue as string | undefined) : undefined;
        if (!collegeName) {
          if (!cancelled) setOptions([]);
          return;
        }
        const colleges: CollegeOption[] = await referenceDataService.getColleges();
        const college = colleges.find((c) => c.name.toLowerCase() === collegeName.toLowerCase());
        if (!college) {
          if (!cancelled) setOptions([]);
          return;
        }
        const departments = await referenceDataService.getDepartments(college.id);
        if (!cancelled) setOptions(departments.map((d) => ({ value: d.name, label: d.name })));
      }
    }

    load().catch(() => {
      if (!cancelled) setOptions([]);
    });
    return () => {
      cancelled = true;
    };
  }, [field.optionsSource, field.dependsOnKey, dependsOnValue]);

  return (
    <Controller
      name={field.key}
      control={control}
      render={({ field: controllerField }) =>
        isOther ? (
          <Input
            id={field.key}
            value={controllerField.value ?? ''}
            onChange={controllerField.onChange}
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        ) : (
          <Select
            value={controllerField.value}
            onValueChange={(value) => {
              if (value === OTHER_VALUE) {
                setIsOther(true);
                controllerField.onChange('');
              } else {
                controllerField.onChange(value);
              }
            }}
          >
            <SelectTrigger id={field.key} className="w-full">
              <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
              <SelectItem value={OTHER_VALUE}>Other (not listed)</SelectItem>
            </SelectContent>
          </Select>
        )
      }
    />
  );
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

          {field.type === 'SELECT' && field.optionsSource ? (
            <LiveSelectField field={field} control={control} />
          ) : field.type === 'SELECT' ? (
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
