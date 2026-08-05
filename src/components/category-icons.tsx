import {
  Baby,
  Banknote,
  BanknoteArrowUp,
  BookOpen,
  BriefcaseBusiness,
  Bus,
  CarFront,
  CircleHelp,
  Coffee,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Music,
  Pill,
  Plane,
  ReceiptText,
  RotateCcw,
  Shirt,
  ShoppingBag,
  Smartphone,
  Tag,
  Utensils,
  WalletCards,
  Wifi,
  type LucideIcon,
} from "lucide-react-native";
import type { ComponentProps } from "react";
import {
  normalizeCategoryIcon,
  type CategoryIconName,
} from "@/constants/category-icons";

export {
  CATEGORY_ICON_LABELS,
  CATEGORY_ICON_NAMES,
  DEFAULT_CATEGORY_ICON,
  isCategoryIconName,
  normalizeCategoryIcon,
} from "@/constants/category-icons";
export type { CategoryIconName } from "@/constants/category-icons";

type CategoryIconProps = ComponentProps<LucideIcon> & {
  name: string | null | undefined;
};

const ICONS: Record<CategoryIconName, LucideIcon> = {
  tag: Tag,
  utensils: Utensils,
  coffee: Coffee,
  "shopping-bag": ShoppingBag,
  shirt: Shirt,
  "car-front": CarFront,
  bus: Bus,
  fuel: Fuel,
  house: House,
  "receipt-text": ReceiptText,
  wifi: Wifi,
  smartphone: Smartphone,
  "heart-pulse": HeartPulse,
  pill: Pill,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  "gamepad-2": Gamepad2,
  dumbbell: Dumbbell,
  music: Music,
  plane: Plane,
  baby: Baby,
  gift: Gift,
  "briefcase-business": BriefcaseBusiness,
  "banknote-arrow-up": BanknoteArrowUp,
  "wallet-cards": WalletCards,
  "rotate-ccw": RotateCcw,
  banknote: Banknote,
  "circle-help": CircleHelp,
};

export function CategoryIcon({ name, ...props }: CategoryIconProps) {
  const Icon = ICONS[normalizeCategoryIcon(name)];
  return <Icon {...props} />;
}
