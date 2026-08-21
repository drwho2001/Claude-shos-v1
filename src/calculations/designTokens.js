// designTokens.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Real ask: "standardise UI/appearance." Right now every module
// defines its own local LIGHT (and sometimes DARK) theme object, with
// its own hex values typed out fresh each time — which is exactly how
// small, real drift happens (a font size 1-2px off here, a slightly
// different grey there, one screen missing a font-family declaration
// entirely). This is the single shared source of truth those values
// SHOULD come from.
//
// HONEST SCOPE, stated plainly rather than oversold: this is the
// foundation, not a finished migration. Every module still needs to
// actually be updated to READ from these tokens instead of its own
// hardcoded copies — that's real work across ~15 files, done
// incrementally as each module gets touched, not all at once in one
// pass. What IS true today: this file exists, is correct, and any
// module using it is guaranteed consistent with every other module
// using it — that guarantee gets stronger as more modules adopt it.
//
// Self-contained modules keep their own THEME OBJECT (LIGHT/DARK
// constants) — that convention isn't changing. What changes is where
// the VALUES inside those objects come from: shared tokens here,
// instead of each module re-typing "#1B1B1F" from memory and slowly
// drifting from every other module's version of "the same" color.
//
// Lives in calculations/ alongside every other shared pure-export
// file (fuzzyMatch.js, contactCalculations.js, etc.) rather than a new
// top-level folder — matches the established project convention for
// "shared logic/data usable cross-module" instead of inventing a new
// one.

// Neutral palette — shared across every module regardless of domain.
export const NEUTRAL = {
  bg: "#F0F0F3",
  surface: "#FFFFFF",
  surfaceVariant: "#E7E7EB",
  border: "#DCDCE1",
  textPrimary: "#1B1B1F",
  textSecondary: "#5B5B62",
  textDisabled: "#9A9AA1",
};

// Domain accent colors — one per module, the color that makes each
// screen visually identifiable at a glance. Collected from what was
// already actually in use across the app (not invented fresh) —
// this is documentation of the real existing palette as much as a
// source of truth going forward.
export const ACCENTS = {
  contacts: "#14B8A6",
  encounters: "#E24E9C",
  medication: "#3D63C9",
  healthcare: "#4A80F0",
  kink: "#E5484D",
  protection: "#E24E9C",
};

// Universal action/status colors — same meaning everywhere (red always
// means the same kind of "stop and look at this", green always means
// the same kind of "this is fine/complete").
export const ACTION = {
  red: "#E5484D",
  green: "#1B9E77",
  amber: "#F59E0B",
  gold: "#B45309",
};

// Real font-size/weight pairings for common UI roles, standardized
// against Medication's own established pattern (the module this
// convention was first built around, referenced repeatedly elsewhere
// this session as "the reference"). Using these instead of each
// module typing its own fontSize/fontWeight combination is what
// actually prevents the "font size shifts slightly between modules"
// bug Kane flagged — a screen title is 22/700 everywhere it's used
// this way, not 22/700 in one module and 20/700 in another by
// accident.
export const TYPE = {
  screenTitle: { fontSize: 22, fontWeight: 700 },
  recordTitle: { fontSize: 20, fontWeight: 700 },
  sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 },
  body: { fontSize: 14, fontWeight: 400 },
  bodyEmphasis: { fontSize: 14, fontWeight: 600 },
  caption: { fontSize: 12, fontWeight: 400 },
  captionEmphasis: { fontSize: 12, fontWeight: 600 },
  monoLabel: { fontSize: 12, fontFamily: "'JetBrains Mono', monospace" },
};

export const RADIUS = { sm: 8, md: 16, lg: 24, full: 999 };

// The real font-family stack, exactly as it's supposed to appear
// everywhere — HealthcareScreen (see App.jsx) was found to be missing
// this entirely, which is the real, direct cause of it visually
// rendering in the browser's own default font instead of Public Sans,
// the "wrong font" Kane flagged. Any screen-level root container
// should set this explicitly rather than assume it inherits correctly
// from a parent.
export const FONT_FAMILY = "'Public Sans', sans-serif";
export const FONT_FAMILY_MONO = "'JetBrains Mono', monospace";
