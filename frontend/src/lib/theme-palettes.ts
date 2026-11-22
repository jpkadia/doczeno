export type ThemeColorId =
  | "blue"
  | "red"
  | "golden"
  | "green"
  | "purple"
  | "orange"
  | "pink"
  | "brown";

export interface ThemePalette {
  id: ThemeColorId;
  name: string;
  label: string;
  description: string;
  swatchHex: string;
  swatchSecondaryHex: string;

  // Core brand colors
  primary: string;
  primaryHover: string;
  primaryLight: string; // used for dark mode accents

  // Hero Card / Avatar Gradients
  heroGradientFrom: string;
  heroGradientTo: string;

  // Soft backgrounds & borders (Light mode)
  softBgLight: string;
  softBorderLight: string;
  softTextLight: string;

  // Soft backgrounds & borders (Dark mode)
  softBgDark: string;
  softBorderDark: string;
  softTextDark: string;

  // Notice & Badge
  noticeBgLight: string;
  noticeBorderLight: string;
  noticeTextLight: string;
  noticeBgDark: string;
  noticeBorderDark: string;
  noticeTextDark: string;

  // Ring & Selection
  ringHex: string;
  selectionBg: string;

  // Comprehensive Theme Surfaces (Dark Mode)
  pageBgDark: string;         // Overall page background in dark mode
  sectionAltBgDark: string;   // Alternating section background
  cardBgDark: string;         // Card surface (Treatments, Info, Reviews, Timings, FAQs)
  cardBorderDark: string;     // Border color for cards in dark mode
  innerCardBgDark: string;    // Inner nested cards/chips
  headerBgDark: string;       // Sticky header background in dark mode
  footerBgDark: string;       // Footer background in dark mode
  heroMeshDarkFrom: string;   // Hero gradient start

  // Comprehensive Theme Surfaces (Light Mode)
  pageBgLight: string;        // Overall page background in light mode
  sectionAltBgLight: string;  // Alternating section background in light mode
  cardBgLight: string;        // Card surface
  cardBorderLight: string;    // Border color for cards in light mode
  innerCardBgLight: string;   // Inner nested card in light mode
  headerBgLight: string;      // Sticky header background in light mode
  footerBgLight: string;      // Footer background in light mode
}

