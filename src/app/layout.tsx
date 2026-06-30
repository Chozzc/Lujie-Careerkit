import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={cn("font-sans", geist.variable)}>
      <body>{children}</body>
    </html>
  );
}
