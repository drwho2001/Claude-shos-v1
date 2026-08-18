// chemsRegistry.js
//
// Real Notion registry (chem_id, Chem, plus relations: Used with →
// Contacts, Used in encounters → Encounters). Confirmed live 18 Aug
// 2026 (Contacts round). Kept architecturally separate from Kink
// Registry per Notion's own design — Chems is a neutral domain, Kink is
// red, per Doc 2.
import { createSimpleRegistry } from "./simpleRegistry.js";

export const ChemsRegistry = createSimpleRegistry({
  storageKey: "shos_chems_registry",
  idPrefix: "chem",
  seedNames: [],
});
