import React, { useState, useMemo, useRef } from "react";
import {
  Plus, Search, ChevronLeft, MoreVertical, X, Archive, Settings2, Users,
  Phone, Ghost, Globe, MessageCircle, Car, AlertTriangle, Trash2, Link2,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────
// PREVIEW BUNDLE — for Claude's in-chat preview only. Memory-only (no
// persistence) because Claude's preview can't use localStorage.
// Address here uses the simpler 'suggest from what's already been
// typed' version, NOT live Nominatim search — cross-origin fetch is
// unreliable inside Claude's own preview. The real modular file
// (SHOS_Contacts_Prototype.jsx) has the real, live address search.
// Real source of truth: contactRepository.js, contactCalculations.js,
// storageAdapter.js, SHOS_Contacts_Prototype.jsx. Don't edit this
// bundle directly — edit the modular files and regenerate.
// ──────────────────────────────────────────────────────────────────

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

// PREVIEW NOTE: memory-only — Claude's preview can't use localStorage.


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
const HOSTS_OPTIONS = ["Yes", "Sometimes", "No"];
const TRAVELS_OPTIONS = ["Yes", "Sometimes", "No"];
// ⚠️ APP-ONLY CORRECTION (17 Aug 2026, Kane): Notion's live "Availability"
// multi_select actually contains both "Night" and "Nights" as separate
// options — an inconsistent-pluralization duplicate, not a deliberate
// distinction. Fixed here (kept "Nights", to match the plural pattern
// used by Weekends/Weekdays/Days/Mornings) but NOT changed in Notion's
// schema — same app-only-divergence pattern as the Hosting/Travel split
// above. Note: "Afternoon" is still singular where the others are
// plural — left as-is since Kane only flagged Night/Nights specifically;
// worth a follow-up question if it's meant to be "Afternoons".
const AVAILABILITY_OPTIONS = ["Flexible", "Weekends", "Weekdays", "Nights", "Days", "Mornings", "Afternoon", "Visitor / N/A"];
const READILY_AVAILABLE_OPTIONS = ["Readily available", "Inaccessible", "Unavailable foreseeably"];
const RELATIONSHIP_TYPE_OPTIONS = ["Hookup", "Fuck buddy (casual)", "Friend with Benefit (chill)", "Partner"];
const MEET_AGAIN_OPTIONS = ["Yes", "Tentatively", "No"];
const LENGTH_OPTIONS = ["Short", "Average", "Long"];
const THICKNESS_OPTIONS = ["Skinny", "Average", "Thick"];
const FORESKIN_OPTIONS = ["Circumcised", "Uncircumcised", "Loose", "Too tight", "Unknown / N/A"];
const CHASTITY_OPTIONS = ["N/A", "Uncaged", "Caged"];
const CUMMER_OPTIONS = ["Doesn't", "Premature", "Takes ages", "Only once", "Multiple loads", "Big load", "Squirter", "Dribbler"];

// New this round: known PrEP/DoxyPEP status, and the day/time rule
// builder for non-availability (and its inverse, availability) windows.
const PREP_DOXY_OPTIONS = ["PrEP", "DoxyPEP"];
const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_CONSTRAINT_TYPES = ["All day", "Before", "After"];
const AVAILABILITY_RULE_TYPES = ["Unavailable", "Available"];

// ⚠️ APP-ONLY ADDITION (17 Aug 2026, Kane): confirmed via a fresh Notion
// fetch that no equivalent field exists in the live Contacts schema —
// this genuinely isn't there yet, not something missed. Logged here per
// the same pattern as the Hosting/Travel split; revisit adding to Notion
// if it turns out to earn its place long-term.
const BDSM_ROLE_OPTIONS = ["Dom", "Sub", "Switch"];
const SEXUAL_POSITION_OPTIONS = ["Top", "Vers", "Bottom", "Oral only", "Side", "Kink"];

// ---------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------

// The single source of truth for "what does an empty contact look like".
// create() uses this, the seed data below uses it, and the UI's
// Add-contact form uses it too (imported from here, not re-typed) — one
// shape, not several that can drift apart.
const DEFAULT_CONTACT = {
  name: "", nickname: "", age: null, ageIsApprox: false,
  phone: "", snapchat: "", fabguys: "", fabswingers: "", contactableVia: [],
  city: "", address: "",
  hosts: "", travels: "",
  availability: [], nonAvailabilityRules: [], readilyAvailable: "",
  drives: false, carDetails: "",
  relationshipType: [], howDidWeMeet: [], meetAgain: "", dontMeetAgainReason: "",
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
let contacts = seedContacts;

// Every mutating method below calls this after changing `contacts` —
// keeping "change the in-memory array" and "persist it" as two
// explicit, adjacent steps rather than hiding the save inside a proxy
// or a setter, so it's obvious from reading any method that it saves.
function persist() {
  // no-op in Claude's preview
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

const ContactRepository = {
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

// ── Minimal memory-only Encounter stub, added for the 18 Aug 2026
// Timeline wiring — just enough seed data + read functions for the
// Timeline section below to have something real to calculate against.
// NOT the real encounterRepository.js (no create/update needed here,
// Contacts never writes to Encounters). See encounterRepository.js and
// encounterCalculations.js for the real, full versions. ──
const previewEncounters = [
  { id: "encounter_001", title: "Alex — coffee then back to his", date: "2026-07-20T19:30:00.000Z", attendeeIds: ["contact_001"], enjoymentRating: 85, isArchived: false },
  { id: "encounter_002", title: "Sauna trip", date: "2026-08-02T15:00:00.000Z", attendeeIds: ["contact_002", "contact_003"], enjoymentRating: 70, isArchived: false },
];
const EncounterRepository = {
  getAll() { return structuredClone(previewEncounters); },
};
function encountersForContact(encounters, contactId) {
  return encounters.filter((e) => e.attendeeIds.includes(contactId) && !e.isArchived);
}
function contactEncounterSummary(encounters, contactId) {
  const rated = encountersForContact(encounters, contactId).map((e) => e.enjoymentRating).filter((r) => typeof r === "number");
  const dates = encountersForContact(encounters, contactId).map((e) => e.date).filter(Boolean).sort((a, b) => new Date(b) - new Date(a));
  return {
    count: encountersForContact(encounters, contactId).length,
    averageEnjoyment: rated.length ? rated.reduce((s, r) => s + r, 0) / rated.length : null,
    highestEnjoyment: rated.length ? Math.max(...rated) : null,
    lastInteraction: dates.length ? dates[0] : null,
  };
}
function sortByDateDesc(list) {
  return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
}
function formatRelativeDate(dateString) {
  if (!dateString) return "—";
  const then = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "in the future";
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? "" : "s"} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) === 1 ? "" : "s"} ago`;
}


// contactCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// These functions never store anything. They look at every contact that
// already exists and build a "here's what's been typed before" list —
// which is exactly what powers the combobox fields (pick from what's
// been used, or type something new). The first time anyone types "Impact
// play" into Stated Kinks, it isn't in the list yet — but as soon as
// it's saved on that one contact, this function will surface it as a
// suggestion for every contact after that. Nothing needs to be manually
// added to a master list anywhere.

// A small starting point so City isn't empty on day one — everything
// typed afterwards (new or existing) joins this automatically.
const STARTER_CITIES = ["Hull", "Sheffield", "Leeds", "Manchester", "Doncaster", "Driffield", "Beverley", "Brighton", "Bolton", "London"];

function getKnownCities(contacts) {
  const used = contacts.map((c) => c.city).filter(Boolean);
  return Array.from(new Set([...STARTER_CITIES, ...used])).sort((a, b) => a.localeCompare(b));
}

// General-purpose version for any tag-list field (Stated Kinks, Limits,
// Contactable via) — no starter list, since there's nothing to seed
// these with yet. Purely "what's already been typed, across everyone".
function getKnownValues(contacts, fieldName) {
  const all = contacts.flatMap((c) => c[fieldName] || []);
  return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
}

// Address autocomplete — SAME pattern as getKnownCities: suggests
// addresses already typed for other contacts. This is NOT real
// geocoding/Places autocomplete (still needs a live API key this
// sandbox and this prototype don't have) — it's "have I typed this
// before", which at least stops re-typing the same address for a
// contact met at the same place as someone else.
function getKnownAddresses(contacts) {
  const used = contacts.map((c) => c.address).filter(Boolean);
  return Array.from(new Set(used)).sort((a, b) => a.localeCompare(b));
}

// Quick, low-risk standardization for kink/limit-style tags, per Kane's
// "standardise kinks" ask. This does NOT solve true synonyms ("Impact
// play" vs "Percussion play" still won't match) — that needs a real
// Kink Registry (Notion already has one: kink_id, Kink Name, and
// relations both ways — see the 17 Aug 2026 working log entry). This
// only collapses the cheap, common near-duplicates: inconsistent
// spacing and casing ("impact  play", "IMPACT PLAY", "Impact play" all
// become "Impact Play"), so the suggestion list doesn't visibly fill up
// with near-identical entries while a real registry is still pending.
function normalizeTag(raw) {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(" ");
}

// REINTRODUCED 17 Aug 2026 (Kane): the stored `contactableVia` array on a
// contact now holds only the EXTRA platforms that don't have their own
// dedicated field (Tinder, Bumble, Grindr, etc.) — typed in manually.
// This function is what actually gets DISPLAYED anywhere "contactable
// via" shows up (Card icons, Profile row): it's the stored extras PLUS
// whichever of Phone/WhatsApp, Snapchat, Fabguys, Fabswingers already
// have a value, auto-detected so nothing has to be typed twice. Order:
// auto-detected first (fixed, predictable order), then manual extras.
function getContactableVia(contact) {
  const autoDetected = [];
  if (contact.phone) autoDetected.push("Phone/WhatsApp");
  if (contact.snapchat) autoDetected.push("Snapchat");
  if (contact.fabguys) autoDetected.push("Fabguys");
  if (contact.fabswingers) autoDetected.push("Fabswingers");

  const combined = [...autoDetected];
  (contact.contactableVia || []).forEach((extra) => {
    if (!combined.includes(extra)) combined.push(extra);
  });
  return combined;
}

// "Incomplete" sort support — a simple 0–1 completeness score, purely
// derived, never stored. Counts how many of a contact's own fields
// actually have something in them (a non-empty string, a populated
// array, a real number, or a meaningful true/false where the field is
// specifically about a yes/no fact like Drives). Identity/system fields
// (id, createdAt, isArchived) don't count either way — completeness is
// about how much is actually known about the person, not bookkeeping.
const FIELDS_COUNTED_FOR_COMPLETENESS = [
  "name", "nickname", "age", "phone", "snapchat", "fabguys", "fabswingers",
  "contactableVia", "city", "address", "hosts", "travels",
  "availability", "readilyAvailable", "relationshipType", "howDidWeMeet",
  "meetAgain", "statedKinks", "limits", "bdsmRole", "sexualPosition", "length", "thickness", "foreskin",
  "chastityStatus", "cummer", "knownPrepDoxy", "lastTestedDate", "notes",
];

function isFilled(value) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "number") return true;
  return !!value;
}

function getCompletenessScore(contact) {
  const filled = FIELDS_COUNTED_FOR_COMPLETENESS.filter((key) => isFilled(contact[key])).length;
  return filled / FIELDS_COUNTED_FOR_COMPLETENESS.length;
}




const LIGHT = {
  bg: "#F0F0F3", surface: "#FFFFFF", surfaceVariant: "#E7E7EB", border: "#DCDCE1",
  textPrimary: "#1B1B1F", textSecondary: "#5B5B62", textDisabled: "#9A9AA1",
  contactsTeal: "#14B8A6", actionRed: "#E5484D", actionGreen: "#1B9E77",
  navActive: "#14B8A6", fabBg: "#1B1B1F", fabIcon: "#FFFFFF",
};
const radius = { sm: 8, md: 16, lg: 24, full: 999 };

function loadContacts() {
  return ContactRepository.getAll();
}

function btnStyle(color, variant) {
  return { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: radius.full, fontFamily: "'Public Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", border: variant === "outline" ? `1px solid ${color}` : "none", background: variant === "filled" ? color : "transparent", color: variant === "filled" ? "#FFFFFF" : color };
}

function idFromLabel(label) {
  return "combo-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function focusNextField(el) {
  const container = el.closest("[data-contact-sheet]");
  if (!container) return;
  const focusables = Array.from(container.querySelectorAll("input, textarea, select")).filter((f) => !f.disabled);
  const idx = focusables.indexOf(el);
  if (idx > -1 && idx < focusables.length - 1) focusables[idx + 1].focus();
}

function displayName(contact) {
  return contact.nickname || contact.name;
}

const METHOD_ICON_MAP = {
  "Phone/WhatsApp": Phone,
  "Snapchat": Ghost,
  "Fabguys": Globe,
  "Fabswingers": Globe,
};
function MethodIcons({ methods, T, size = 14 }) {
  if (!methods || methods.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {methods.map((m) => {
        const Icon = METHOD_ICON_MAP[m] || MessageCircle;
        return <Icon key={m} size={size} color={T.textSecondary} />;
      })}
    </div>
  );
}

// ── New this round: wraps a section's heading + fields in a visibly
// outlined card, per Kane's ask ("sections feel like they should all be
// on a separate card/button, like outlined background area"). Used by
// both the edit sheet and the read-only Profile, so the two look
// consistent with each other. ──
function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.contactsTeal, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

// ── Shared form primitives ──

function TextField({ label, value, onChange, T, placeholder, type = "text", helper }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input type={type} value={value ?? ""}
        onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextField(e.target); } }}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      {helper && <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 3 }}>{helper}</div>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, T }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }}>
        <option value="">—</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function ComboField({ label, value, onChange, T, options, placeholder }) {
  const listId = idFromLabel(label);
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input list={listId} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextField(e.target); } }}
        placeholder={placeholder || "Choose or type a new one"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      <datalist id={listId}>
        {options.map((opt) => <option key={opt} value={opt} />)}
      </datalist>
    </div>
  );
}

// ── New 18 Aug 2026: real address search, free, no API key — via
// OpenStreetMap's Nominatim service. This is what makes Address behave
// a bit like Notion's own Address field, per Kane's ask.
//
// ⚠️ REAL, LIVE LIMITS — genuinely worth reading, not boilerplate:
// - Nominatim's public server is free but rate-limited to 1 request per
//   second and explicitly asks not to be hit with rapid/bulk queries —
//   full policy: https://operations.osmfoundation.org/policies/nominatim/
//   The 600ms debounce below exists specifically to respect this, not
//   just for UI smoothness.
// - It's a shared, donated, volunteer-run server, not a commercial SLA
//   — occasional slowness or a failed request is expected sometimes,
//   not necessarily a bug in this code.
// - Attribution ("© OpenStreetMap contributors") is required whenever
//   results are shown — kept visible under the dropdown; don't remove it.
// - This makes a real request to an external domain. It can't be tested
//   in Node (no network there) or reliably inside Claude's own preview
//   (cross-origin fetch is unreliable in that sandbox) — only confirmed
//   working once tried in a real browser. Reviewed for correctness, not
//   live-tested — flagging that plainly rather than claiming otherwise.
// - This is why it only exists in this real, modular file — the Claude
//   PREVIEW bundle keeps the simpler "suggest from what's already been
//   typed" ComboField instead, since it can't make this network call.
function AddressAutocomplete({ label, value, onChange, T, placeholder }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  const handleChange = (text) => {
    onChange(text);
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&addressdetails=1&limit=5`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch (err) {
        // A failed lookup should never block manual typing — the field
        // stays a normal text input regardless of network/API state.
        console.error("Address lookup failed:", err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  const pick = (place) => {
    onChange(place.display_name);
    setResults([]);
    setOpen(false);
  };

  return (
    <div style={{ padding: "8px 0", position: "relative" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input value={value ?? ""} onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder || "Start typing an address..."}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      {open && (loading || results.length > 0) && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.sm, marginTop: 2, zIndex: 10, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.15)" }}>
          {loading && <div style={{ padding: 10, fontSize: 12, color: T.textDisabled }}>Searching…</div>}
          {results.map((r) => (
            <div key={r.place_id} onMouseDown={() => pick(r)}
              style={{ padding: "8px 10px", fontSize: 12, color: T.textPrimary, cursor: "pointer", borderBottom: `1px solid ${T.border}` }}>
              {r.display_name}
            </div>
          ))}
          {results.length > 0 && (
            <div style={{ padding: "6px 10px", fontSize: 10, color: T.textDisabled, textAlign: "right" }}>© OpenStreetMap contributors</div>
          )}
        </div>
      )}
    </div>
  );
}

function MultiSelectChips({ label, value, onChange, options, T }) {
  const toggle = (opt) => {
    const has = value.includes(opt);
    onChange(has ? value.filter((v) => v !== opt) : [...value, opt]);
  };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <div key={opt} onClick={() => toggle(opt)}
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTeal : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent" }}>
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Tag list with combobox suggestions.
// FIXED — likely root cause of "Kink hasn't populated at all": if you
// typed something but clicked Save without pressing Enter first, the
// typed text lived only in this component's own local `draft` state
// and was silently thrown away — it never made it into the saved
// contact. Now, leaving the field (onBlur — including by clicking the
// Save button) commits whatever's still typed, the same way pressing
// Enter does. Typing is never silently lost now.
//
// FIXED 18 Aug 2026 — "tried same kinks on two contacts, doesn't
// suggest, now have fist and fisting": the browser's native <datalist>
// dropdown only shows up while typing and only matches by substring —
// typing "Fisting" fresh never surfaces an existing "Fist" tag, since
// they're different strings and the dropdown is easy to type straight
// past without noticing. Added a VISIBLE, tappable list of what's
// already been used, shown even before typing anything, so it's
// something to browse and pick from rather than something you have to
// already know exists and type your way into. This doesn't fix true
// synonyms ("Fist" vs "Fisting" are still two different words to the
// computer) — only a real Kink Registry with one canonical name per
// concept actually solves that. This just makes existing entries hard
// to miss, which should catch most real-world near-misses like this one.
function TagInput({ label, value, onChange, T, placeholder, suggestions = [] }) {
  const [draft, setDraft] = useState("");
  const listId = idFromLabel(label);
  const visibleSuggestions = suggestions.filter((s) => !value.includes(s)).slice(0, 10);

  const commitDraft = (el) => {
    const raw = draft.trim();
    if (!raw) {
      if (el) focusNextField(el);
      return;
    }
    const newTags = raw.split(",").map((t) => normalizeTag(t)).filter((t) => t && !value.includes(t));
    if (newTags.length > 0) onChange([...value, ...newTags]);
    setDraft("");
  };

  const tapSuggestion = (s) => {
    if (!value.includes(s)) onChange([...value, s]);
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((tag) => (
            <div key={tag} onClick={() => onChange(value.filter((t) => t !== tag))}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {tag} <X size={11} />
            </div>
          ))}
        </div>
      )}
      <input list={listId} value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(e.target); } }}
        onBlur={() => commitDraft(null)}
        placeholder={placeholder || "Type one or more, comma-separated, then press Enter"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      <datalist id={listId}>
        {suggestions.map((opt) => <option key={opt} value={opt} />)}
      </datalist>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {visibleSuggestions.map((s) => (
            <div key={s} onClick={() => tapSuggestion(s)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer" }}>
              + {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Memory-only Kink/Chems registries + minimal Encounter stub, added
// for the 18 Aug 2026 update — same simpleRegistry.js factory logic
// inlined for the preview panel. See kinkRegistry.js/chemsRegistry.js
// for the real, persisted versions. ──
function makeSimpleRegistry(idPrefix, seedNames) {
  let entries = seedNames.map((name, i) => ({ id: `${idPrefix}_${String(i + 1).padStart(3, "0")}`, name, isArchived: false }));
  let next = entries.length + 1;
  return {
    getAll() { return structuredClone(entries); },
    getById(id) { const f = entries.find((e) => e.id === id); return f ? structuredClone(f) : null; },
    getByName(name) { const f = entries.find((e) => e.name.toLowerCase() === name.toLowerCase()); return f ? structuredClone(f) : null; },
    create(data) { const e = { name: "", ...data, id: `${idPrefix}_${String(next).padStart(3, "0")}`, isArchived: false }; next += 1; entries = [...entries, e]; return e; },
    findOrCreate(name) { const t = name.trim(); if (!t) return null; const existing = this.getByName(t); return existing || this.create({ name: t }); },
  };
}
const KinkRegistry = makeSimpleRegistry("kink", ["Impact Play", "Praise", "Rimming", "Fisting"]);
const ChemsRegistry = makeSimpleRegistry("chem", []);

// Same visual shape as TagInput above, but backed by a real registry
// instead of freeform strings pulled from other contacts' entries.
// `value` holds registry IDs.
function RegistryTagPicker({ label, value, onChange, T, registry, placeholder }) {
  const [draft, setDraft] = useState("");
  const listId = idFromLabel(label) + "-registry";
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const nameFor = (id) => allEntries.find((e) => e.id === id)?.name || registry.getById(id)?.name || "?";
  const visibleSuggestions = allEntries.filter((e) => !value.includes(e.id)).slice(0, 10);

  const commitDraft = (el) => {
    const raw = draft.trim();
    if (!raw) {
      if (el) focusNextField(el);
      return;
    }
    const entry = registry.findOrCreate(normalizeTag(raw));
    if (entry && !value.includes(entry.id)) onChange([...value, entry.id]);
    setDraft("");
  };

  const tapSuggestion = (entry) => {
    if (!value.includes(entry.id)) onChange([...value, entry.id]);
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((id) => (
            <div key={id} onClick={() => onChange(value.filter((v) => v !== id))}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {nameFor(id)} <X size={11} />
            </div>
          ))}
        </div>
      )}
      <input list={listId} value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(e.target); } }}
        onBlur={() => commitDraft(null)}
        placeholder={placeholder || "Pick existing or type a new one"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      <datalist id={listId}>
        {allEntries.map((e) => <option key={e.id} value={e.name} />)}
      </datalist>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer" }}>
              + {e.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ value, onChange, T }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width: 40, height: 24, borderRadius: radius.full, background: value ? T.contactsTeal : T.surfaceVariant, position: "relative", cursor: "pointer", transition: "background 150ms ease" }}>
      <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 20, height: 20, borderRadius: radius.full, background: "#FFFFFF", transition: "left 150ms ease", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </div>
  );
}