export const THEME_PALETTES: Record<ThemeColorId, ThemePalette> = {
  blue: {
    id: "blue",
    name: "Sapphire Ocean",
    label: "Blue",
    description: "Classic healthcare clinical sapphire blue with high-trust contrast.",
    swatchHex: "#1a76d1",
    swatchSecondaryHex: "#60a5fa",
    primary: "#1a76d1",
    primaryHover: "#1560aa",
    primaryLight: "#60a5fa",
    heroGradientFrom: "#1a76d1",
    heroGradientTo: "#1258a2",
    softBgLight: "rgba(26, 118, 209, 0.14)",
    softBorderLight: "rgba(26, 118, 209, 0.32)",
    softTextLight: "#1560aa",
    softBgDark: "rgba(26, 118, 209, 0.18)",
    softBorderDark: "rgba(26, 118, 209, 0.35)",
    softTextDark: "#93c5fd",
    noticeBgLight: "#e5f2fd",
    noticeBorderLight: "rgba(26, 118, 209, 0.30)",
    noticeTextLight: "#1560aa",
    noticeBgDark: "#0d1d3a",
    noticeBorderDark: "rgba(26, 118, 209, 0.35)",
    noticeTextDark: "#93c5fd",
    ringHex: "rgba(26, 118, 209, 0.30)",
    selectionBg: "#1a76d1",
    pageBgDark: "#060f1d",
    sectionAltBgDark: "#0a172a",
    cardBgDark: "rgba(13, 27, 48, 0.94)",
    cardBorderDark: "rgba(96, 165, 250, 0.20)",
    innerCardBgDark: "rgba(26, 118, 209, 0.12)",
    headerBgDark: "rgba(8, 19, 36, 0.96)",
    footerBgDark: "#040a14",
    heroMeshDarkFrom: "#081426",
    pageBgLight: "#f0f7ff",
    sectionAltBgLight: "#dbeafe",
    cardBgLight: "#ffffff",
    cardBorderLight: "rgba(26, 118, 209, 0.25)",
    innerCardBgLight: "#e5f0fe",
    headerBgLight: "rgba(255, 255, 255, 0.95)",
    footerBgLight: "#08162b",
  },
  red: {
    id: "red",
    name: "Crimson Vitality",
    label: "Red",
    description: "Vibrant medical crimson & ruby tones symbolizing pulse and vitality.",
    swatchHex: "#dc2626",
    swatchSecondaryHex: "#f87171",
    primary: "#dc2626",
    primaryHover: "#b91c1c",
    primaryLight: "#f87171",
    heroGradientFrom: "#dc2626",
    heroGradientTo: "#991b1b",
    softBgLight: "rgba(220, 38, 38, 0.14)",
    softBorderLight: "rgba(220, 38, 38, 0.32)",
    softTextLight: "#b91c1c",
    softBgDark: "rgba(220, 38, 38, 0.18)",
    softBorderDark: "rgba(220, 38, 38, 0.35)",
    softTextDark: "#fca5a5",
    noticeBgLight: "#fee7e7",
    noticeBorderLight: "rgba(220, 38, 38, 0.30)",
    noticeTextLight: "#b91c1c",
    noticeBgDark: "#2c0b0e",
    noticeBorderDark: "rgba(220, 38, 38, 0.35)",
    noticeTextDark: "#fca5a5",
    ringHex: "rgba(220, 38, 38, 0.30)",
    selectionBg: "#dc2626",
    pageBgDark: "#140507",
    sectionAltBgDark: "#1e080b",
    cardBgDark: "rgba(37, 10, 14, 0.94)",
    cardBorderDark: "rgba(248, 113, 113, 0.20)",
    innerCardBgDark: "rgba(220, 38, 38, 0.14)",
    headerBgDark: "rgba(24, 7, 10, 0.96)",
    footerBgDark: "#0e0305",
    heroMeshDarkFrom: "#180608",
    pageBgLight: "#fef3f3",
    sectionAltBgLight: "#fee2e2",
    cardBgLight: "#ffffff",
    cardBorderLight: "rgba(220, 38, 38, 0.25)",
    innerCardBgLight: "#fce8e8",
    headerBgLight: "rgba(255, 255, 255, 0.95)",
    footerBgLight: "#1c0609",
  },
  golden: {
    id: "golden",
    name: "Royal Amber",
    label: "Golden",
    description: "Prestige warm gold and amber hues for a luxury wellness presence.",
    swatchHex: "#d97706",
    swatchSecondaryHex: "#fbbf24",
    primary: "#d97706",
    primaryHover: "#b45309",
    primaryLight: "#fbbf24",
    heroGradientFrom: "#d97706",
    heroGradientTo: "#92400e",
    softBgLight: "rgba(217, 119, 6, 0.15)",
    softBorderLight: "rgba(217, 119, 6, 0.34)",
    softTextLight: "#92400e",
    softBgDark: "rgba(217, 119, 6, 0.18)",
    softBorderDark: "rgba(217, 119, 6, 0.35)",
    softTextDark: "#fde68a",
    noticeBgLight: "#fef3d8",
    noticeBorderLight: "rgba(217, 119, 6, 0.32)",
    noticeTextLight: "#92400e",
    noticeBgDark: "#2e1a06",
    noticeBorderDark: "rgba(217, 119, 6, 0.35)",
    noticeTextDark: "#fde68a",
    ringHex: "rgba(217, 119, 6, 0.30)",
    selectionBg: "#d97706",
    pageBgDark: "#140d04",
    sectionAltBgDark: "#1e1305",
    cardBgDark: "rgba(37, 23, 6, 0.94)",
    cardBorderDark: "rgba(251, 191, 36, 0.20)",
    innerCardBgDark: "rgba(217, 119, 6, 0.14)",
    headerBgDark: "rgba(24, 15, 5, 0.96)",
    footerBgDark: "#0d0803",
    heroMeshDarkFrom: "#170e04",
    pageBgLight: "#fef9ed",
    sectionAltBgLight: "#fef0d0",
    cardBgLight: "#ffffff",
    cardBorderLight: "rgba(217, 119, 6, 0.28)",
    innerCardBgLight: "#fdf3da",
    headerBgLight: "rgba(255, 255, 255, 0.95)",
    footerBgLight: "#1f1003",
  },
  green: {
    id: "green",
    name: "Emerald Health",
    label: "Green",
    description: "Natural organic emerald green representing healing, recovery, and life.",
    swatchHex: "#059669",
    swatchSecondaryHex: "#34d399",
    primary: "#059669",
    primaryHover: "#047857",
    primaryLight: "#34d399",
    heroGradientFrom: "#059669",
    heroGradientTo: "#065f46",
    softBgLight: "rgba(5, 150, 105, 0.15)",
    softBorderLight: "rgba(5, 150, 105, 0.32)",
    softTextLight: "#047857",
    softBgDark: "rgba(5, 150, 105, 0.18)",
    softBorderDark: "rgba(5, 150, 105, 0.35)",
    softTextDark: "#6ee7b7",
    noticeBgLight: "#e2f8ec",
    noticeBorderLight: "rgba(5, 150, 105, 0.30)",
    noticeTextLight: "#047857",
    noticeBgDark: "#06281e",
    noticeBorderDark: "rgba(5, 150, 105, 0.35)",
    noticeTextDark: "#6ee7b7",
    ringHex: "rgba(5, 150, 105, 0.30)",
    selectionBg: "#059669",
    pageBgDark: "#03130c",
    sectionAltBgDark: "#061d13",
    cardBgDark: "rgba(7, 33, 21, 0.94)",
    cardBorderDark: "rgba(52, 211, 153, 0.20)",
    innerCardBgDark: "rgba(5, 150, 105, 0.14)",
    headerBgDark: "rgba(4, 22, 14, 0.96)",
    footerBgDark: "#020d08",
    heroMeshDarkFrom: "#04160e",
    pageBgLight: "#eef9f3",
    sectionAltBgLight: "#dcf4e6",
    cardBgLight: "#ffffff",
    cardBorderLight: "rgba(5, 150, 105, 0.25)",
    innerCardBgLight: "#e3f6ec",
    headerBgLight: "rgba(255, 255, 255, 0.95)",
    footerBgLight: "#041b12",
  },
  purple: {
    id: "purple",
    name: "Amethyst Royal",
    label: "Purple",
    description: "Deep violet amethyst tones evoking cutting-edge neuroscience and care.",
    swatchHex: "#7c3aed",
    swatchSecondaryHex: "#a78bfa",
    primary: "#7c3aed",
    primaryHover: "#6d28d9",
    primaryLight: "#a78bfa",
    heroGradientFrom: "#7c3aed",
    heroGradientTo: "#5b21b6",
    softBgLight: "rgba(124, 58, 237, 0.14)",
    softBorderLight: "rgba(124, 58, 237, 0.32)",
    softTextLight: "#6d28d9",
    softBgDark: "rgba(124, 58, 237, 0.18)",
    softBorderDark: "rgba(124, 58, 237, 0.35)",
    softTextDark: "#c4b5fd",
    noticeBgLight: "#f1ebff",
    noticeBorderLight: "rgba(124, 58, 237, 0.30)",
    noticeTextLight: "#6d28d9",
    noticeBgDark: "#1f103b",
    noticeBorderDark: "rgba(124, 58, 237, 0.35)",
    noticeTextDark: "#c4b5fd",
    ringHex: "rgba(124, 58, 237, 0.30)",
    selectionBg: "#7c3aed",
    pageBgDark: "#0f081c",
    sectionAltBgDark: "#170b2a",
    cardBgDark: "rgba(28, 13, 50, 0.94)",
    cardBorderDark: "rgba(167, 139, 250, 0.20)",
    innerCardBgDark: "rgba(124, 58, 237, 0.14)",
    headerBgDark: "rgba(18, 9, 33, 0.96)",
    footerBgDark: "#0a0413",
    heroMeshDarkFrom: "#120921",
    pageBgLight: "#f8f4ff",
    sectionAltBgLight: "#ede5ff",
    cardBgLight: "#ffffff",
    cardBorderLight: "rgba(124, 58, 237, 0.25)",
    innerCardBgLight: "#f1ebff",
    headerBgLight: "rgba(255, 255, 255, 0.95)",
    footerBgLight: "#140724",
  },
  orange: {
    id: "orange",
    name: "Sunset Coral",
    label: "Orange",
    description: "Warm sunset coral with radiant optimism and high energy.",
    swatchHex: "#ea580c",
    swatchSecondaryHex: "#fb923c",
    primary: "#ea580c",
    primaryHover: "#c2410c",
    primaryLight: "#fb923c",
    heroGradientFrom: "#ea580c",
    heroGradientTo: "#9a3412",
    softBgLight: "rgba(234, 88, 12, 0.14)",
    softBorderLight: "rgba(234, 88, 12, 0.32)",
    softTextLight: "#c2410c",
    softBgDark: "rgba(234, 88, 12, 0.18)",
    softBorderDark: "rgba(234, 88, 12, 0.35)",
    softTextDark: "#fdba74",
    noticeBgLight: "#feece0",
    noticeBorderLight: "rgba(234, 88, 12, 0.30)",
    noticeTextLight: "#c2410c",
    noticeBgDark: "#2d1306",
    noticeBorderDark: "rgba(234, 88, 12, 0.35)",
    noticeTextDark: "#fdba74",
    ringHex: "rgba(234, 88, 12, 0.30)",
    selectionBg: "#ea580c",
    pageBgDark: "#140903",
    sectionAltBgDark: "#1d0d04",
    cardBgDark: "rgba(37, 16, 4, 0.94)",
    cardBorderDark: "rgba(251, 146, 60, 0.20)",
    innerCardBgDark: "rgba(234, 88, 12, 0.14)",
    headerBgDark: "rgba(24, 11, 4, 0.96)",
    footerBgDark: "#0e0602",
    heroMeshDarkFrom: "#180b04",
    pageBgLight: "#fff5ee",
    sectionAltBgLight: "#ffe7d6",
    cardBgLight: "#ffffff",
    cardBorderLight: "rgba(234, 88, 12, 0.25)",
    innerCardBgLight: "#ffecdf",
    headerBgLight: "rgba(255, 255, 255, 0.95)",
    footerBgLight: "#1c0b02",
  },
  pink: {
    id: "pink",
    name: "Blossom Rose",
    label: "Pink",
    description: "Gentle rose and floral pink tones tailored for pediatrics, maternity, and wellness.",
    swatchHex: "#db2777",
    swatchSecondaryHex: "#f472b6",
    primary: "#db2777",
    primaryHover: "#be185d",
    primaryLight: "#f472b6",
    heroGradientFrom: "#db2777",
    heroGradientTo: "#9d174d",
    softBgLight: "rgba(219, 39, 119, 0.14)",
    softBorderLight: "rgba(219, 39, 119, 0.32)",
    softTextLight: "#be185d",
    softBgDark: "rgba(219, 39, 119, 0.18)",
    softBorderDark: "rgba(219, 39, 119, 0.35)",
    softTextDark: "#f9a8d4",
    noticeBgLight: "#fde5f2",
    noticeBorderLight: "rgba(219, 39, 119, 0.30)",
    noticeTextLight: "#be185d",
    noticeBgDark: "#2c0c1b",
    noticeBorderDark: "rgba(219, 39, 119, 0.35)",
    noticeTextDark: "#f9a8d4",
    ringHex: "rgba(219, 39, 119, 0.30)",
    selectionBg: "#db2777",
    pageBgDark: "#15040d",
    sectionAltBgDark: "#200615",
    cardBgDark: "rgba(39, 8, 26, 0.94)",
    cardBorderDark: "rgba(244, 114, 182, 0.20)",
    innerCardBgDark: "rgba(219, 39, 119, 0.14)",
    headerBgDark: "rgba(26, 6, 17, 0.96)",
    footerBgDark: "#0e0309",
    heroMeshDarkFrom: "#190510",
    pageBgLight: "#fdf2f8",
    sectionAltBgLight: "#fce2f0",
    cardBgLight: "#ffffff",
    cardBorderLight: "rgba(219, 39, 119, 0.25)",
    innerCardBgLight: "#fce8f4",
    headerBgLight: "rgba(255, 255, 255, 0.95)",
    footerBgLight: "#1c0411",
  },
  brown: {
    id: "brown",
    name: "Warm Bronze",
    label: "Brown",
    description: "Sophisticated earth bronze and terra-cotta for holistic and traditional clinical care.",
    swatchHex: "#92400e",
    swatchSecondaryHex: "#d97706",
    primary: "#92400e",
    primaryHover: "#78350f",
    primaryLight: "#fbbf24",
    heroGradientFrom: "#92400e",
    heroGradientTo: "#572b0d",
    softBgLight: "rgba(146, 64, 14, 0.14)",
    softBorderLight: "rgba(146, 64, 14, 0.32)",
    softTextLight: "#78350f",
    softBgDark: "rgba(146, 64, 14, 0.18)",
    softBorderDark: "rgba(146, 64, 14, 0.35)",
    softTextDark: "#fde68a",
    noticeBgLight: "#f8eee4",
    noticeBorderLight: "rgba(146, 64, 14, 0.30)",
    noticeTextLight: "#78350f",
    noticeBgDark: "#25170d",
    noticeBorderDark: "rgba(146, 64, 14, 0.35)",
    noticeTextDark: "#fde68a",
    ringHex: "rgba(146, 64, 14, 0.30)",
    selectionBg: "#92400e",
    pageBgDark: "#130904",
    sectionAltBgDark: "#1c0d06",
    cardBgDark: "rgba(35, 17, 7, 0.94)",
    cardBorderDark: "rgba(251, 191, 36, 0.20)",
    innerCardBgDark: "rgba(146, 64, 14, 0.14)",
    headerBgDark: "rgba(23, 11, 5, 0.96)",
    footerBgDark: "#0c0603",
    heroMeshDarkFrom: "#170b05",
    pageBgLight: "#faf4ef",
    sectionAltBgLight: "#f3e6dc",
    cardBgLight: "#ffffff",
    cardBorderLight: "rgba(146, 64, 14, 0.28)",
    innerCardBgLight: "#f6ece3",
    headerBgLight: "rgba(255, 255, 255, 0.95)",
    footerBgLight: "#1a0d05",
  },
};

