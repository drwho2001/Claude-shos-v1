// contactRepository.js
//
// CHANGES THIS ROUND (Kane's feedback):
// - `city` is back as a real stored field, editable directly — the
//   previous "derive it from the address text" approach is dropped.
// - `contactableVia` is back to being a plain, manually-entered field —
//   the auto-derivation from Phone/Snapchat/Fabguys/Fabswingers is
//   dropped per Kane's explicit steer ("skip autofill and allow user
//   input"). The `otherPlatforms` rename from last round is reverted.
// - `carDetails` added — only relevant, and only shown in the UI, when
//   `drives` is true. Still stored even if drives later gets toggled
//   off, so nothing typed in gets silently lost.
//
// City, Stated Kinks, Limits, and Contactable via all now use a
// "combobox" pattern in the UI (contactRepository.js doesn't know or
// care about that — it just stores whatever value ends up chosen or
// typed). See contactCalculations.js for how the suggestion lists for
// that combobox are built.
//
// PERSISTENCE, added this round: contacts now survive closing and
// reopening the app, via localStorageAdapter (see storageAdapter.js).
// This repository still doesn't know or care that it's specifically
// localStorage underneath — it only knows the load(key, fallback) /
// save(key, value) shape. Swapping in a different adapter later (e.g.
// an encrypted cloud backend) means editing storageAdapter.js, not this
// file. Kept synchronous on purpose — see the note further down on why
// this doesn't need to be async yet.

import { localStorageAdapter as storage } from "./storageAdapter.js";

const STORAGE_KEY = "shos_contacts";


// ---------------------------------------------------------------------
// Known option sets for fields that stay fixed single/multi-select
// (unchanged from the live Notion values).
// ---------------------------------------------------------------------

// ⚠️ APP-ONLY DIVERGENCE FROM NOTION (Kane's explicit call, 17 Aug 2026):
// Notion's live schema still has ONE "Hosting/Travel Options" select field
// with combined values ("Hosts", "Hosts sometimes", "Travels", etc). The
// app now splits this into three independent concepts — Hosts, Travels,
// and a general meet-up frequency. This is deliberately NOT reflected
// back into Notion's schema for now. Logged in the Notion working log,
// not the schema itself — see the AI Development page for the dated
// entry. If this ever gets ported back to Notion, this comment is the
// pointer to why the two don't match.
export const HOSTS_OPTIONS = ["Yes", "Sometimes", "No"];
export const TRAVELS_OPTIONS = ["Yes", "Sometimes", "No"];
// ⚠️ APP-ONLY CORRECTION (17 Aug 2026, Kane): Notion's live "Availability"
// multi_select actually contains both "Night" and "Nights" as separate
// options — an inconsistent-pluralization duplicate, not a deliberate
// distinction. Fixed here (kept "Nights", to match the plural pattern
// used by Weekends/Weekdays/Days/Mornings) but NOT changed in Notion's
// schema — same app-only-divergence pattern as the Hosting/Travel split
// above. Note: "Afternoon" is still singular where the others are
// plural — left as-is since Kane only flagged Night/Nights specifically;
// worth a follow-up question if it's meant to be "Afternoons".
export const AVAILABILITY_OPTIONS = ["Flexible", "Weekends", "Weekdays", "Nights", "Days", "Mornings", "Afternoon", "Visitor / N/A"];
export const READILY_AVAILABLE_OPTIONS = ["Readily available", "Inaccessible", "Unavailable foreseeably"];
export const RELATIONSHIP_TYPE_OPTIONS = ["Hookup", "Fuck buddy (casual)", "Friend with Benefit (chill)", "Partner"];
export const MEET_AGAIN_OPTIONS = ["Yes", "Tentatively", "No"];
export const LENGTH_OPTIONS = ["Short", "Average", "Long"];
export const THICKNESS_OPTIONS = ["Skinny", "Average", "Thick"];
export const FORESKIN_OPTIONS = ["Circumcised", "Uncircumcised", "Loose", "Too tight", "Unknown / N/A"];
export const CHASTITY_OPTIONS = ["N/A", "Uncaged", "Caged"];
export const CUMMER_OPTIONS = ["Doesn't", "Premature", "Takes ages", "Only once", "Multiple loads", "Big load", "Squirter", "Dribbler"];

// New this round: known PrEP/DoxyPEP status, and the day/time rule
// builder for non-availability (and its inverse, availability) windows.
export const PREP_DOXY_OPTIONS = ["PrEP", "DoxyPEP"];
export const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const TIME_CONSTRAINT_TYPES = ["All day", "Before", "After"];
export const AVAILABILITY_RULE_TYPES = ["Unavailable", "Available"];

