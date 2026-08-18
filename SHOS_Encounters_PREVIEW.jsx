import React, { useState, useMemo } from "react";
import { Plus, ChevronLeft, MoreVertical, X, Archive, Users, MapPin, Heart } from "lucide-react";

// ──────────────────────────────────────────────────────────────────
// PREVIEW BUNDLE — for Claude's in-chat preview only. Memory-only (no
// persistence) because Claude's preview can't use localStorage — same
// treatment as SHOS_Contacts_PREVIEW.jsx. Includes a MINIMAL, memory-
// only ContactRepository stub (just id/name/nickname/isArchived) so
// the Attendee picker has something to pick from in isolation — it is
// NOT the real ContactRepository and doesn't need to be; the real
// modular file (SHOS_Encounters_Prototype.jsx) imports the real one.
// Real source of truth: encounterRepository.js, encounterCalculations.js,
// SHOS_Encounters_Prototype.jsx. Don't edit this bundle directly — edit
// the modular files and regenerate.
// ──────────────────────────────────────────────────────────────────

const LIGHT = {
  bg: "#F0F0F3", surface: "#FFFFFF", surfaceVariant: "#E7E7EB", border: "#DCDCE1",
  textPrimary: "#1B1B1F", textSecondary: "#5B5B62", textDisabled: "#9A9AA1",
  encountersPink: "#E24E9C", actionRed: "#E5484D", actionGreen: "#1B9E77",
  navActive: "#E24E9C", fabBg: "#1B1B1F", fabIcon: "#FFFFFF",
};
const radius = { sm: 8, md: 16, lg: 24, full: 999 };

// ── Minimal memory-only Contact stub, preview-only ──
let previewContacts = [
  { id: "contact_001", name: "Alex", nickname: "", isArchived: false },
  { id: "contact_002", name: "Jordan", nickname: "", isArchived: false },
  { id: "contact_003", name: "Sam", nickname: "", isArchived: false },
];
const ContactRepository = {
  getAll() { return structuredClone(previewContacts); },
};
function contactName(contacts, id) {
  const c = contacts.find((c) => c.id === id);
  return c ? (c.nickname || c.name) : "Unknown";
}

// ── Memory-only registries (Kink/Chems/Protection/Symptoms + Locations),
// same simpleRegistry.js factory logic inlined for the preview panel —
// see kinkRegistry.js etc. for the real, persisted versions. ──
function makeSimpleRegistry(idPrefix, seedNames) {
  let entries = seedNames.map((name, i) => ({ id: `${idPrefix}_${String(i + 1).padStart(3, "0")}`, name, isArchived: false }));
  let next = entries.length + 1;
  return {
    getAll() { return structuredClone(entries); },
    getById(id) { const f = entries.find((e) => e.id === id); return f ? structuredClone(f) : null; },
    getByName(name) { const f = entries.find((e) => e.name.toLowerCase() === name.toLowerCase()); return f ? structuredClone(f) : null; },
    create(data) { const e = { name: "", ...data, id: `${idPrefix}_${String(next).padStart(3, "0")}`, isArchived: false }; next += 1; entries = [...entries, e]; return e; },
    findOrCreate(name) { const t = name.trim(); if (!t) return null; const existing = this.getByName(t); return existing || this.create({ name: t }); },
    update(id, changes) { let u = null; entries = entries.map((e) => { if (e.id !== id) return e; u = { ...e, ...changes }; return u; }); return u; },
    archive(id) { return this.update(id, { isArchived: true }); },
    unarchive(id) { return this.update(id, { isArchived: false }); },
  };
}
const KinkRegistry = makeSimpleRegistry("kink", ["Impact Play", "Praise", "Rimming", "Fisting"]);
const ChemsRegistry = makeSimpleRegistry("chem", []);
const ProtectionRegistry = makeSimpleRegistry("protection", ["Condom", "PrEP", "None"]);
const SymptomsRegistry = makeSimpleRegistry("symptom_cat", []);
// Locations has a richer shape than the trivial factory (Type, address,
// Notes) — see locationsRepository.js for the real version. This
// preview-only variant still supports findOrCreate for the picker.
let previewLocations = [{ id: "location_001", name: "Home", type: "My House", isArchived: false }];
let nextLocationNumber = 2;
const LocationsRepository = {
  getAll() { return structuredClone(previewLocations); },
  getById(id) { const f = previewLocations.find((l) => l.id === id); return f ? structuredClone(f) : null; },
  getByName(name) { const f = previewLocations.find((l) => l.name.toLowerCase() === name.toLowerCase()); return f ? structuredClone(f) : null; },
  create(data) { const l = { name: "", type: "", address: "", notes: "", relatedContactId: "", ...data, id: `location_${String(nextLocationNumber).padStart(3, "0")}`, isArchived: false }; nextLocationNumber += 1; previewLocations = [...previewLocations, l]; return l; },
  findOrCreate(name) { const t = name.trim(); if (!t) return null; const existing = this.getByName(t); return existing || this.create({ name: t }); },
};

