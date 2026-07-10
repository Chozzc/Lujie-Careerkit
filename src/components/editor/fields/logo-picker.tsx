'use client';

import { useId, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { LogoMark, logoIconPresets } from '@/components/shared/logo-mark';
import { Button } from '@/components/ui/button';

const MAX_LOGO_SIZE = 4 * 1024 * 1024;
const MAX_LOGO_EDGE = 128;
const LOGO_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

interface LogoPickerProps {
  label: string;
  value?: string;
  onChange: (value?: string) => void;
}

export function LogoPicker({ label, value, onChange }: LogoPickerProps) {
  const t = useTranslations('editor.fields');
  const inputId = useId();
  const iconPickerId = `${inputId}-icons`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const hasUploadedLogo = Boolean(value && !value.startsWith('icon:'));
  const hasSelectedIcon = Boolean(value?.startsWith('icon:'));

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError('');
    if (!LOGO_TYPES.has(file.type) || file.size > MAX_LOGO_SIZE) {
      setError(t('logoUploadFailed'));
      return;
    }
    try {
      onChange(await resizeLogo(file));
    } catch {
      setError(t('logoUploadFailed'));
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="text-xs font-medium text-zinc-500">
          {label}
        </label>
        {error && <span className="text-xs text-red-500" role="status">{error}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          {hasUploadedLogo && (
            <LogoMark
              value={value}
              alt=""
              className="inline-flex size-8 shrink-0 items-center justify-center object-contain text-zinc-500"
            />
          )}
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 cursor-pointer justify-start gap-1"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            <span className="truncate">{hasUploadedLogo ? t('replaceLogo') : t('uploadLogo')}</span>
          </Button>
          {hasUploadedLogo && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="cursor-pointer text-zinc-400 hover:text-red-500"
              aria-label={t('removeLogo')}
              title={t('removeLogo')}
              onClick={() => onChange(undefined)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="relative min-w-0 flex-1 cursor-pointer justify-start gap-1"
            aria-expanded={isIconPickerOpen}
            aria-controls={iconPickerId}
            onClick={() => setIsIconPickerOpen((open) => !open)}
          >
            <span className="flex min-w-0 items-center justify-start gap-1.5">
              {hasSelectedIcon ? <LogoMark value={value} alt="" iconClassName="h-3.5 w-3.5" /> : null}
              <span className="truncate">{hasSelectedIcon ? t('changeIcon') : t('chooseIcon')}</span>
            </span>
            {isIconPickerOpen ? <ChevronUp className="absolute right-2 h-3.5 w-3.5" /> : <ChevronDown className="absolute right-2 h-3.5 w-3.5" />}
          </Button>
          {hasSelectedIcon && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="cursor-pointer text-zinc-400 hover:text-red-500"
              aria-label={t('removeLogo')}
              title={t('removeLogo')}
              onClick={() => onChange(undefined)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {isIconPickerOpen && (
          <div id={iconPickerId} className="col-span-2 grid grid-cols-8 gap-1.5" aria-label={t('commonIcons')}>
            {logoIconPresets.map((preset) => {
              const selected = value === `icon:${preset.id}`;
              const presetLabel = t(`iconNames.${preset.id}`);
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`grid h-7 w-7 place-items-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                    selected
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                  title={presetLabel}
                  aria-label={presetLabel}
                  aria-pressed={selected}
                  onClick={() => {
                    onChange(`icon:${preset.id}`);
                    setIsIconPickerOpen(false);
                  }}
                >
                  <preset.Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function resizeLogo(file: File) {
  return new Promise<string>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, MAX_LOGO_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas is unavailable'));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Invalid logo image'));
    };

    image.src = url;
  });
}
