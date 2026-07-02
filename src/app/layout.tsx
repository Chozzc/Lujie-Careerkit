import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "录阶 | LuJie CareerKit",
  description: "从简历到 Offer 的校招实习工作台",
  icons: {
    icon: "/brand/lujie-mark.svg",
    shortcut: "/brand/lujie-mark.svg",
    apple: "/brand/lujie-mark.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className={cn("font-sans", geist.variable)}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