// ── encounterRepository.js (inlined, memory-only — see file header) ──

const ENCOUNTER_TYPE_OPTIONS = ["Hookup", "Group", "Date/Chill", "Sauna", "Event", "Other"];
const MY_POSITION_OPTIONS = [
  "Fingering - giving", "Fingering - receiving", "Oral - giving", "Oral - receiving",
  "Rimming - giving", "Rimming - receiving", "Anal – top", "Anal - bottom",
  "Kissing", "Cuddling", "Groping", "Mutual masturbation", "Kink", "Toys",
];
const CUM_LOCATION_OPTIONS = [
  "Internal - Mouth", "Internal - Ass", "Internal - Vagina",
  "External - Body/Face", "External - Hand", "Didn't happen",
];
const MY_ROLE_OPTIONS = ["Vanilla / N/A", "Sub", "Switch", "Dom", "Neither", "Dom, Switch", "N/A"];
const PREP_COVERAGE_OPTIONS = [
  "Adequate - daily (≥4/week)", "Adequate - Event-based (2-1-1)",
  "Missed dose", "Inadequate/recently started", "Not on PrEP",
];
const DOXYPEP_STATUS_OPTIONS = [
  "Not indicated", "Indicated - taken", "Indicated - not yet taken",
  "Indicated - missed window", "N/A",
];
const WOULD_MEET_AGAIN_OPTIONS = ["Fuck YES 💖", "Yes", "If he makes effort", "Maybe", "No"];

const DEFAULT_ENCOUNTER = {
  title: "", date: "", dateEnd: "", isDateTime: false, encounterType: "",
  attendeeIds: [], locationId: "", myPosition: [], kinksInvolved: [], myRole: "",
  whereICame: [], whereHeCame: [], myDoxyPepStatus: "", myPrepCoverage: "",
  chemsAlcoholUsed: [], wouldMeetAgain: "", protectionUsed: [], followUpNeeded: false,
  notes: "", enjoymentRating: null, symptomsNoted: [],
};

