'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EditableFieldProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'date' | 'time';
  disabled?: boolean;
  lockReason?: string;
  autoSave?: boolean;
  className?: string;
  multiline?: boolean;
}

export function EditableField({
  value,
  onSave,
  label,
  type = 'text',
  disabled = false,
  lockReason,
  autoSave = false,
  className,
  multiline = false,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type !== 'date' && type !== 'time') {
        // @ts-ignore
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleSave = useCallback(async () => {
    if (currentValue === value) {
      setIsEditing(false);
      return;
    }

    setStatus('saving');
    try {
      await onSave(currentValue);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2000);
      setIsEditing(false);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'Failed to save');
    }
  }, [currentValue, value, onSave]);

  const handleCancel = useCallback(() => {
    setCurrentValue(value);
    setIsEditing(false);
    setStatus('idle');
    setErrorMessage(null);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !multiline) {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleBlur = () => {
    if (autoSave && isEditing) {
      handleSave();
    }
  };

  if (disabled) {
    return (
      <div className={cn("group flex flex-col gap-1.5", className)}>
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 py-1 px-2 rounded-md border border-transparent bg-muted/30 cursor-not-allowed">
                <span className="text-sm font-medium text-muted-foreground line-clamp-1">{value || '—'}</span>
              </div>
            </TooltipTrigger>
            {lockReason && <TooltipContent>{lockReason}</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className={cn("group flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
        {status === 'saving' && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
        {status === 'success' && <Check className="h-3 w-3 text-green-500" />}
        {status === 'error' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="h-3 w-3 text-destructive cursor-help" />
              </TooltipTrigger>
              <TooltipContent>{errorMessage}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="relative"
          >
            {multiline ? (
              <Textarea
                ref={inputRef as any}
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="min-h-[100px] resize-none"
              />
            ) : (
              <Input
                ref={inputRef as any}
                type={type}
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="h-9"
              />
            )}
            {!autoSave && (
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancel}>
                  <X className="h-3 w-3" />
                </Button>
                <Button size="icon" variant="default" className="h-6 w-6" onClick={handleSave} disabled={status === 'saving'}>
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="viewing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="group/field relative flex items-center gap-2 py-1 px-2 rounded-md border border-transparent hover:border-border hover:bg-muted/50 cursor-pointer transition-all"
            onClick={() => setIsEditing(true)}
          >
            <span className={cn(
              "text-sm font-medium transition-colors",
              !value && "text-muted-foreground italic"
            )}>
              {value || `No ${label.toLowerCase()} set`}
            </span>
            <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/field:opacity-100 transition-opacity" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { AlertCircle } from 'lucide-react';
