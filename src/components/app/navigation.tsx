import {
  Building2,
  ClipboardList,
  FileText,
  FolderArchive,
  LayoutDashboard,
  Mic,
  Settings,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";

import type { NavKey } from "@/lib/navigation";

export type NavItem = { key: NavKey; labelKey: NavKey; icon: LucideIcon };

export const navItems: NavItem[] = [
  { key: "dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { key: "campus", labelKey: "campus", icon: Building2 },
  { key: "resume", labelKey: "resume", icon: FileText },
  { key: "match", labelKey: "match", icon: Target },
  { key: "interview", labelKey: "interview", icon: Mic },
  { key: "library", labelKey: "library", icon: FolderArchive },
  { key: "pipeline", labelKey: "pipeline", icon: ClipboardList },
  { key: "settings", labelKey: "settings", icon: Settings },
  { key: "trash", labelKey: "trash", icon: Trash2 },
];

export const navGroups: Array<{ labelKey: "workflow" | "system"; items: NavItem[] }> = [
  { labelKey: "workflow", items: navItems.filter((item) => !["settings", "trash"].includes(item.key)) },
  { labelKey: "system", items: navItems.filter((item) => ["settings", "trash"].includes(item.key)) },
];
