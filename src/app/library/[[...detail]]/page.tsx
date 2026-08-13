import { notFound } from "next/navigation";

import { CareerKitApp } from "@/components/app/careerkit-app";
import {
  parseCareerLibraryTarget,
  readCareerLibraryGroup,
} from "@/lib/career-library";
import { getAppData } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function CareerLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ detail?: string[] }>;
  searchParams: Promise<{ group?: string | string[] }>;
}) {
  const { detail = [] } = await params;
  const { group } = await searchParams;
  const pathname = `/library${detail.length ? `/${detail.map(encodeURIComponent).join("/")}` : ""}`;
  const target = detail.length ? parseCareerLibraryTarget(pathname) : null;
  if (detail.length && !target) notFound();

  const data = await getAppData();
  return (
    <CareerKitApp
      initialData={data}
      initialView="library"
      initialLibraryTarget={target}
      initialLibraryGroup={readCareerLibraryGroup(Array.isArray(group) ? group[0] : group)}
    />
  );
}
