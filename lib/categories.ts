import {
  Briefcase,
  FileText,
  HeartPulse,
  Sparkles,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import type { Category } from "@/lib/atlasRepository";

export const categories: Record<
  Category,
  { label: string; icon: LucideIcon; color: string }
> = {
  documents: { label: "Документы", icon: FileText, color: "#6f4bd8" },
  health: { label: "Медицина", icon: HeartPulse, color: "#c83f52" },
  food: { label: "Еда", icon: UtensilsCrossed, color: "#a94f18" },
  work: { label: "Работа", icon: Briefcase, color: "#24739e" },
  family: { label: "Для семьи", icon: Users, color: "#bd3f7f" },
  leisure: { label: "Досуг", icon: Sparkles, color: "#2f8258" },
};

export const categoryKeys = Object.keys(categories) as Category[];
