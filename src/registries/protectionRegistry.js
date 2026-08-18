// protectionRegistry.js
//
// Real Notion registry (protection_id, Protection Name, plus a relation
// back to Encounters using it). The smallest registry in the whole
// workspace — 3 fields total. Encounters-pink per Doc 2 (moved off
// Healthcare blue — protection is encounter-context vocabulary).
import { createSimpleRegistry } from "./simpleRegistry.js";

export const ProtectionRegistry = createSimpleRegistry({
  storageKey: "shos_protection_registry",
  idPrefix: "protection",
  seedNames: ["Condom", "PrEP", "None"],
});