let encounters = [
  { ...DEFAULT_ENCOUNTER, id: "encounter_001", title: "Alex — coffee then back to his", date: "2026-07-20T19:30:00.000Z", isDateTime: true, encounterType: "Date/Chill", attendeeIds: ["contact_001"], myRole: "Switch", enjoymentRating: 85, wouldMeetAgain: "Yes", notes: "Second time meeting up.", createdAt: "2026-07-20T21:00:00.000Z", isArchived: false },
  { ...DEFAULT_ENCOUNTER, id: "encounter_002", title: "Sauna trip", date: "2026-08-02T15:00:00.000Z", isDateTime: true, encounterType: "Sauna", attendeeIds: ["contact_002", "contact_003"], myRole: "Dom, Switch", enjoymentRating: 70, createdAt: "2026-08-02T18:00:00.000Z", isArchived: false },
];
function persist() { /* no-op in Claude's preview */ }
function computeNextEncounterNumber(existing) {
  const numbers = existing.map((e) => { const m = /^encounter_(\d+)$/.exec(e.id); return m ? parseInt(m[1], 10) : 0; });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
let nextEncounterNumber = computeNextEncounterNumber(encounters);
function generateEncounterId() {
  const id = `encounter_${String(nextEncounterNumber).padStart(3, "0")}`;
  nextEncounterNumber += 1;
  return id;
}
const EncounterRepository = {
  getAll() { return structuredClone(encounters); },
  getById(id) { const f = encounters.find((e) => e.id === id); return f ? structuredClone(f) : null; },
  getByAttendee(contactId) { return structuredClone(encounters.filter((e) => e.attendeeIds.includes(contactId))); },
  create(data) {
    const newEncounter = { ...DEFAULT_ENCOUNTER, ...data, id: generateEncounterId(), createdAt: new Date().toISOString(), isArchived: false };
    encounters = [...encounters, newEncounter];
    persist();
    return newEncounter;
  },
  update(id, changes) {
    let updated = null;
    encounters = encounters.map((e) => { if (e.id !== id) return e; updated = { ...e, ...changes }; return updated; });
    persist();
    return updated;
  },
  archive(id) { return this.update(id, { isArchived: true }); },
  unarchive(id) { return this.update(id, { isArchived: false }); },
};

// ── encounterCalculations.js (inlined) ──

function timeOfDay(dateString) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  const hour = d.getHours();
  if (hour < 5) return "Late Night";
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  if (hour < 21) return "Evening";
  return "Night";
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
function sortByDateDesc(list) {
  return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ── Shared form primitives (same shapes as the modular file) ──

function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.encountersPink, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}
function TextField({ label, value, onChange, T, placeholder, type = "text" }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input type={type} value={value ?? ""}
        onChange={(e) => onChange(type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}
function DateTimeField({ label, value, onChange, T }) {
  const inputVal = value ? new Date(value).toISOString().slice(0, 16) : "";
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input type="datetime-local" value={inputVal}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
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
function MultiSelectChips({ label, value, onChange, options, T }) {
  const toggle = (opt) => { const has = value.includes(opt); onChange(has ? value.filter((v) => v !== opt) : [...value, opt]); };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <div key={opt} onClick={() => toggle(opt)}
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.encountersPink : T.border}`, color: active ? T.encountersPink : T.textSecondary, background: active ? `${T.encountersPink}15` : "transparent" }}>
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function RegistryTagPicker({ label, value, onChange, T, registry, placeholder }) {
  const [draft, setDraft] = useState("");
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const nameFor = (id) => allEntries.find((e) => e.id === id)?.name || registry.getById(id)?.name || "?";
  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      const entry = registry.findOrCreate(trimmed);
      if (entry && !value.includes(entry.id)) onChange([...value, entry.id]);
    }
    setDraft("");
  };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {value.map((id) => (
          <div key={id} style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, border: `1px solid ${T.border}`, color: T.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
            {nameFor(id)}
            <X size={11} style={{ cursor: "pointer" }} onClick={() => onChange(value.filter((v) => v !== id))} />
          </div>
        ))}
      </div>
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        list={`registry-${label.replace(/\s+/g, "-")}`}
        placeholder={placeholder || "Pick existing or type a new one"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      <datalist id={`registry-${label.replace(/\s+/g, "-")}`}>
        {allEntries.map((e) => <option key={e.id} value={e.name} />)}
      </datalist>
    </div>
  );
}
function RegistrySinglePicker({ label, value, onChange, T, registry, placeholder }) {
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const current = value ? (allEntries.find((e) => e.id === value)?.name || registry.getById(value)?.name || "") : "";
  const [draft, setDraft] = useState(current);
  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) { onChange(""); return; }
    const entry = registry.findOrCreate(trimmed);
    if (entry) onChange(entry.id);
  };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        list={`registry-single-${label.replace(/\s+/g, "-")}`}
        placeholder={placeholder || "Pick existing or type a new one"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      <datalist id={`registry-single-${label.replace(/\s+/g, "-")}`}>
        {allEntries.map((e) => <option key={e.id} value={e.name} />)}
      </datalist>
    </div>
  );
}
function AttendeePicker({ value, onChange, T, contacts }) {
  const toggle = (id) => { const has = value.includes(id); onChange(has ? value.filter((v) => v !== id) : [...value, id]); };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Attendees</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {contacts.filter((c) => !c.isArchived).map((c) => {
          const active = value.includes(c.id);
          return (
            <div key={c.id} onClick={() => toggle(c.id)}
              style={{ padding: "6px 12px", borderRadius: radius.full, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.encountersPink : T.border}`, color: active ? T.encountersPink : T.textSecondary, background: active ? `${T.encountersPink}15` : "transparent" }}>
              {c.nickname || c.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function ReadRow({ label, value, T }) {
  const display = Array.isArray(value) ? value.join(", ") : value;
  if (!display && display !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13 }}>
      <span style={{ color: T.textSecondary }}>{label}</span>
      <span style={{ color: T.textPrimary, fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{display}</span>
    </div>
  );
}

function EncounterCard({ encounter, contacts, T, onClick }) {
  const attendeeNames = encounter.attendeeIds.map((id) => contactName(contacts, id));
  const shown = attendeeNames.slice(0, 3);
  const extra = attendeeNames.length - shown.length;
  const locationName = encounter.locationId ? (LocationsRepository.getById(encounter.locationId)?.name || "") : "";
  const kinkNames = encounter.kinksInvolved.map((id) => KinkRegistry.getById(id)?.name).filter(Boolean);
  return (
    <div onClick={onClick} style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: 14, marginBottom: 10, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            <div style={{ width: 8, height: 8, borderRadius: radius.full, background: T.encountersPink }} />
            <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 700, fontSize: 15, color: T.textPrimary }}>{encounter.title || "Untitled encounter"}</span>
          </div>
          <div style={{ fontSize: 12, color: T.textSecondary }}>
            {encounter.date ? `${new Date(encounter.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${formatRelativeDate(encounter.date)}` : "No date"}
            {encounter.encounterType ? ` · ${encounter.encounterType}` : ""}
          </div>
        </div>
        {encounter.enjoymentRating != null && (
          <div style={{ fontSize: 12, fontFamily: "monospace", color: T.textSecondary, display: "flex", alignItems: "center", gap: 3 }}>
            <Heart size={12} color={T.encountersPink} /> {encounter.enjoymentRating}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
        {shown.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: T.textSecondary }}>
            <Users size={13} />
            {shown.join(", ")}{extra > 0 ? ` +${extra}` : ""}
          </div>
        )}
        {locationName && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: T.textSecondary }}>
            <MapPin size={13} /> {locationName}
          </div>
        )}
        {kinkNames.slice(0, 3).map((name) => (
          <span key={name} style={{ fontSize: 11, padding: "2px 7px", borderRadius: radius.full, border: "1px solid #E5484D", color: "#E5484D" }}>{name}</span>
        ))}
      </div>
    </div>
  );
}

