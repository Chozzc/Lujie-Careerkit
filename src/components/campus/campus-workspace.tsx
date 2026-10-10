"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowUpDown, ArrowUpRight, Building2, ChevronDown, ChevronLeft, ChevronRight, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogPortal, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { campusDeadline, campusQuerySchema, type CampusQuery, type CampusRecord, type CampusResult } from "@/lib/campus";
import { cn } from "@/lib/utils";

const emptyFilters = { q: "", recruitmentType: "", target: "", location: "", companyType: "", industry: "", exam: "", deadline: "" as CampusQuery["deadline"] };
type FilterKey = keyof typeof emptyFilters;
type OptionKey = keyof CampusResult["facets"] | "deadline";
const filterGroups = ["recruitmentType", "target", "companyType", "industry", "exam", "deadline"] as const;
const popularCities = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "南京", "苏州", "西安", "重庆", "天津", "长沙", "合肥", "香港"];
const sortOptions = ["updated_desc", "updated_asc", "deadline_asc", "deadline_desc", "company_asc"] as const;

function FilterChoices({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  const t = useTranslations("app.campus");
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {[{ value: "", label: t("any") }, ...options].map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={cn("rounded-md px-2.5 py-1.5 text-left text-sm leading-5 outline-none transition hover:bg-surface-mid focus-visible:ring-2 focus-visible:ring-ring", value === option.value ? "bg-brand-muted font-medium text-brand" : "bg-surface-low text-foreground/80")}>{option.label}</button>)}
      </div>
    </fieldset>
  );
}

function Deadline({ record, today }: { record: CampusRecord; today: string }) {
  const t = useTranslations("app.campus");
  const status = campusDeadline(record, today);
  return (
    <div className="text-xs leading-5">
      <p className={cn("tabular-nums", status === "expired" ? "text-muted-foreground" : "text-foreground")}>{record.deadlineDate ?? t(`deadline.${status}`)}</p>
      {status === "expired" ? <p className="text-muted-foreground">{t("deadline.expired")}</p> : null}
      {status === "dated" ? <p className="text-muted-foreground">{t("deadline.byDate")}</p> : null}
    </div>
  );
}

export function CampusWorkspace() {
  return <Suspense><CampusRoute /></Suspense>;
}

function CampusRoute() {
  const searchParams = useSearchParams();
  const query = campusQuerySchema.safeParse(Object.fromEntries(searchParams));
  return <CampusCatalog key={searchParams.toString()} initialQuery={query.success ? query.data : campusQuerySchema.parse({})} />;
}