function AgeField({ age, ageIsApprox, onChangeAge, onChangeApprox, T }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Age</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="number" value={age ?? ""} onChange={(e) => onChangeAge(e.target.value === "" ? null : Number(e.target.value))}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextField(e.target); } }}
          style={{ width: 90, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
        <div onClick={() => onChangeApprox(!ageIsApprox)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <ToggleSwitch T={T} value={ageIsApprox} onChange={onChangeApprox} />
          <span style={{ fontSize: 12, color: T.textSecondary }}>Approximate</span>
        </div>
      </div>
    </div>
  );
}

// ── Auto-detected contact methods, shown as a read-only preview above
// the manual "add extra platforms" input — this is the "visibly
// autofill" part of Kane's ask: you can SEE what's already covered by
// Phone/Snapchat/Fabguys/Fabswingers before deciding what else to add. ──
function AutoDetectedMethods({ contact, T }) {
  const detected = [];
  if (contact.phone) detected.push("Phone/WhatsApp");
  if (contact.snapchat) detected.push("Snapchat");
  if (contact.fabguys) detected.push("Fabguys");
  if (contact.fabswingers) detected.push("Fabswingers");
  if (detected.length === 0) return null;
  return (
    <div style={{ padding: "8px 0 0" }}>
      <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 6 }}>Already covered, from the fields above:</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {detected.map((m) => (
          <span key={m} style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: `${T.contactsTeal}15`, color: T.contactsTeal, fontWeight: 600 }}>{m}</span>
        ))}
      </div>
    </div>
  );
}