function ActivityLanding({ T, onOpenEncounter, onAdd }) {
  const [list, setList] = useState(EncounterRepository.getAll);
  const [contacts] = useState(ContactRepository.getAll);
  const [showArchived, setShowArchived] = useState(false);
  const visible = useMemo(() => sortByDateDesc(list.filter((e) => (showArchived ? true : !e.isArchived))), [list, showArchived]);
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 90 }}>
      <div style={{ position: "sticky", top: 0, background: T.bg, padding: "16px 16px 8px", zIndex: 5 }}>
        <div style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 800, fontSize: 22, color: T.textPrimary }}>Activity</div>
        <div onClick={() => setShowArchived((s) => !s)} style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, cursor: "pointer" }}>
          {showArchived ? "Hide archived" : "Show archived"}
        </div>
      </div>
      <div style={{ padding: "8px 16px" }}>
        {visible.length === 0 && <div style={{ textAlign: "center", color: T.textDisabled, fontStyle: "italic", padding: "40px 0" }}>No encounters logged yet.</div>}
        {visible.map((e) => <EncounterCard key={e.id} encounter={e} contacts={contacts} T={T} onClick={() => onOpenEncounter(e.id)} />)}
      </div>
      <div onClick={onAdd} style={{ position: "fixed", bottom: 24, right: 24, width: 56, height: 56, borderRadius: radius.full, background: T.fabBg, color: T.fabIcon, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)" }}>
        <Plus size={26} />
      </div>
    </div>
  );
}

