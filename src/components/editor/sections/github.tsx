'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, X, RefreshCw, Star, Code2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EditableText } from '../fields/editable-text';
import { EditableRichText } from '../fields/editable-rich-text';
import { generateId } from '@/lib/utils';
import type { ResumeSection, GitHubContent, GitHubRepoItem } from '@/types/resume';

const GITHUB_REPO_RE = /github\.com\/[^/]+\/[^/]+/;

interface Props {
  section: ResumeSection;
  onUpdate: (content: Partial<GitHubContent>) => void;
}

export function GitHubSection({ section, onUpdate }: Props) {
  const t = useTranslations('editor.fields');
  const content = section.content as GitHubContent;
  const items = content.items || [];
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [repoErrors, setRepoErrors] = useState<Record<string, string>>({});
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Keep a ref to always access the latest items, avoiding stale closures in setTimeout
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const addItem = () => {
    const newItem: GitHubRepoItem = {
      id: generateId(),
      repoUrl: '',
      name: '',
      stars: 0,
      language: '',
      description: '',
    };
    onUpdate({ items: [...items, newItem] } as any);
  };

  const updateItem = (index: number, data: Partial<GitHubRepoItem>) => {
    const latest = itemsRef.current;
    const updated = latest.map((item, i) => (i === index ? { ...item, ...data } : item));
    onUpdate({ items: updated } as any);
  };

  const removeItem = (index: number) => {
    const item = items[index];
    const timer = debounceTimers.current.get(item.id);
    if (timer) clearTimeout(timer);
    debounceTimers.current.delete(item.id);
    setRepoErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
    onUpdate({ items: items.filter((_, i) => i !== index) } as any);
  };

  const setRepoError = (itemId: string, message: string) => {
    setRepoErrors((current) => {
      const next = { ...current };
      if (message) {
        next[itemId] = message;
      } else {
        delete next[itemId];
      }
      return next;
    });
  };

  const fetchRepo = async (index: number, url: string) => {
    const latest = itemsRef.current;
    const item = latest[index];
    if (!item) return;
    if (!GITHUB_REPO_RE.test(url)) {
      setRepoError(item.id, '请填写有效的 GitHub 仓库链接，例如 https://github.com/vercel/next.js。');
      return;
    }

    setLoadingIds((prev) => new Set(prev).add(item.id));
    setRepoError(item.id, '');
    try {
      const res = await fetch(`/api/github/repo?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message ?? 'GitHub 仓库信息读取失败。');
      }
      updateItem(index, {
        name: data.name,
        stars: data.stars,
        language: data.language,
        description: data.description,
      });
    } catch (error) {
      setRepoError(item.id, error instanceof Error ? error.message : 'GitHub 仓库信息读取失败。');
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleUrlChange = (index: number, value: string) => {
    const item = items[index];
    updateItem(index, { repoUrl: value });
    setRepoError(item.id, '');

    const prev = debounceTimers.current.get(item.id);
    if (prev) clearTimeout(prev);

    if (GITHUB_REPO_RE.test(value)) {
      const timer = setTimeout(() => {
        debounceTimers.current.delete(item.id);
        fetchRepo(index, value);
      }, 600);
      debounceTimers.current.set(item.id, timer);
    }
  };

  // Auto-refresh stars for all repos on mount
  const didAutoRefresh = useRef(false);
  useEffect(() => {
    if (didAutoRefresh.current) return;
    didAutoRefresh.current = true;
    const current = itemsRef.current;
    current.forEach((item, index) => {
      if (item.repoUrl && GITHUB_REPO_RE.test(item.repoUrl)) {
        fetchRepo(index, item.repoUrl);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {items.map((item, index) => (
        <div key={item.id || `gh-${index}`}>
          {index > 0 && <Separator className="mb-4" />}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400">#{index + 1}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer p-1 text-zinc-400 hover:text-red-500"
                aria-label={`删除 GitHub 项目第${index + 1}项`}
                title={`删除 GitHub 项目第${index + 1}项`}
                onClick={() => removeItem(index)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="relative">
              <EditableText
                label={t('repoUrl')}
                value={item.repoUrl}
                onChange={(v) => handleUrlChange(index, v)}
              />
              {loadingIds.has(item.id) && (
                <Loader2 className="absolute right-2 top-7 h-4 w-4 animate-spin text-zinc-400" />
              )}
            </div>
            {repoErrors[item.id] && (
              <p className="rounded-md bg-red-50 px-2 py-1.5 text-xs leading-5 text-red-700">
                {repoErrors[item.id]}
              </p>
            )}
            {item.name && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.name}</span>
                {item.stars > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="h-3 w-3 text-amber-500" />
                    {item.stars.toLocaleString()}
                  </span>
                )}
                {item.language && (
                  <span className="inline-flex items-center gap-0.5">
                    <Code2 className="h-3 w-3" />
                    {item.language}
                  </span>
                )}
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  aria-label={`刷新${item.name}仓库信息`}
                  title={`刷新${item.name}仓库信息`}
                  onClick={() => fetchRepo(index, item.repoUrl)}
                  disabled={loadingIds.has(item.id)}
                >
                  <RefreshCw className={`h-3 w-3 ${loadingIds.has(item.id) ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
            <EditableRichText label={t('description')} value={item.description} onChange={(v) => updateItem(index, { description: v })} />
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addItem} className="w-full cursor-pointer gap-1">
        <Plus className="h-3.5 w-3.5" />
        {t('addItem')}
      </Button>
    </div>
  );
}
