import { notFound } from "next/navigation";

import { CareerKitApp } from "@/components/app/careerkit-app";
import { getAppData } from "@/lib/repository";
import { navKeyFromPathname, pathnameForNavKey } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default async function WorkspaceViewPage({ params }: { params: Promise<{ view: string }> }) {
  const { view } = await params;
  const pathname = `/${view}`;
  const initialView = navKeyFromPathname(pathname);

  if (!initialView || pathnameForNavKey(initialView) !== pathname) {
    notFound();
  }

  const data = await getAppData();
  return <CareerKitApp initialData={data} initialView={initialView} />;
}
