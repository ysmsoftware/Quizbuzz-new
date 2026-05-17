import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  presets?: string[];
  onApply?: (color: string) => void;
}

const DEFAULT_PRESETS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
];

export function ColorPicker({
  label,
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  onApply,
}: ColorPickerProps) {
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
  };

  const handlePresetClick = (color: string) => {
    onChange(color);
    onApply?.(color);
  };

  const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);

  return (
    <div className="space-y-3">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}

      {/* Color Input */}
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-lg border-2 border-muted"
          style={{ backgroundColor: isValidHex ? value : '#cccccc' }}
        />
        <Input
          type="text"
          value={value}
          onChange={handleColorChange}
          placeholder="#000000"
          className="font-mono text-sm"
        />
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Presets</p>
        <div className="flex gap-2 flex-wrap">
          {presets.map((color) => (
            <button
              key={color}
              onClick={() => handlePresetClick(color)}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${
                value === color
                  ? 'border-foreground scale-110'
                  : 'border-muted hover:border-muted-foreground'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      {isValidHex && (
        <div className="pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-2">Live Preview</p>
          <div className="space-y-2">
            <div
              className="h-8 rounded"
              style={{ backgroundColor: value }}
            />
            <div className="flex gap-2 text-xs">
              <span style={{ color: value }}>Sample Text</span>
              <span
                className="px-2 py-1 rounded text-white"
                style={{ backgroundColor: value }}
              >
                Button
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
