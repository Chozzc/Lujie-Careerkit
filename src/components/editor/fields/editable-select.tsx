'use client';

import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface EditableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}

export function EditableSelect({ label, value, onChange, options, placeholder }: EditableSelectProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      <div className="relative">
        <Select value={value || ''} onValueChange={(nextValue) => onChange(nextValue ?? '')}>
          <SelectTrigger size="sm" className="w-full text-sm">
            <SelectValue placeholder={placeholder || label} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
            aria-label={`清空${label}`}
            title={`清空${label}`}
            className="absolute top-1/2 right-7 -translate-y-1/2 rounded p-0.5 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