export const THEME_COLOR_LIST: ThemePalette[] = Object.values(THEME_PALETTES);

/**
 * Normalizes any legacy string (e.g. "hospital-classic", "theme-teal-modern") or raw id into a valid ThemePalette.
 */
export function resolveThemePalette(themeId?: string | null): ThemePalette {
  if (!themeId) return THEME_PALETTES.blue;
  const normalized = themeId.toLowerCase().trim();

  // Direct match
  if (normalized in THEME_PALETTES) {
    return THEME_PALETTES[normalized as ThemeColorId];
  }

  // Common aliases
  if (normalized.includes("red") || normalized.includes("crimson")) return THEME_PALETTES.red;
  if (normalized.includes("gold") || normalized.includes("amber")) return THEME_PALETTES.golden;
  if (normalized.includes("green") || normalized.includes("emerald") || normalized.includes("teal")) return THEME_PALETTES.green;
  if (normalized.includes("purple") || normalized.includes("violet")) return THEME_PALETTES.purple;
  if (normalized.includes("orange") || normalized.includes("coral")) return THEME_PALETTES.orange;
  if (normalized.includes("pink") || normalized.includes("rose")) return THEME_PALETTES.pink;
  if (normalized.includes("brown") || normalized.includes("bronze") || normalized.includes("earth")) return THEME_PALETTES.brown;

  // Default fallback for legacy "hospital-classic" and any unrecognized string
  return THEME_PALETTES.blue;
}
