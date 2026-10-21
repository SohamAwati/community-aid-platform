import {
  BookOpen, Leaf, PawPrint, HeartPulse, Users, Siren,
  Baby, Accessibility, Laptop, Scale, type LucideIcon,
} from "lucide-react";

export type CategoryKey =
  | "education" | "environment" | "animal_welfare" | "healthcare"
  | "community_development" | "disaster_relief" | "children"
  | "elderly_care" | "technology" | "human_rights";

export const CATEGORIES: { key: CategoryKey; label: string; icon: LucideIcon }[] = [
  { key: "education", label: "Education", icon: BookOpen },
  { key: "environment", label: "Environment", icon: Leaf },
  { key: "animal_welfare", label: "Animal Welfare", icon: PawPrint },
  { key: "healthcare", label: "Healthcare", icon: HeartPulse },
  { key: "community_development", label: "Community", icon: Users },
  { key: "disaster_relief", label: "Disaster Relief", icon: Siren },
  { key: "children", label: "Children", icon: Baby },
  { key: "elderly_care", label: "Elderly Care", icon: Accessibility },
  { key: "technology", label: "Technology", icon: Laptop },
  { key: "human_rights", label: "Human Rights", icon: Scale },
];

export const CATEGORY_LABEL: Record<CategoryKey, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c.label]),
) as Record<CategoryKey, string>;
