// kinkRegistry.js
//
// Real Notion registry (kink_id, Kink Name, plus relations: Enjoyed by
// and Limit for → Contacts, Performed at → Encounters). Confirmed live
// this session — this was flagged as a future build back on 17 Aug when
// Contacts' Stated Kinks/Limits were still freeform tags.
//
// Seeded from the tags already typed into Contacts' seed data during
// earlier sessions, so nothing already "known" starts the registry
// empty. Real Notion kink names aren't fetched here (row-level content,
// not schema) — Kane's actual list populates this for real once he's
// using the app, same as every other registry.
import { createSimpleRegistry } from "./simpleRegistry.js";

export const KinkRegistry = createSimpleRegistry({
  storageKey: "shos_kink_registry",
  idPrefix: "kink",
  seedNames: ["Impact Play", "Praise", "Rimming", "Fisting"],
});

// ADDED 18 Aug 2026 — Kane's real-world need: for kinks where it
// changes future-meet intentions (his own example: fisting), track
// WHICH ROLE someone takes, not just that the kink applies. Deliberately
// NOT modeled as separate registry entries ("Fisting Top", "Fisting
// Bottom") — that would fragment one real concept into lookalike
// entries, break search/dedup, and fight the whole reason the Kink
// Registry exists. Instead, role is a small optional modifier attached
// to each individual kink SELECTION (on a Contact or an Encounter), not
// a property of the kink itself — see contactRepository.js and
// encounterRepository.js for the {kinkId, role} shape this powers.
// Deliberately a small, generic set (not per-kink-specific labels) so
// it stays meaningful across different kinks without the list growing
// unbounded — expand later if a real need for a specific kink surfaces.
export const KINK_ROLE_OPTIONS = ["Top", "Bottom", "Vers"];
