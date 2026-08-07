import {
  CATEGORY_ICON_NAMES,
  DEFAULT_CATEGORY_ICON,
  normalizeCategoryIcon,
} from "./category-icons";

describe("category icon registry", () => {
  it("falls back to Tag for unknown or missing persisted values", () => {
    expect(normalizeCategoryIcon("unknown-icon")).toBe(DEFAULT_CATEGORY_ICON);
    expect(normalizeCategoryIcon(null)).toBe(DEFAULT_CATEGORY_ICON);
    expect(normalizeCategoryIcon(undefined)).toBe(DEFAULT_CATEGORY_ICON);
  });

  it("keeps the catalog finite and stable", () => {
    expect(CATEGORY_ICON_NAMES).toHaveLength(56);
    expect(new Set(CATEGORY_ICON_NAMES).size).toBe(CATEGORY_ICON_NAMES.length);
    expect(CATEGORY_ICON_NAMES).toContain("tag");
    expect(CATEGORY_ICON_NAMES).toContain("banknote-arrow-up");
    expect(CATEGORY_ICON_NAMES).toContain("piggy-bank");
  });
});
