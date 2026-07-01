import { CareerKitApp } from "@/components/app/careerkit-app";
import { getAppData } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function ResumeEditorPage({
  searchParams,
}: {
  searchParams: Promise<{ version?: string | string[] }>;
}) {
  const { version } = await searchParams;
  const initialResumeVersionId = Array.isArray(version) ? version[0] : version;
  const data = await getAppData();
  return (
    <CareerKitApp
      initialData={data}
      initialView="resume"
      initialResumeMode="editor"
      initialResumeVersionId={initialResumeVersionId}
    />
  );
}
