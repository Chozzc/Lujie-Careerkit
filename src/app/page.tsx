import { CareerKitApp } from "@/components/app/careerkit-app";
import { getAppData } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getAppData();
  return <CareerKitApp initialData={data} initialView="dashboard" />;
}
