export const CATEGORY_ICON_NAMES = [
  "tag",
  "utensils",
  "coffee",
  "shopping-bag",
  "shirt",
  "car-front",
  "bus",
  "fuel",
  "house",
  "receipt-text",
  "wifi",
  "smartphone",
  "heart-pulse",
  "pill",
  "graduation-cap",
  "book-open",
  "gamepad-2",
  "dumbbell",
  "music",
  "plane",
  "baby",
  "gift",
  "briefcase-business",
  "banknote-arrow-up",
  "wallet-cards",
  "rotate-ccw",
  "banknote",
  "circle-help",
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_NAMES)[number];

export const DEFAULT_CATEGORY_ICON: CategoryIconName = "tag";

export const CATEGORY_ICON_LABELS: Record<CategoryIconName, string> = {
  tag: "Catégorie",
  utensils: "Nourriture",
  coffee: "Café",
  "shopping-bag": "Shopping",
  shirt: "Vêtements",
  "car-front": "Voiture",
  bus: "Transport",
  fuel: "Carburant",
  house: "Maison",
  "receipt-text": "Facture",
  wifi: "Internet",
  smartphone: "Téléphone",
  "heart-pulse": "Santé",
  pill: "Médicaments",
  "graduation-cap": "Éducation",
  "book-open": "Livres",
  "gamepad-2": "Jeux",
  dumbbell: "Sport",
  music: "Musique",
  plane: "Voyage",
  baby: "Enfant",
  gift: "Cadeau",
  "briefcase-business": "Travail",
  "banknote-arrow-up": "Salaire",
  "wallet-cards": "Portefeuille",
  "rotate-ccw": "Remboursement",
  banknote: "Argent",
  "circle-help": "Autre",
};

export function isCategoryIconName(value: string | null | undefined): value is CategoryIconName {
  return value != null && (CATEGORY_ICON_NAMES as readonly string[]).includes(value);
}

export function normalizeCategoryIcon(value: string | null | undefined): CategoryIconName {
  return isCategoryIconName(value) ? value : DEFAULT_CATEGORY_ICON;
}
