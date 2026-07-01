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

export type NavItem = { key: NavKey; label: string; icon: LucideIcon };

export const navItems: NavItem[] = [
  { key: "dashboard", label: "控制中心", icon: LayoutDashboard },
  { key: "resume", label: "简历编辑器", icon: FileText },
  { key: "match", label: "JD匹配优化", icon: Target },
  { key: "interview", label: "面试助手", icon: Mic },
  { key: "pipeline", label: "投递岗位跟进", icon: ClipboardList },
  { key: "settings", label: "设置", icon: Settings },
];

export const navGroups: Array<{ label: string; items: NavItem[] }> = [
  { label: "求职流程", items: navItems.filter((item) => item.key !== "settings") },
  { label: "系统", items: navItems.filter((item) => item.key === "settings") },
];