// ⚠️ APP-ONLY ADDITION (17 Aug 2026, Kane): confirmed via a fresh Notion
// fetch that no equivalent field exists in the live Contacts schema —
// this genuinely isn't there yet, not something missed. Logged here per
// the same pattern as the Hosting/Travel split; revisit adding to Notion
// if it turns out to earn its place long-term.
export const BDSM_ROLE_OPTIONS = ["Dom", "Sub", "Switch"];
export const SEXUAL_POSITION_OPTIONS = ["Top", "Vers", "Bottom", "Oral only", "Side", "Kink"];

// ---------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------

// The single source of truth for "what does an empty contact look like".
// create() uses this, the seed data below uses it, and the UI's
// Add-contact form uses it too (imported from here, not re-typed) — one
// shape, not several that can drift apart.
export const DEFAULT_CONTACT = {
  name: "", nickname: "", age: null, ageIsApprox: false,
  phone: "", snapchat: "", fabguys: "", fabswingers: "", contactableVia: [],
  city: "", address: "",
  hosts: "", travels: "",
  availability: [], nonAvailabilityRules: [], readilyAvailable: "",
  drives: false, carDetails: "",
  relationshipType: [], howDidWeMeet: [], meetAgain: "", dontMeetAgainReason: "",
  // CHANGED 18 Aug 2026 — statedKinks/limits/knownChems now hold
  // REGISTRY IDs (kink_NNN, chem_NNN), not free text. Kink Registry and
  // Chems Registry are real, built modules as of this session — see
  // kinkRegistry.js/chemsRegistry.js. Resolve an id to its display name
  // via KinkRegistry.getById(id).name / ChemsRegistry.getById(id).name
  // (the UI does this, this file just stores the facts). Genuinely
  // migrates existing prototype data cleanly: seed data below never
  // populated these with real values, so there's nothing to convert.
  statedKinks: [], limits: [],
  knownChems: [],
  bdsmRole: [], sexualPosition: [],
  length: "", thickness: "", foreskin: "", chastityStatus: "", cummer: [],
  knownPrepDoxy: [], lastTestedDate: "",
  notes: "",
  linkedContactIds: [],
  linkedContactLabels: {},
};

// ---------------------------------------------------------------------
// Seed data — each entry spreads DEFAULT_CONTACT and only overrides
// what's actually different, rather than repeating the full field list
// four times (the exact duplication risk flagged earlier this session).
// ---------------------------------------------------------------------

let seedContacts = [
  {
    ...DEFAULT_CONTACT,
    id: "contact_001",
    name: "Alex",
    notes: "Met through mutual friends.",
    createdAt: "2026-07-01T09:00:00.000Z",
    isArchived: false,
  },
  {
    ...DEFAULT_CONTACT,
    id: "contact_002",
    name: "Jordan",
    snapchat: "jordan_snap",
    contactableVia: ["Snapchat"],
    city: "Leeds",
    drives: true,
    carDetails: "Blue Ford Focus",
    createdAt: "2026-07-15T09:00:00.000Z",
    isArchived: false,
  },
  {
    ...DEFAULT_CONTACT,
    id: "contact_003",
    name: "Sam",
    phone: "07700 900123",
    contactableVia: ["Phone/WhatsApp"],
    city: "Manchester",
    notes: "Prefers texting only.",
    createdAt: "2026-08-01T09:00:00.000Z",
    isArchived: false,
  },
  {
    ...DEFAULT_CONTACT,
    id: "contact_004",
    name: "Riley",
    createdAt: "2026-06-01T09:00:00.000Z",
    isArchived: true,
  },
];

// Real startup: load whatever's actually been saved before. On a
// genuinely first run (nothing in storage yet), fall back to the seed
// data above so the app isn't empty on day one.
let contacts = storage.load(STORAGE_KEY, seedContacts);

// Every mutating method below calls this after changing `contacts` —
// keeping "change the in-memory array" and "persist it" as two
// explicit, adjacent steps rather than hiding the save inside a proxy
// or a setter, so it's obvious from reading any method that it saves.
function persist() {
  storage.save(STORAGE_KEY, contacts);
}

