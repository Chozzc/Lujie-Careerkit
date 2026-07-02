import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  Mic,
  Settings,
  Target,
  type LucideIcon,
} from "lucide-react";

import type { NavKey } from "@/lib/navigation";

export type NavItem = { key: NavKey; labelKey: NavKey; icon: LucideIcon };

export const navItems: NavItem[] = [
  { key: "dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { key: "resume", labelKey: "resume", icon: FileText },
  { key: "match", labelKey: "match", icon: Target },
  { key: "interview", labelKey: "interview", icon: Mic },
  { key: "pipeline", labelKey: "pipeline", icon: ClipboardList },
  { key: "settings", labelKey: "settings", icon: Settings },
];

export const navGroups: Array<{ labelKey: "workflow" | "system"; items: NavItem[] }> = [
  { labelKey: "workflow", items: navItems.filter((item) => item.key !== "settings") },
  { labelKey: "system", items: navItems.filter((item) => item.key === "settings") },
];
