import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface MaskedInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
}

export function MaskedInput({
  label,
  value,
  onChange,
  placeholder,
  error,
  helperText,
}: MaskedInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  const displayValue = isVisible ? value : '*'.repeat(Math.max(value.length, 4));

  return (
    <div className="space-y-2">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      
      <div className="flex items-center gap-2">
        <Input
          type={isVisible ? 'text' : 'password'}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={!isVisible}
          className={error ? 'border-destructive' : ''}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
          className="px-3"
        >
          {isVisible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}
