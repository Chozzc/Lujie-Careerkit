"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { InitialData } from "./types";
import type { TrashKind } from "@/lib/trash";

type Item = { id: string; kind: TrashKind; name: string; section?: string; deletedAt: string };
export function TrashView({ onDataChange }: { onDataChange: (data: InitialData) => void }) {
  const t = useTranslations("trash");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/trash", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(t("failed"));
      setItems((await response.json()).items);
    }).catch((error) => { if (!controller.signal.aborted) setError(String(error.message)); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [t]);

  async function act(action: "restore" | "restoreAll" | "delete" | "empty", item?: Item) {
    if ((action === "delete" || action === "empty") && !window.confirm(t(action === "empty" ? "emptyConfirm" : "deleteConfirm", { name: item?.name ?? "" }))) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/trash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, kind: item?.kind, id: item?.id, confirmed: true }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("failed"));
      setItems(result.items); onDataChange(result.data);
      if (action === "restoreAll" && result.items.length) setError(t("restoreAllRemaining", { count: result.items.length }));
    } catch (error) { setError(error instanceof Error ? error.message : t("failed")); }
    finally { setBusy(false); }
  }

  return <section className="rounded-lg border border-line bg-surface p-5">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || !items.length} onClick={() => void act("restoreAll")}>{t("restoreAll")}</Button>
        <Button variant="destructive" disabled={busy || !items.length} onClick={() => void act("empty")}>{t("empty")}</Button>
      </div>
    </div>
    {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
    {busy && <p role="status">{t("working")}</p>}
    {!busy && !items.length && <p className="py-10 text-center text-muted-foreground">{t("noItems")}</p>}
    <ul className="divide-y divide-line">{items.map((item) => <li key={`${item.kind}:${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div className="min-w-0"><p className="break-words font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{t(`kinds.${item.section ?? item.kind}`)} · {new Date(item.deletedAt).toLocaleString()}</p></div>
      <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => void act("restore", item)}>{t("restore")}</Button><Button variant="ghost" disabled={busy} onClick={() => void act("delete", item)}>{t("delete")}</Button></div>
    </li>)}</ul>
  </section>;
}
