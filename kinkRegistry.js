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