function ActivityDetails({ T, encounterId, onBack, onEdit }) {
  const [encounter, setEncounter] = useState(() => EncounterRepository.getById(encounterId));
  const [contacts] = useState(ContactRepository.getAll);
  const [menuOpen, setMenuOpen] = useState(false);
  if (!encounter) return null;
  const resolveNames = (registry, ids) => ids.map((id) => registry.getById(id)?.name).filter(Boolean);
  const locationName = encounter.locationId ? (LocationsRepository.getById(encounter.locationId)?.name || "") : "";
  const archive = () => { EncounterRepository.archive(encounter.id); setEncounter(EncounterRepository.getById(encounter.id)); setMenuOpen(false); };
  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 40 }}>
      <div style={{ position: "sticky", top: 0, background: T.bg, padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ChevronLeft size={22} style={{ cursor: "pointer" }} onClick={onBack} />
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 700, fontSize: 17, color: T.textPrimary }}>
            {encounter.date ? new Date(encounter.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : encounter.title}
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <MoreVertical size={20} style={{ cursor: "pointer" }} onClick={() => setMenuOpen((o) => !o)} />
          {menuOpen && (
            <div style={{ position: "absolute", right: 0, top: 26, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.sm, boxShadow: "0 4px 16px rgba(0,0,0,.15)", zIndex: 10, minWidth: 140 }}>
              <div onClick={() => { setMenuOpen(false); onEdit(encounter.id); }} style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>Edit</div>
              <div onClick={archive} style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: T.actionRed, display: "flex", alignItems: "center", gap: 6 }}>
                <Archive size={14} /> {encounter.isArchived ? "Unarchive" : "Archive"}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "0 16px" }}>
        {encounter.isArchived && (
          <div style={{ background: `${T.actionRed}15`, border: `1px solid ${T.actionRed}`, borderRadius: radius.sm, padding: 10, fontSize: 12, color: T.actionRed, marginBottom: 4 }}>
            This encounter is archived.
          </div>
        )}
        <SectionCard title="Overview" T={T}>
          <ReadRow label="Title" value={encounter.title} T={T} />
          <ReadRow label="Encounter type" value={encounter.encounterType} T={T} />
          <ReadRow label="Time of day" value={timeOfDay(encounter.date)} T={T} />
          <ReadRow label="Would meet again" value={encounter.wouldMeetAgain} T={T} />
          <ReadRow label="Enjoyment rating" value={encounter.enjoymentRating} T={T} />
          <ReadRow label="Follow-up needed" value={encounter.followUpNeeded ? "Yes" : ""} T={T} />
        </SectionCard>
        <SectionCard title="Attendees" T={T}>
          {encounter.attendeeIds.length === 0
            ? <div style={{ fontSize: 13, color: T.textDisabled, fontStyle: "italic", padding: "8px 0" }}>None recorded.</div>
            : encounter.attendeeIds.map((id) => <div key={id} style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.encountersPink, fontWeight: 600 }}>{contactName(contacts, id)}</div>)}
        </SectionCard>
        <SectionCard title="Practices" T={T}>
          <ReadRow label="My role" value={encounter.myRole} T={T} />
          <ReadRow label="My position" value={encounter.myPosition} T={T} />
          <ReadRow label="Where did I cum?" value={encounter.whereICame} T={T} />
          <ReadRow label="Where did he cum?" value={encounter.whereHeCame} T={T} />
        </SectionCard>
        <SectionCard title="Kink & chems" T={T}>
          <ReadRow label="Kinks involved" value={resolveNames(KinkRegistry, encounter.kinksInvolved)} T={T} />
          <ReadRow label="Chems/alcohol used" value={resolveNames(ChemsRegistry, encounter.chemsAlcoholUsed)} T={T} />
        </SectionCard>
        <SectionCard title="Protection & medication context" T={T}>
          <ReadRow label="Protection used" value={resolveNames(ProtectionRegistry, encounter.protectionUsed)} T={T} />
          <ReadRow label="My PrEP coverage" value={encounter.myPrepCoverage} T={T} />
          <ReadRow label="My DoxyPEP status" value={encounter.myDoxyPepStatus} T={T} />
        </SectionCard>
        <SectionCard title="Health" T={T}>
          <ReadRow label="Symptoms noted" value={resolveNames(SymptomsRegistry, encounter.symptomsNoted)} T={T} />
        </SectionCard>
        <SectionCard title="Location" T={T}>
          <ReadRow label="Location" value={locationName} T={T} />
        </SectionCard>
        <SectionCard title="Notes" T={T}>
          <div style={{ fontSize: 14, color: encounter.notes ? T.textPrimary : T.textDisabled, fontStyle: encounter.notes ? "normal" : "italic" }}>{encounter.notes || "No notes yet."}</div>
        </SectionCard>
      </div>
    </div>
  );
}