function AvailabilityRuleBuilder({ rules, onChange, T }) {
  const [draft, setDraft] = useState({ type: "Unavailable", days: [], timeConstraint: "All day", time: "18:00", note: "" });

  const toggleDay = (day) => {
    setDraft((d) => ({ ...d, days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day] }));
  };

  const addRule = () => {
    if (draft.days.length === 0) return;
    const newRule = { id: `rule_${Date.now()}`, ...draft };
    onChange([...rules, newRule]);
    setDraft({ type: "Unavailable", days: [], timeConstraint: "All day", time: "18:00", note: "" });
  };

  const removeRule = (id) => onChange(rules.filter((r) => r.id !== id));

  const describeRule = (r) => {
    const timePart = r.timeConstraint === "All day" ? "all day" : `${r.timeConstraint.toLowerCase()} ${r.time}`;
    return `${r.type} · ${r.days.join(", ")} · ${timePart}${r.note ? ` · ${r.note}` : ""}`;
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Availability exceptions</div>

      {rules.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {rules.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: radius.sm, background: T.surfaceVariant, fontSize: 12, color: T.textPrimary }}>
              <span>{describeRule(r)}</span>
              <Trash2 size={13} color={T.textSecondary} style={{ cursor: "pointer", flexShrink: 0, marginLeft: 8 }} onClick={() => removeRule(r.id)} />
            </div>
          ))}
        </div>
      )}

      <div style={{ border: `1px dashed ${T.border}`, borderRadius: radius.sm, padding: 10 }}>
        <div style={{ display: "flex", background: T.surfaceVariant, borderRadius: radius.full, padding: 3, marginBottom: 8 }}>
          {AVAILABILITY_RULE_TYPES.map((t) => (
            <div key={t} onClick={() => setDraft((d) => ({ ...d, type: t }))}
              style={{ flex: 1, textAlign: "center", padding: "5px 0", borderRadius: radius.full, cursor: "pointer", fontSize: 12, fontWeight: 600, background: draft.type === t ? T.contactsTeal : "transparent", color: draft.type === t ? "#FFFFFF" : T.textSecondary }}>
              {t}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {DAYS_OF_WEEK.map((day) => (
            <div key={day} onClick={() => toggleDay(day)}
              style={{ width: 34, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: radius.sm, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${draft.days.includes(day) ? T.contactsTeal : T.border}`, color: draft.days.includes(day) ? T.contactsTeal : T.textSecondary, background: draft.days.includes(day) ? `${T.contactsTeal}15` : T.surface }}>
              {day}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select value={draft.timeConstraint} onChange={(e) => setDraft((d) => ({ ...d, timeConstraint: e.target.value }))}
            style={{ flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, fontSize: 12 }}>
            {TIME_CONSTRAINT_TYPES.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {draft.timeConstraint !== "All day" && (
            <input type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
              style={{ padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, fontSize: 12 }} />
          )}
        </div>

        <input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))} placeholder="Note (optional, e.g. 'Work')"
          style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surface, color: T.textPrimary, fontSize: 12, boxSizing: "border-box", marginBottom: 8 }} />

        <button onClick={addRule} disabled={draft.days.length === 0}
          style={{ ...btnStyle(draft.days.length === 0 ? T.textDisabled : T.contactsTeal, "outline"), width: "100%", padding: 8, cursor: draft.days.length === 0 ? "default" : "pointer" }}>
          Add rule
        </button>
      </div>
    </div>
  );
}

// ── New this round: link two contacts together (couples, etc.), per
// Kane's ask. Linking is immediate — it calls the repository directly
// and refreshes, rather than waiting for the Save button — because a
// link is a two-party fact touching BOTH contacts' records at once,
// which doesn't fit the "stage changes, Save applies them" pattern the
// rest of this form uses for a single contact's own fields. Only shown
// for contacts that already exist — a brand-new, unsaved contact has no
// real id yet to link against.
//
// Tracks its OWN linkedIds/labels state rather than reading from the
// edit sheet's `form` object — form is seeded once when the sheet opens
// and never told about changes made via direct repository calls, so
// reading from it would show stale data until the sheet was reopened.
//
// Relationship label (new, 18 Aug 2026): picking a contact reveals a
// small optional text field for describing the relationship — "Dom/Sub",
// "bf/gf", etc — with suggestions grown from every label used across all
// contacts, same "type or pick" pattern as kinks. See contactRepository.js
// for why this is one shared label, not a separate role per side.
function LinkedContactsField({ contactId, allContacts, T, refresh }) {
  const [pickerValue, setPickerValue] = useState("");
  const [pendingLabel, setPendingLabel] = useState("");
  const [linkedIds, setLinkedIds] = useState(() => ContactRepository.getById(contactId)?.linkedContactIds || []);
  const [labels, setLabels] = useState(() => ContactRepository.getById(contactId)?.linkedContactLabels || {});
  const linked = allContacts.filter((c) => linkedIds.includes(c.id));
  const linkable = allContacts.filter((c) => c.id !== contactId && !linkedIds.includes(c.id));

  const labelSuggestions = useMemo(() => {
    const all = allContacts.flatMap((c) => Object.values(c.linkedContactLabels || {}));
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
  }, [allContacts]);

  const confirmLink = () => {
    if (!pickerValue) return;
    const label = pendingLabel.trim();
    ContactRepository.linkContacts(contactId, pickerValue, label);
    setLinkedIds((prev) => [...prev, pickerValue]);
    if (label) setLabels((prev) => ({ ...prev, [pickerValue]: label }));
    refresh();
    setPickerValue("");
    setPendingLabel("");
  };
  const removeLink = (id) => {
    ContactRepository.unlinkContacts(contactId, id);
    setLinkedIds((prev) => prev.filter((x) => x !== id));
    setLabels((prev) => { const { [id]: _removed, ...rest } = prev; return rest; });
    refresh();
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Linked contacts (e.g. couples)</div>
      {linked.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {linked.map((c) => (
            <div key={c.id} onClick={() => removeLink(c.id)}
              style={{ padding: "6px 10px", borderRadius: radius.sm, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{displayName(c)}{labels[c.id] ? ` — ${labels[c.id]}` : ""}</span>
              <X size={11} />
            </div>
          ))}
        </div>
      )}
      {linkable.length > 0 && (
        <>
          <select value={pickerValue} onChange={(e) => setPickerValue(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 13, marginBottom: pickerValue ? 6 : 0 }}>
            <option value="">+ Link another contact</option>
            {linkable.map((c) => <option key={c.id} value={c.id}>{displayName(c)}</option>)}
          </select>
          {pickerValue && (
            <div style={{ display: "flex", gap: 6 }}>
              <input list="link-label-suggestions" value={pendingLabel} onChange={(e) => setPendingLabel(e.target.value)}
                placeholder="Relationship (optional) — e.g. Dom/Sub, bf/gf"
                style={{ flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 12, boxSizing: "border-box" }} />
              <datalist id="link-label-suggestions">
                {labelSuggestions.map((s) => <option key={s} value={s} />)}
              </datalist>
              <button onClick={confirmLink} style={{ ...btnStyle(T.contactsTeal, "filled"), flex: "0 0 auto", padding: "8px 14px" }}>Link</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function ContactCard({ contact, onOpen, T }) {
  const flaggedDontMeetAgain = contact.meetAgain === "No";
  const methods = getContactableVia(contact);
  return (
    <div onClick={() => onOpen(contact.id)}
      style={{ background: T.surface, border: `1px solid ${flaggedDontMeetAgain ? T.actionRed : T.border}`, borderRadius: radius.md, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.06)", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ width: 8, height: 8, borderRadius: radius.full, background: T.contactsTeal, display: "inline-block" }} />
        <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 600, fontSize: 15, color: T.textPrimary }}>{displayName(contact)}</span>
        {/* Age — tuned this round to sit close in size to the name (was
            too small a jump, 12px vs 15px reading as a much bigger drop
            than intended). Now 14px, one step down, not two. */}
        {contact.age != null && <span style={{ fontSize: 14, color: T.textSecondary }}>· {contact.ageIsApprox ? "≈" : ""}{contact.age}</span>}
        <MethodIcons methods={methods} T={T} />
        {contact.city && <span style={{ fontSize: 12, color: T.textSecondary }}>· {contact.city}</span>}
        {contact.drives && <Car size={13} color={T.textSecondary} />}
        {contact.linkedContactIds.length > 0 && <Link2 size={13} color={T.contactsTeal} />}
        {flaggedDontMeetAgain && <AlertTriangle size={13} color={T.actionRed} />}
      </div>
      {contact.relationshipType.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginLeft: 16, marginTop: 4, flexWrap: "wrap" }}>
          {contact.relationshipType.map((rt) => (
            <span key={rt} style={{ fontSize: 10, fontWeight: 600, color: T.contactsTeal, background: `${T.contactsTeal}15`, borderRadius: radius.full, padding: "2px 8px" }}>{rt}</span>
          ))}
        </div>
      )}
      {flaggedDontMeetAgain ? (
        <div style={{ fontSize: 12, color: T.actionRed, fontWeight: 600, marginLeft: 16, marginTop: 4 }}>Don't meet again</div>
      ) : (
        <div style={{ fontSize: 12, color: T.textDisabled, fontStyle: "italic", marginLeft: 16, marginTop: 4 }}>
          Last interaction — not tracked yet
        </div>
      )}
    </div>
  );
}

// ── Add/Edit sheet — every section now lives inside its own SectionCard
// (outlined box), per Kane's ask. Location & logistics reordered to:
// Hosts, Travels, Address, City, Drives (+ car details), Availability,
// availability exceptions, Readily available. ──
function ContactEditSheet({ contact, contacts, onSave, onClose, refresh, T }) {
  const isNew = !contact;
  const [form, setForm] = useState(() => contact ? { ...contact } : { ...DEFAULT_CONTACT });
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canSave = form.name.trim().length > 0;

  const cityOptions = useMemo(() => getKnownCities(contacts), [contacts]);
  const addressOptions = useMemo(() => getKnownAddresses(contacts), [contacts]);
  const contactableViaOptions = useMemo(() => getKnownValues(contacts, "contactableVia"), [contacts]);
  // kinkOptions/limitOptions/chemOptions removed 18 Aug 2026 — Stated
  // kinks/Limits/Known chems below now pull suggestions directly from
  // KinkRegistry/ChemsRegistry instead of scanning other contacts'
  // freeform tags.
  const howMetOptions = useMemo(() => getKnownValues(contacts, "howDidWeMeet"), [contacts]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={onClose}>
      <div data-contact-sheet style={{ background: T.bg, width: "100%", maxHeight: "88vh", overflowY: "auto", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: T.bg, paddingBottom: 4, zIndex: 1 }}>
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>{isNew ? "Add contact" : "Edit contact"}</span>
          <X size={18} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        <SectionCard T={T} title="Identity">
          <TextField T={T} label="Name" value={form.name} onChange={set("name")} placeholder="Name" />
          <TextField T={T} label="Nickname (shown instead of name, if set)" value={form.nickname} onChange={set("nickname")} placeholder="Optional" />
          <AgeField T={T} age={form.age} ageIsApprox={form.ageIsApprox} onChangeAge={set("age")} onChangeApprox={set("ageIsApprox")} />
        </SectionCard>

        <SectionCard T={T} title="Relationship">
          <MultiSelectChips T={T} label="Relationship type" value={form.relationshipType} onChange={set("relationshipType")} options={RELATIONSHIP_TYPE_OPTIONS} />
          <TagInput T={T} label="How did we meet?" value={form.howDidWeMeet} onChange={set("howDidWeMeet")} suggestions={howMetOptions} />
          <SelectField T={T} label="Meet again?" value={form.meetAgain} onChange={set("meetAgain")} options={MEET_AGAIN_OPTIONS} />
          {form.meetAgain === "No" && (
            <TextField T={T} label="Reason" value={form.dontMeetAgainReason} onChange={set("dontMeetAgainReason")} placeholder="Optional, but helps future-you remember why" />
          )}
        </SectionCard>

        <SectionCard T={T} title="Location & logistics">
          <SelectField T={T} label="Hosts" value={form.hosts} onChange={set("hosts")} options={HOSTS_OPTIONS} />
          <SelectField T={T} label="Travels" value={form.travels} onChange={set("travels")} options={TRAVELS_OPTIONS} />
          <ComboField T={T} label="Address" value={form.address} onChange={set("address")} options={addressOptions}
            placeholder="Street, city, postcode — or pick a previous one" />
          <ComboField T={T} label="City" value={form.city} onChange={set("city")} options={cityOptions} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ fontSize: 13, color: T.textPrimary }}>Drives</span>
            <ToggleSwitch T={T} value={form.drives} onChange={set("drives")} />
          </div>
          {form.drives && (
            <TextField T={T} label="Car details" value={form.carDetails} onChange={set("carDetails")} placeholder="e.g. Blue Ford Focus, reg ABC123" />
          )}
          <MultiSelectChips T={T} label="Availability" value={form.availability} onChange={set("availability")} options={AVAILABILITY_OPTIONS} />
          <AvailabilityRuleBuilder T={T} rules={form.nonAvailabilityRules} onChange={set("nonAvailabilityRules")} />
          <SelectField T={T} label="Readily available?" value={form.readilyAvailable} onChange={set("readilyAvailable")} options={READILY_AVAILABLE_OPTIONS} />
        </SectionCard>

        <SectionCard T={T} title="Kink">
          <RegistryTagPicker T={T} label="Stated kinks" value={form.statedKinks} onChange={set("statedKinks")} registry={KinkRegistry} />
          <RegistryTagPicker T={T} label="Limits" value={form.limits} onChange={set("limits")} registry={KinkRegistry} />
          <MultiSelectChips T={T} label="Role" value={form.bdsmRole} onChange={set("bdsmRole")} options={BDSM_ROLE_OPTIONS} />
          <MultiSelectChips T={T} label="Position" value={form.sexualPosition} onChange={set("sexualPosition")} options={SEXUAL_POSITION_OPTIONS} />
        </SectionCard>

        {/* Own section, not folded into Kink — Notion keeps the Chems
            Registry architecturally separate (neutral grey domain, not
            kink-red, per Doc 2), so the app mirrors that distinction. */}
        <SectionCard T={T} title="Chems">
          <RegistryTagPicker T={T} label="Known chems" value={form.knownChems} onChange={set("knownChems")} registry={ChemsRegistry} placeholder="e.g. Alcohol, Weed, Poppers, Coke, LSD" />
        </SectionCard>

        <SectionCard T={T} title="Physical & health">
          <SelectField T={T} label="Length" value={form.length} onChange={set("length")} options={LENGTH_OPTIONS} />
          <SelectField T={T} label="Thickness" value={form.thickness} onChange={set("thickness")} options={THICKNESS_OPTIONS} />
          <SelectField T={T} label="Foreskin" value={form.foreskin} onChange={set("foreskin")} options={FORESKIN_OPTIONS} />
          <SelectField T={T} label="Chastity status" value={form.chastityStatus} onChange={set("chastityStatus")} options={CHASTITY_OPTIONS} />
          <MultiSelectChips T={T} label="Cummer" value={form.cummer} onChange={set("cummer")} options={CUMMER_OPTIONS} />
          <MultiSelectChips T={T} label="Known to be on" value={form.knownPrepDoxy} onChange={set("knownPrepDoxy")} options={PREP_DOXY_OPTIONS} />
          <TextField T={T} label="Last tested date (if known)" value={form.lastTestedDate} onChange={set("lastTestedDate")} type="date" helper="Often unknown — leave blank, no pressure." />
        </SectionCard>

        <SectionCard T={T} title="Notes">
          <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3} placeholder="Anything worth remembering"
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
        </SectionCard>

        <SectionCard T={T} title="Contact methods">
          <TextField T={T} label="Phone/WhatsApp" value={form.phone} onChange={set("phone")} placeholder="e.g. +44 7700 900123" />
          <TextField T={T} label="Snapchat" value={form.snapchat} onChange={set("snapchat")} />
          <TextField T={T} label="Fabguys" value={form.fabguys} onChange={set("fabguys")} />
          <TextField T={T} label="Fabswingers" value={form.fabswingers} onChange={set("fabswingers")} />
          <AutoDetectedMethods T={T} contact={form} />
          <TagInput T={T} label="Other platforms" value={form.contactableVia} onChange={set("contactableVia")} suggestions={contactableViaOptions} placeholder="e.g. Tinder, Bumble, Grindr" />
        </SectionCard>

        {!isNew && (
          <SectionCard T={T} title="Linked contacts">
            <LinkedContactsField T={T} contactId={form.id} allContacts={contacts} refresh={refresh} />
          </SectionCard>
        )}

        <button onClick={() => canSave && onSave(form)} style={{ ...btnStyle(canSave ? T.contactsTeal : T.textDisabled, "filled"), width: "100%", padding: 12, marginTop: 16, cursor: canSave ? "pointer" : "default" }}>
          {isNew ? "Add contact" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function ReadRow({ label, value, T }) {
  if (value === "" || value == null || (Array.isArray(value) && value.length === 0) || value === false) return null;
  const display = Array.isArray(value) ? value.join(", ") : value === true ? "Yes" : value;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
      <span style={{ color: T.textSecondary }}>{label}</span>
      <span style={{ color: T.textPrimary, fontWeight: 500, textAlign: "right" }}>{display}</span>
    </div>
  );
}

function describeAvailabilityRule(r) {
  const timePart = r.timeConstraint === "All day" ? "all day" : `${r.timeConstraint.toLowerCase()} ${r.time}`;
  return `${r.type} · ${r.days.join(", ")} · ${timePart}${r.note ? ` · ${r.note}` : ""}`;
}

// ── Contact Profile — same SectionCard treatment and reordered
// Location & logistics as the edit sheet, plus the don't-meet-again
// warning banner. ──
function ContactProfile({ contactId, onBack, onEdit, onOpenContact, T, refresh }) {
  const contact = ContactRepository.getById(contactId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  if (!contact) return null;

  const archive = () => { ContactRepository.archive(contact.id); refresh(); onBack(); };
  const flaggedDontMeetAgain = contact.meetAgain === "No";
  const methods = getContactableVia(contact);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
          <span style={{ fontSize: 18, fontWeight: 700, color: T.textPrimary }}>{displayName(contact)}</span>
        </div>
        <div style={{ position: "relative" }}>
          <MoreVertical size={20} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={() => setMenuOpen((o) => !o)} />
          {menuOpen && (
            <>
              <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
              <div style={{ position: "absolute", top: 28, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.sm, boxShadow: "0 4px 16px rgba(0,0,0,.15)", zIndex: 40, minWidth: 170, overflow: "hidden" }}>
                <div onClick={() => { onEdit(contact.id); setMenuOpen(false); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  <Settings2 size={14} color={T.textSecondary} /> Edit contact
                </div>
                <div onClick={() => { setConfirmArchive(true); setMenuOpen(false); }} style={{ padding: "10px 14px", fontSize: 13, color: T.actionRed, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                  <Archive size={14} /> Archive contact
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {flaggedDontMeetAgain && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}15`, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={16} color={T.actionRed} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.actionRed }}>Marked: don't meet again</div>
            {contact.dontMeetAgainReason && <div style={{ fontSize: 12, color: T.textPrimary, marginTop: 2 }}>{contact.dontMeetAgainReason}</div>}
          </div>
        </div>
      )}

      {confirmArchive && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
            Archiving hides this contact from the list — it stays intact and can be restored later.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={archive} style={{ ...btnStyle(T.actionRed, "filled"), padding: "8px 10px" }}>Confirm archive</button>
            <button onClick={() => setConfirmArchive(false)} style={{ ...btnStyle(T.textSecondary, "outline"), padding: "8px 10px" }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
          <span style={{ width: 14, height: 14, borderRadius: radius.full, background: T.contactsTeal, display: "inline-block" }} />
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 700, fontSize: 20, color: T.textPrimary }}>{displayName(contact)}</span>
          {contact.age != null && <span style={{ fontSize: 15, color: T.textSecondary }}>{contact.ageIsApprox ? "≈" : ""}{contact.age}</span>}
          <MethodIcons methods={methods} T={T} size={16} />
        </div>
        {contact.nickname && <div style={{ fontSize: 12, color: T.textDisabled, marginLeft: 24 }}>Full name: {contact.name}</div>}

        <SectionCard T={T} title="Relationship">
          <ReadRow T={T} label="Relationship type" value={contact.relationshipType} />
          <ReadRow T={T} label="How did we meet?" value={contact.howDidWeMeet} />
          <ReadRow T={T} label="Meet again?" value={contact.meetAgain} />
        </SectionCard>

        <SectionCard T={T} title="Location & logistics">
          <ReadRow T={T} label="Hosts" value={contact.hosts} />
          <ReadRow T={T} label="Travels" value={contact.travels} />
          <ReadRow T={T} label="Address" value={contact.address} />
          <ReadRow T={T} label="City" value={contact.city} />
          <ReadRow T={T} label="Drives" value={contact.drives} />
          <ReadRow T={T} label="Car details" value={contact.carDetails} />
          <ReadRow T={T} label="Availability" value={contact.availability} />
          {contact.nonAvailabilityRules?.length > 0 && (
            <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
              <div style={{ color: T.textSecondary, marginBottom: 4 }}>Availability exceptions</div>
              {contact.nonAvailabilityRules.map((r) => (
                <div key={r.id} style={{ color: T.textPrimary, fontSize: 12, marginBottom: 2 }}>{describeAvailabilityRule(r)}</div>
              ))}
            </div>
          )}
          <ReadRow T={T} label="Readily available?" value={contact.readilyAvailable} />
        </SectionCard>

        <SectionCard T={T} title="Kink">
          <ReadRow T={T} label="Stated kinks" value={contact.statedKinks.map((id) => KinkRegistry.getById(id)?.name).filter(Boolean)} />
          <ReadRow T={T} label="Limits" value={contact.limits.map((id) => KinkRegistry.getById(id)?.name).filter(Boolean)} />
          <ReadRow T={T} label="Role" value={contact.bdsmRole} />
          <ReadRow T={T} label="Position" value={contact.sexualPosition} />
        </SectionCard>

        <SectionCard T={T} title="Chems">
          <ReadRow T={T} label="Known chems" value={contact.knownChems.map((id) => ChemsRegistry.getById(id)?.name).filter(Boolean)} />
        </SectionCard>

        <SectionCard T={T} title="Physical & health">
          <ReadRow T={T} label="Length" value={contact.length} />
          <ReadRow T={T} label="Thickness" value={contact.thickness} />
          <ReadRow T={T} label="Foreskin" value={contact.foreskin} />
          <ReadRow T={T} label="Chastity status" value={contact.chastityStatus} />
          <ReadRow T={T} label="Cummer" value={contact.cummer} />
          <ReadRow T={T} label="Known to be on" value={contact.knownPrepDoxy} />
          <ReadRow T={T} label="Last tested" value={contact.lastTestedDate} />
        </SectionCard>

        <SectionCard T={T} title="Notes">
          <div style={{ fontSize: 14, color: contact.notes ? T.textPrimary : T.textDisabled, fontStyle: contact.notes ? "normal" : "italic" }}>
            {contact.notes || "No notes yet."}
          </div>
        </SectionCard>

        <SectionCard T={T} title="Contact methods">
          <ReadRow T={T} label="Contactable via" value={methods} />
          <ReadRow T={T} label="Phone/WhatsApp" value={contact.phone} />
          <ReadRow T={T} label="Snapchat" value={contact.snapchat} />
          <ReadRow T={T} label="Fabguys" value={contact.fabguys} />
          <ReadRow T={T} label="Fabswingers" value={contact.fabswingers} />
        </SectionCard>

        {contact.linkedContactIds.length > 0 && (
          <SectionCard T={T} title="Linked contacts">
            {ContactRepository.getAll()
              .filter((c) => contact.linkedContactIds.includes(c.id))
              .map((c) => (
                <div key={c.id} onClick={() => onOpenContact(c.id)}
                  style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.contactsTeal, fontWeight: 600, cursor: "pointer" }}>
                  {displayName(c)}
                </div>
              ))}
          </SectionCard>
        )}

        <SectionCard T={T} title="Timeline">
          {(() => {
            const allEncounters = EncounterRepository.getAll();
            const summary = contactEncounterSummary(allEncounters, contact.id);
            const history = sortByDateDesc(
              allEncounters.filter((e) => e.attendeeIds.includes(contact.id) && !e.isArchived)
            );
            if (summary.count === 0) {
              return (
                <div style={{ fontSize: 13, color: T.textDisabled, fontStyle: "italic", textAlign: "center", padding: "16px 4px" }}>
                  No encounters logged with this contact yet.
                </div>
              );
            }
            return (
              <>
                <div style={{ display: "flex", gap: 16, padding: "8px 0 14px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: "monospace" }}>{summary.count}</div>
                    <div style={{ fontSize: 11, color: T.textSecondary }}>Encounters</div>
                  </div>
                  {summary.averageEnjoyment != null && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: "monospace" }}>{Math.round(summary.averageEnjoyment)}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>Avg enjoyment</div>
                    </div>
                  )}
                  {summary.highestEnjoyment != null && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: "monospace" }}>{summary.highestEnjoyment}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>Highest</div>
                    </div>
                  )}
                  {summary.lastInteraction && (
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary, fontFamily: "monospace" }}>{formatRelativeDate(summary.lastInteraction)}</div>
                      <div style={{ fontSize: 11, color: T.textSecondary }}>Last seen</div>
                    </div>
                  )}
                </div>
                {history.map((e) => (
                  <div key={e.id} style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
                    <div style={{ color: T.textPrimary, fontWeight: 600 }}>{e.title || "Untitled encounter"}</div>
                    <div style={{ color: T.textSecondary, fontSize: 12 }}>{e.date ? new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No date"}</div>
                  </div>
                ))}
              </>
            );
          })()}
        </SectionCard>
      </div>
    </div>
  );
}

