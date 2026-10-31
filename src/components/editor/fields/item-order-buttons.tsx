'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

interface Props<T> {
  label: string;
  items: T[];
  index: number;
  onChange: (items: T[]) => void;
}

export function ItemOrderButtons<T>({ label, items, index, onChange }: Props<T>) {
  const t = useTranslations('editor.fields');
  if (items.length < 2) return null;

  const move = (offset: number) => {
    const target = index + offset;
    if (index < 0 || index >= items.length || target < 0 || target >= items.length) return;
    // ponytail: Adjacent swaps use the existing section update and save path.
    const reordered = items.slice();
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    onChange(reordered);
  };

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-pointer text-zinc-500 dark:text-zinc-400"
        aria-label={t('moveItemUp', { label, index: index + 1 })}
        title={t('moveItemUp', { label, index: index + 1 })}
        disabled={index === 0}
        onClick={() => move(-1)}
      >
        <ArrowUp aria-hidden className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-pointer text-zinc-500 dark:text-zinc-400"
        aria-label={t('moveItemDown', { label, index: index + 1 })}
        title={t('moveItemDown', { label, index: index + 1 })}
        disabled={index === items.length - 1}
        onClick={() => move(1)}
      >
        <ArrowDown aria-hidden className="size-3.5" />
      </Button>
    </span>
  );
}