// Derived from the actual IDs present, not from contacts.length — so a
// mixed-up array (e.g. after a manual edit or a future import) can't
// produce a duplicate ID. This was the one real weak point in the
// original array-length approach; scanning existing IDs closes it
// without needing to give up human-readable IDs for random UUIDs.
function computeNextContactNumber(existingContacts) {
  const numbers = existingContacts.map((c) => {
    const match = /^contact_(\d+)$/.exec(c.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
let nextContactNumber = computeNextContactNumber(contacts);

function generateContactId() {
  const id = `contact_${String(nextContactNumber).padStart(3, "0")}`;
  nextContactNumber += 1;
  return id;
}

// ---------------------------------------------------------------------
// The repository itself.
//
// getAll()/getById() return deep copies (via structuredClone), not the
// live stored objects — so nothing outside this file can accidentally
// mutate a contact's data without going through update()/create(), which
// are the only places that actually change what's stored.
// ---------------------------------------------------------------------

export const ContactRepository = {
  getAll() {
    return structuredClone(contacts);
  },

  getById(id) {
    const found = contacts.find((c) => c.id === id);
    return found ? structuredClone(found) : null;
  },

  create(data) {
    const newContact = {
      ...DEFAULT_CONTACT,
      ...data,
      id: generateContactId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    contacts = [...contacts, newContact];
    persist();
    return newContact;
  },

  update(id, changes) {
    let updatedContact = null;
    contacts = contacts.map((c) => {
      if (c.id !== id) return c;
      updatedContact = { ...c, ...changes };
      return updatedContact;
    });
    persist();
    return updatedContact;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  // Links two contacts together (e.g. a couple). Deliberately symmetric
  // — both contacts get the other's id added to their own
  // `linkedContactIds`, so opening EITHER profile shows the link, not
  // just the one that was edited. This is why it's a repository method
  // rather than the UI calling update() twice itself: keeping "a link is
  // a two-sided fact" as one atomic operation in one place.
  //
  // `label` (new, 18 Aug 2026) describes the relationship — "Dom/Sub",
  // "bf/gf", etc. Stored as ONE shared label, the same on both sides,
  // not a separate label per direction. Worth being upfront about the
  // trade-off: "Dom/Sub" is actually asymmetric (A is Dom OF B, not
  // just "a Dom/Sub pair") — a fully accurate model would let each side
  // hold its own role. This keeps it simple, matching how Kane's own
  // examples read ("bf/gf" is one descriptive label, not two). Revisit
  // if per-side roles turn out to matter in practice.
  //
  // NOTE — Encounters<->Contacts two-way linking is NOT built here. That
  // needs the Encounters module to exist first (it doesn't yet, in the
  // app) — same dependency Kane already identified when Contacts was
  // built before Encounters. This only covers Contact<->Contact.
  linkContacts(idA, idB, label = "") {
    if (idA === idB) return;
    const a = contacts.find((c) => c.id === idA);
    const b = contacts.find((c) => c.id === idB);
    if (!a || !b) return;
    if (!a.linkedContactIds.includes(idB)) this.update(idA, { linkedContactIds: [...a.linkedContactIds, idB] });
    if (!b.linkedContactIds.includes(idA)) this.update(idB, { linkedContactIds: [...b.linkedContactIds, idA] });
    if (label) {
      const freshA = contacts.find((c) => c.id === idA);
      const freshB = contacts.find((c) => c.id === idB);
      this.update(idA, { linkedContactLabels: { ...freshA.linkedContactLabels, [idB]: label } });
      this.update(idB, { linkedContactLabels: { ...freshB.linkedContactLabels, [idA]: label } });
    }
  },

  unlinkContacts(idA, idB) {
    const a = contacts.find((c) => c.id === idA);
    const b = contacts.find((c) => c.id === idB);
    if (a) {
      const { [idB]: _removed, ...restA } = a.linkedContactLabels;
      this.update(idA, { linkedContactIds: a.linkedContactIds.filter((id) => id !== idB), linkedContactLabels: restA });
    }
    if (b) {
      const { [idA]: _removed, ...restB } = b.linkedContactLabels;
      this.update(idB, { linkedContactIds: b.linkedContactIds.filter((id) => id !== idA), linkedContactLabels: restB });
    }
  },

  // Wholesale replace — used only by backup restore. Overwrites every
  // stored contact with whatever's in the backup file, recomputes the
  // ID counter from the restored data (so new contacts created after a
  // restore don't collide with restored IDs), and persists.
  replaceAll(newContacts) {
    contacts = newContacts;
    nextContactNumber = computeNextContactNumber(contacts);
    persist();
  },
};