// ── Contacts List ──
function ContactsList({ contacts, onOpen, onAdd, T, sortBy, setSortBy, query, setQuery }) {
  const activeContacts = useMemo(() => contacts.filter((c) => !c.isArchived), [contacts]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = q
      ? activeContacts.filter((c) =>
          [c.name, c.nickname, c.phone, c.snapchat, c.fabguys, c.fabswingers, c.notes]
            .some((field) => (field || "").toLowerCase().includes(q))
          || [...c.statedKinks, ...c.limits]
              .map((id) => KinkRegistry.getById(id)?.name || "")
              .some((name) => name.toLowerCase().includes(q))
        )
      : activeContacts;
    const sorted = [...searched].sort((a, b) => {
      if (sortBy === "newest") return new Date(b.createdAt) - new Date(a.createdAt);
      if (sortBy === "oldest") return new Date(a.createdAt) - new Date(b.createdAt);
      if (sortBy === "incomplete") return getCompletenessScore(a) - getCompletenessScore(b);
      return displayName(a).localeCompare(displayName(b));
    });
    return sorted;
  }, [activeContacts, query, sortBy]);

  return (
    <div>
      <div style={{ padding: "18px 16px 2px" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary }}>Contacts</span>
      </div>
      <div style={{ padding: "0 16px 12px", fontSize: 12, color: T.textSecondary }}>
        {activeContacts.length} active
      </div>

      <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <Search size={16} color={T.textSecondary} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'Public Sans', sans-serif", fontSize: 14, color: T.textPrimary }} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "0 16px 14px", overflowX: "auto" }}>
        {[
          { key: "name", label: "A–Z" },
          { key: "newest", label: "Newest" },
          { key: "oldest", label: "Oldest" },
          { key: "incomplete", label: "Incomplete" },
        ].map((opt) => (
          <div key={opt.key} onClick={() => setSortBy(opt.key)}
            style={{ padding: "6px 12px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", border: `1px solid ${sortBy === opt.key ? T.contactsTeal : T.border}`, color: sortBy === opt.key ? T.contactsTeal : T.textSecondary }}>
            {opt.label}
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: T.textDisabled, fontSize: 13 }}>
          {activeContacts.length === 0 ? "No contacts yet." : "No contacts match your search."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 100px" }}>
          {filtered.map((c) => <ContactCard key={c.id} contact={c} onOpen={onOpen} T={T} />)}
        </div>
      )}

      <div style={{ position: "fixed", bottom: 76, width: 390, display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
        <div onClick={onAdd} style={{ width: 56, height: 56, borderRadius: radius.full, background: T.fabBg, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto", boxShadow: "0 2px 8px rgba(0,0,0,.25)", cursor: "pointer" }}>
          <Plus size={24} color={T.fabIcon} />
        </div>
      </div>
    </div>
  );
}

export default function ContactsModule() {
  const [contacts, setContacts] = useState(() => loadContacts());
  const refresh = () => setContacts(loadContacts());

  const [screen, setScreen] = useState("list");
  const [activeContactId, setActiveContactId] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [query, setQuery] = useState("");
  const T = LIGHT;

  const openProfile = (id) => { setActiveContactId(id); setScreen("profile"); };
  const backToList = () => { setScreen("list"); refresh(); };

  const saveEdit = (form) => {
    if (editingContact && editingContact.id) {
      ContactRepository.update(editingContact.id, form);
    } else {
      ContactRepository.create(form);
    }
    refresh();
    setEditingContact(null);
  };

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif", background: T.bg, minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ width: 390, background: T.bg, minHeight: "100vh", borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}` }}>
        {screen === "list" ? (
          <ContactsList contacts={contacts} T={T} onOpen={openProfile} onAdd={() => setEditingContact({})} sortBy={sortBy} setSortBy={setSortBy} query={query} setQuery={setQuery} />
        ) : (
          <ContactProfile contactId={activeContactId} T={T} onBack={backToList} onEdit={(id) => setEditingContact(ContactRepository.getById(id))} onOpenContact={openProfile} refresh={refresh} />
        )}

        {editingContact !== null && (
          <ContactEditSheet contact={editingContact.id ? editingContact : null} contacts={contacts} onSave={saveEdit} onClose={() => setEditingContact(null)} refresh={refresh} T={T} />
        )}

        <div style={{ position: "fixed", bottom: 0, width: 390, background: T.surface, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-around", padding: "10px 0 14px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <Users size={22} color={T.navActive} strokeWidth={2.5} />
            <span style={{ fontSize: 10, color: T.navActive, fontWeight: 600 }}>Contacts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
