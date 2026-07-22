'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface EditableListProps {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}

export function EditableList({ label, items, onChange, placeholder }: EditableListProps) {
  const addItem = () => onChange([...(items || []), '']);

  const updateItem = (index: number, value: string) => {
    const updated = [...(items || [])];
    updated[index] = value;
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange((items || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      <div className="space-y-1.5">
        {(items || []).map((item, index) => (
          <div key={index} className="flex items-start gap-1">
            <Textarea
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
              rows={1}
              className="max-h-40 min-h-8 resize-none overflow-y-auto py-1.5 text-sm leading-5"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 shrink-0 cursor-pointer p-0 text-zinc-400 hover:text-red-500"
              aria-label={`删除${label}第${index + 1}项`}
              title={`删除${label}第${index + 1}项`}
              onClick={() => removeItem(index)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={addItem}
          className="h-7 cursor-pointer gap-1 text-xs"
        >
          <Plus className="h-3 w-3" />
          添加{label}
        </Button>
      </div>
    </div>
  );
}