function CampusCatalog({ initialQuery }: { initialQuery: CampusQuery }) {
  const t = useTranslations("app.campus");
  const [filters, setFilters] = useState(initialQuery);
  const [response, setResponse] = useState<{ key: string; data: CampusResult } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [selection, setSelected] = useState<CampusRecord | null>();
  const queryString = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)])).toString();
  const requestKey = `${queryString}:${retry}`;
  const failed = failure === requestKey;
  const loading = response?.key !== requestKey && !failed;
  const data = response?.data;
  const selected = selection === undefined ? data?.selectedRecord ?? null : selection;

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await fetch(`/api/campus?${queryString}`, { signal: controller.signal, cache: "no-store" });
        if (!result.ok) throw new Error("Campus request failed");
        const next: CampusResult = await result.json();
        if (!controller.signal.aborted) {
          setResponse({ key: requestKey, data: next });
          setFailure(null);
        }
      } catch {
        if (!controller.signal.aborted) setFailure(requestKey);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [queryString, requestKey]);

  const changeFilter = (key: FilterKey, value: string) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  const activeFilters = (Object.keys(emptyFilters) as FilterKey[]).filter((key) => filters[key]);
  const clearFilters = () => setFilters((current) => ({ ...current, ...emptyFilters, page: 1 }));
  const optionsFor = (key: OptionKey) => key === "deadline"
    ? (["dated", "expired", "unspecified", "invalid"] as const).map((value) => ({ value, label: t(`deadline.${value}`) }))
    : (data?.facets[key] ?? []).map((value) => ({ value, label: value }));
  const choices = (key: OptionKey) => <FilterChoices key={key} label={t(`fields.${key}`)} value={filters[key]} options={optionsFor(key)} onChange={(value) => changeFilter(key, value)} />;
  const empty = !loading && !failed && data?.total === 0;

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{t("subtitle")}</p>
        {!loading && !failed && initialQuery.recordId && !data?.selectedRecord && selection === undefined ? <p role="status" className="text-sm text-muted-foreground">{t("recordNotFound")}</p> : null}
      </header>

      <div className="@container space-y-3">
        <div className="relative">
          <Search aria-hidden className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label={t("filters.q")} placeholder={t("searchPlaceholder")} maxLength={120} value={filters.q} onChange={(event) => changeFilter("q", event.target.value)} className="h-12 rounded-xl border-line bg-background pl-12 pr-11 shadow-none" />
          {filters.q ? <Button variant="ghost" size="icon" aria-label={t("clearSearch")} onClick={() => changeFilter("q", "")} className="absolute right-2 top-2"><X aria-hidden /></Button> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 @min-[30rem]:grid-cols-4 @min-[44rem]:grid-cols-7">
          {filterGroups.map((key) => <Popover key={key}>
            <PopoverTrigger render={<Button variant="outline" className={cn("h-10 w-full min-w-0 justify-between gap-1.5 px-2.5 text-sm", filters[key] && "border-brand/30 bg-brand-muted text-brand")} />}>
              <span className="truncate">{filters[key] ? optionsFor(key).find((option) => option.value === filters[key])?.label : t(`fields.${key}`)}</span><ChevronDown aria-hidden className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} collisionAvoidance={{ side: "shift", align: "shift" }} className={cn("max-h-[65dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-xl p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden data-open:animate-none data-closed:animate-none", key === "industry" && "w-[36rem]")}>
              <PopoverTitle className="sr-only">{t(`fields.${key}`)}</PopoverTitle>{choices(key)}
            </PopoverContent>
          </Popover>)}
          <Popover>
            <PopoverTrigger render={<Button variant="outline" className={cn("col-span-2 h-10 min-w-0 justify-between gap-1.5 px-2.5 text-sm @min-[44rem]:col-span-1", filters.location && "border-brand/30 bg-brand-muted text-brand")} />}>
              <span className="truncate">{filters.location || t("fields.location")}</span><ChevronDown aria-hidden className="size-3.5 shrink-0" />
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={8} collisionAvoidance={{ side: "shift", align: "shift" }} className="max-h-[65dvh] w-80 max-w-[calc(100vw-2rem)] gap-4 overflow-y-auto overscroll-contain rounded-xl p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden data-open:animate-none data-closed:animate-none">
              <PopoverTitle>{t("fields.location")}</PopoverTitle>
              <Input aria-label={t("filters.location")} value={filters.location} maxLength={120} placeholder={t("locationPlaceholder")} onChange={(event) => changeFilter("location", event.target.value)} />
              <FilterChoices label={t("popularCities")} value={filters.location} options={popularCities.map((value) => ({ value, label: value }))} onChange={(value) => changeFilter("location", value)} />
            </PopoverContent>
          </Popover>
        </div>
        {activeFilters.length ? <div className="flex flex-wrap items-center gap-2 pt-1">
          {activeFilters.map((key) => <button key={key} type="button" aria-label={t("removeFilter", { filter: t(`fields.${key}`), value: filters[key] })} onClick={() => changeFilter(key, "")} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-brand/15 bg-background px-2.5 py-1.5 text-xs text-brand outline-none hover:bg-brand-muted focus-visible:ring-2 focus-visible:ring-ring">
            <span className="truncate">{t(`fields.${key}`)} · {key === "deadline" ? t(`deadline.${filters.deadline}`) : filters[key]}</span><X aria-hidden className="size-3 shrink-0" />
          </button>)}
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={clearFilters}>{t("clearFilters")}</Button>
        </div> : null}
      </div>

      <div className="space-y-3" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
          <p role="status" aria-live="polite">{loading ? t("loading") : failed ? t("loadFailed") : t("resultCount", { count: data?.total ?? 0 })}</p>
          <Select value={filters.sort} onValueChange={(value) => { if (value) setFilters((current) => ({ ...current, sort: value as CampusQuery["sort"], page: 1 })); }}>
            <SelectTrigger aria-label={t("sortLabel")} className="h-9 gap-2 border-border bg-background px-3 text-sm hover:bg-surface-low"><ArrowUpDown aria-hidden /><SelectValue>{t(`sort.${filters.sort}`)}</SelectValue></SelectTrigger>
            <SelectContent align="end" alignItemWithTrigger={false} className="min-w-52 p-1">{sortOptions.map((value) => <SelectItem key={value} value={value} className="py-2">{t(`sort.${value}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />{t("loading")}</div> : failed ? <div className="rounded-2xl border border-dashed p-12 text-center">
          <p className="mb-4 text-sm text-muted-foreground">{t("loadFailedHint")}</p><Button variant="outline" onClick={() => setRetry((value) => value + 1)}>{t("retry")}</Button>
        </div> : empty ? <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed p-8 text-center">
          <Building2 aria-hidden className="mb-4 size-8 text-muted-foreground/60" /><h2 className="font-medium">{data?.source ? t("noResults") : t("noDataset")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{data?.source ? t("noResultsHint") : t("noDatasetHint")}</p>
          {activeFilters.length ? <Button variant="outline" className="mt-5" onClick={clearFilters}>{t("clearFilters")}</Button> : null}
        </div> : data ? <>
          <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="bg-surface-low text-xs text-muted-foreground"><tr>
                <th scope="col" className="w-[27%] px-5 py-4 font-medium">{t("fields.company")}</th>
                <th scope="col" className="w-[30%] px-4 py-4 font-medium">{t("fields.positions")}</th>
                <th scope="col" className="w-[17%] px-4 py-4 font-medium">{t("fields.location")}</th>
                <th scope="col" className="w-[16%] px-4 py-4 font-medium">{t("fields.deadline")}</th>
                <th scope="col" className="w-[10%] py-4 pr-5"><span className="sr-only">{t("details")}</span></th>
              </tr></thead>
              <tbody className="divide-y divide-line">{data.records.map((record) => <tr key={record.id} className="align-top transition-colors hover:bg-surface-low/50">
                <th scope="row" className="px-5 py-5 font-normal">
                  <button type="button" onClick={() => setSelected(record)} className="text-left font-semibold leading-6 text-foreground outline-none hover:text-brand focus-visible:underline">{record.company}</button>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{[record.companyType, record.industry].filter(Boolean).join(" · ") || t("notProvided")}</p>
                  <div className="mt-2 flex flex-wrap gap-1">{record.recruitmentTypes.map((type) => <span key={type} className="rounded bg-brand-muted px-1.5 py-0.5 text-[11px] text-brand">{type}</span>)}</div>
                </th>
                <td className="px-4 py-5"><p className="line-clamp-2 break-words leading-6">{record.positions || t("notProvided")}</p><p className="mt-2 text-xs text-muted-foreground">{record.targets.join(" / ") || t("notProvided")}</p></td>
                <td className="px-4 py-5"><p className="line-clamp-3 break-words text-xs leading-6">{record.location || t("notProvided")}</p></td>
                <td className="px-4 py-5"><Deadline record={record} today={data.asOf} /><p className="mt-2 text-[11px] text-muted-foreground">{t("updated", { date: record.updatedAt ?? "—" })}</p></td>
                <td className="py-5 pr-3 text-right"><Button variant="ghost" size="sm" aria-label={t("viewCompany", { company: record.company })} onClick={() => setSelected(record)}>{t("details")}<ChevronRight aria-hidden className="size-3" /></Button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="space-y-3 md:hidden">{data.records.map((record) => <article key={record.id} className="rounded-2xl border border-line p-4">
            <button type="button" onClick={() => setSelected(record)} className="w-full text-left font-semibold leading-6 outline-none focus-visible:underline">{record.company}</button>
            <p className="mt-1 text-xs text-muted-foreground">{[record.companyType, record.industry].filter(Boolean).join(" · ")}</p>
            <div className="my-3 flex flex-wrap gap-1.5">{[...record.recruitmentTypes, ...record.targets].map((value) => <span key={value} className="rounded-md bg-surface-low px-2 py-1 text-xs">{value}</span>)}</div>
            <p className="line-clamp-2 text-sm leading-6">{record.positions || t("notProvided")}</p>
            <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-muted-foreground"><MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" /><span className="line-clamp-2">{record.location || t("notProvided")}</span></p>
            <div className="mt-4 flex items-end justify-between border-t border-line pt-3"><Deadline record={record} today={data.asOf} /><Button variant="outline" aria-label={t("viewCompany", { company: record.company })} onClick={() => setSelected(record)}>{t("details")}<ChevronRight aria-hidden /></Button></div>
          </article>)}</div>
          <nav aria-label={t("pagination")} className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs tabular-nums text-muted-foreground">{t("page", { page: data.page, pages: data.pages })}</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" disabled={data.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: data.page - 1 }))}><ChevronLeft aria-hidden />{t("previous")}</Button>
              <form key={`${data.page}:${data.pages}`} className="flex items-center gap-2" onSubmit={(event) => {
                event.preventDefault();
                const page = Number(new FormData(event.currentTarget).get("page"));
                if (Number.isInteger(page) && page >= 1 && page <= data.pages) setFilters((current) => ({ ...current, page }));
              }}>
                <Input name="page" type="number" min={1} max={data.pages} step={1} required defaultValue={data.page} aria-label={t("pageNumber")} title={t("pageNumber")} className="size-9 shrink-0 rounded-md px-1 text-center tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
              </form>
              <Button variant="outline" disabled={data.page >= data.pages} onClick={() => setFilters((current) => ({ ...current, page: data.page + 1 }))}>{t("next")}<ChevronRight aria-hidden /></Button></div>
          </nav>
        </> : null}
      </div>

      {data?.source ? <footer className="border-t border-line pt-4 text-xs leading-6 text-muted-foreground">
        <p>{t("source")}{" "}{t("referenceNote")}</p>
        <p>{t("officialNote")}{" "}{t.rich("rightsNote", { contact: (chunks) => <a href="https://github.com/Chozzc/Lujie-Careerkit/issues" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-foreground">{chunks}</a> })}</p>
      </footer> : null}

      <Dialog modal={false} open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogPortal><DialogPrimitive.Popup className="fixed inset-y-0 right-0 z-50 flex h-dvh w-full flex-col gap-5 overflow-y-auto border-l bg-background p-5 shadow-xl outline-none sm:w-[clamp(320px,22vw,440px)]">
          {selected && data ? <>
            <DialogHeader className="sticky -top-5 z-10 -mx-5 -mt-5 border-b bg-background p-5 pr-12"><DialogTitle className="font-serif text-xl leading-7">{selected.company}</DialogTitle><DialogDescription>{[selected.companyType, selected.industry, ...selected.recruitmentTypes].filter(Boolean).join(" · ")}</DialogDescription><DialogClose render={<Button variant="ghost" size="icon" aria-label={t("closeDetails")} className="absolute right-3 top-4" />}><X aria-hidden /></DialogClose></DialogHeader>
            <dl className="grid grid-cols-1 gap-4 text-sm">
              <div><dt className="mb-1 text-xs text-muted-foreground">{t("fields.target")}</dt><dd>{selected.targets.join(" / ") || t("notProvided")}</dd></div>
              <div><dt className="mb-1 text-xs text-muted-foreground">{t("fields.exam")}</dt><dd>{selected.exams.join(" / ") || t("notProvided")}</dd></div>
              <div><dt className="mb-1 text-xs text-muted-foreground">{t("fields.location")}</dt><dd className="whitespace-pre-wrap break-words leading-6">{selected.location || t("notProvided")}</dd></div>
              <div><dt className="mb-1 text-xs text-muted-foreground">{t("fields.deadline")}</dt><dd><Deadline record={selected} today={data.asOf} /><p className="mt-1 text-xs text-muted-foreground">{t("originalDeadline", { value: selected.deadlineRaw || t("notProvided") })}</p></dd></div>
              <div><dt className="mb-1 text-xs text-muted-foreground">{t("fields.updatedAt")}</dt><dd className="tabular-nums">{selected.updatedAt ?? t("notProvided")}</dd></div>
            </dl>
            <section><h2 className="mb-3 font-semibold">{t("fields.positions")}</h2><p className="whitespace-pre-wrap break-words text-sm leading-7">{selected.positions || t("notProvided")}</p></section>
            {selected.reviewNote ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">{t("reviewNote", { note: selected.reviewNote })}</p> : null}
            <div className="flex flex-wrap gap-3 border-t border-line pt-5">
              {selected.applyUrl ? <a href={selected.applyUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ className: "h-10 px-4" })}>{t("openApplication")}<ArrowUpRight aria-hidden /></a> : null}
              {selected.noticeUrl && selected.noticeUrl !== selected.applyUrl ? <a href={selected.noticeUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", className: "h-10 px-4" })}>{t("openNotice")}<ArrowUpRight aria-hidden /></a> : null}
              {!selected.applyUrl && !selected.noticeUrl ? <p className="text-sm text-muted-foreground">{t("noLinks")}</p> : null}
            </div>
            <p className="text-xs leading-6 text-muted-foreground">{t("freshnessNote")}</p>
          </> : null}
        </DialogPrimitive.Popup></DialogPortal>
      </Dialog>
    </section>
  );
}