function EncounterEditSheet({ T, encounterId, onClose, onSaved }) {
  const isNew = !encounterId;
  const [contacts] = useState(ContactRepository.getAll);
  const [form, setForm] = useState(() => isNew ? { ...DEFAULT_ENCOUNTER } : EncounterRepository.getById(encounterId));
  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const save = () => {
    if (isNew) EncounterRepository.create(form);
    else EncounterRepository.update(encounterId, form);
    onSaved();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 20, overflowY: "auto" }}>
      <div style={{ position: "sticky", top: 0, background: T.bg, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
        <X size={22} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 700, fontSize: 16 }}>{isNew ? "Add Activity" : "Edit Activity"}</span>
        <div onClick={save} style={{ color: T.encountersPink, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>Save</div>
      </div>
      <div style={{ padding: "0 16px 40px" }}>
        <SectionCard title="Overview" T={T}>
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Alex — coffee then back to his" />
          <DateTimeField label="Date & time" value={form.date} onChange={set("date")} T={T} />
          <SelectField label="Encounter type" value={form.encounterType} onChange={set("encounterType")} options={ENCOUNTER_TYPE_OPTIONS} T={T} />
          <SelectField label="Would meet again" value={form.wouldMeetAgain} onChange={set("wouldMeetAgain")} options={WOULD_MEET_AGAIN_OPTIONS} T={T} />
          <TextField label="Enjoyment rating (0–100)" value={form.enjoymentRating} onChange={set("enjoymentRating")} T={T} type="number" />
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <input type="checkbox" checked={!!form.followUpNeeded} onChange={(e) => set("followUpNeeded")(e.target.checked)} />
            <span style={{ fontSize: 13, color: T.textPrimary }}>Follow-up needed</span>
          </div>
        </SectionCard>
        <SectionCard title="Attendees" T={T}>
          <AttendeePicker value={form.attendeeIds} onChange={set("attendeeIds")} T={T} contacts={contacts} />
        </SectionCard>
        <SectionCard title="Practices" T={T}>
          <SelectField label="My role" value={form.myRole} onChange={set("myRole")} options={MY_ROLE_OPTIONS} T={T} />
          <MultiSelectChips label="My position" value={form.myPosition} onChange={set("myPosition")} options={MY_POSITION_OPTIONS} T={T} />
          <MultiSelectChips label="Where did I cum?" value={form.whereICame} onChange={set("whereICame")} options={CUM_LOCATION_OPTIONS} T={T} />
          <MultiSelectChips label="Where did he cum?" value={form.whereHeCame} onChange={set("whereHeCame")} options={CUM_LOCATION_OPTIONS} T={T} />
        </SectionCard>
        <SectionCard title="Kink & chems" T={T}>
          <RegistryTagPicker label="Kinks involved" value={form.kinksInvolved} onChange={set("kinksInvolved")} T={T} registry={KinkRegistry} />
          <RegistryTagPicker label="Chems/alcohol used" value={form.chemsAlcoholUsed} onChange={set("chemsAlcoholUsed")} T={T} registry={ChemsRegistry} />
        </SectionCard>
        <SectionCard title="Protection & medication context" T={T}>
          <RegistryTagPicker label="Protection used" value={form.protectionUsed} onChange={set("protectionUsed")} T={T} registry={ProtectionRegistry} />
          <SelectField label="My PrEP coverage" value={form.myPrepCoverage} onChange={set("myPrepCoverage")} options={PREP_COVERAGE_OPTIONS} T={T} />
          <SelectField label="My DoxyPEP status" value={form.myDoxyPepStatus} onChange={set("myDoxyPepStatus")} options={DOXYPEP_STATUS_OPTIONS} T={T} />
        </SectionCard>
        <SectionCard title="Health" T={T}>
          <RegistryTagPicker label="Symptoms noted" value={form.symptomsNoted} onChange={set("symptomsNoted")} T={T} registry={SymptomsRegistry} />
        </SectionCard>
        <SectionCard title="Location" T={T}>
          <RegistrySinglePicker label="Location" value={form.locationId} onChange={set("locationId")} T={T} registry={LocationsRepository} placeholder="e.g. His place, Sauna" />
        </SectionCard>
        <SectionCard title="Notes" T={T}>
          <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={4}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box", marginTop: 8 }} />
        </SectionCard>
      </div>
    </div>
  );
}

export default function EncountersModule() {
  const [screen, setScreen] = useState({ name: "landing" });
  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif", background: LIGHT.bg, minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ width: 390, background: LIGHT.bg, minHeight: "100vh", borderLeft: `1px solid ${LIGHT.border}`, borderRight: `1px solid ${LIGHT.border}` }}>
        {screen.name === "landing" && (
          <ActivityLanding T={LIGHT} onOpenEncounter={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "edit", id: null })} />
        )}
        {screen.name === "detail" && (
          <ActivityDetails T={LIGHT} encounterId={screen.id} onBack={() => setScreen({ name: "landing" })} onEdit={(id) => setScreen({ name: "edit", id })} />
        )}
        {screen.name === "edit" && (
          <EncounterEditSheet T={LIGHT} encounterId={screen.id}
            onClose={() => setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" })}
            onSaved={() => setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" })} />
        )}
        <div style={{ position: "fixed", bottom: 0, width: 390, background: LIGHT.surface, borderTop: `1px solid ${LIGHT.border}`, display: "flex", justifyContent: "space-around", padding: "10px 0 14px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <Users size={22} color={LIGHT.navActive} strokeWidth={2.5} />
            <span style={{ fontSize: 10, color: LIGHT.navActive, fontWeight: 600 }}>Activity</span>
          </div>
        </div>
      </div>
    </div>
  );
}
