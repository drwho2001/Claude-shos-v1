// SHOS_Encounters_Prototype.jsx — "Activity" screens (Doc 1 nav label) for
// the Encounter domain object (Doc 3 B2, Doc 4 §3). Self-contained, same
// pattern as the Contacts and Medication prototype files — its own theme
// constants and form primitives, no shared UI-library file yet (per the
// project's "discover abstractions after multiple modules exist" rule).
//
// Reads/writes ONLY through EncounterRepository + encounterCalculations.js.
// Attendee picking reads ContactRepository (read-only here — Encounters
// never writes to a Contact record; the link is one-directional storage,
// as documented in encounterRepository.js).

import React, { useState, useMemo, useEffect } from "react";
// ADDED 19 Aug 2026 — draft autosave, real fix for in-progress edits
// being lost on refresh. See draftStorage.js for the full reasoning.
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
import { Plus, ChevronLeft, MoreVertical, X, Archive, Users, MapPin, Heart } from "lucide-react";
import {
  EncounterRepository, DEFAULT_ENCOUNTER,
  ENCOUNTER_TYPE_OPTIONS, MY_POSITION_OPTIONS, CUM_LOCATION_OPTIONS, MY_ROLE_OPTIONS,
  PREP_COVERAGE_OPTIONS, DOXYPEP_STATUS_OPTIONS, WOULD_MEET_AGAIN_OPTIONS,
} from "../repositories/encounterRepository";
import { timeOfDay, sortByDateDesc, formatRelativeDate } from "../calculations/encounterCalculations";
import { ContactRepository } from "../repositories/contactRepository";
// New 18 Aug 2026: real registries now exist for these fields — replaces
// the free-text TagField stubs used until this session.
import { KinkRegistry, KINK_ROLE_OPTIONS } from "../registries/kinkRegistry";
import { ChemsRegistry } from "../registries/chemsRegistry";
import { ProtectionRegistry } from "../registries/protectionRegistry";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { LocationsRepository } from "../repositories/locationsRepository";

const LIGHT = {
  bg: "#F0F0F3", surface: "#FFFFFF", surfaceVariant: "#E7E7EB", border: "#DCDCE1",
  textPrimary: "#1B1B1F", textSecondary: "#5B5B62", textDisabled: "#9A9AA1",
  encountersPink: "#E24E9C", actionRed: "#E5484D", actionGreen: "#1B9E77",
  navActive: "#E24E9C", fabBg: "#1B1B1F", fabIcon: "#FFFFFF",
};
const radius = { sm: 8, md: 16, lg: 24, full: 999 };

function loadEncounters() {
  return EncounterRepository.getAll();
}
function loadContacts() {
  return ContactRepository.getAll();
}
function contactName(contacts, id) {
  const c = contacts.find((c) => c.id === id);
  return c ? (c.nickname || c.name) : "Unknown";
}

// ── Shared primitives (same shapes as Contacts/Medication files) ──

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
  // value is stored as full ISO — the input needs the "YYYY-MM-DDTHH:mm" slice.
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
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.encountersPink : T.border}`, color: active ? T.encountersPink : T.textSecondary, background: active ? `${T.encountersPink}15` : "transparent" }}>
              {opt}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ADDED 18 Aug 2026 — real feedback from Kane, clarified over several
// rounds: "My position" options mix genuine giving/receiving pairs
// (Fingering, Oral, Rimming, Anal) with acts that have no natural
// directional role (Kissing, Cuddling, Groping, Mutual masturbation,
// Kink, Toys). A flat chip list made every pair repeat the word
// "giving"/"receiving" as text; Kane's ask was two columns headed
// Giving/Receiving with just the act name in each, plus a third
// unsplit group below for the acts that don't have that split.
// Deliberately does NOT change the stored shape — MY_POSITION_OPTIONS
// is still one flat array of strings (e.g. "Rimming - giving"), this
// component just reads the " - giving"/" - receiving" suffix to decide
// which column an option belongs in, and treats anything without that
// suffix as the third group. No new data model needed for this.
function GivingReceivingChips({ label, value, onChange, options, T }) {
  const giving = [];
  const receiving = [];
  const neutral = [];
  options.forEach((opt) => {
    if (opt.endsWith(" - giving")) giving.push(opt.slice(0, -" - giving".length));
    else if (opt.endsWith(" - receiving")) receiving.push(opt.slice(0, -" - receiving".length));
    else neutral.push(opt);
  });

  const toggle = (fullValue) => {
    const has = value.includes(fullValue);
    onChange(has ? value.filter((v) => v !== fullValue) : [...value, fullValue]);
  };

  const Chip = ({ act, fullValue }) => {
    const active = value.includes(fullValue);
    return (
      <div onClick={() => toggle(fullValue)}
        style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.encountersPink : T.border}`, color: active ? T.encountersPink : T.textSecondary, background: active ? `${T.encountersPink}15` : "transparent", textAlign: "center" }}>
        {act}
      </div>
    );
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textDisabled, textTransform: "uppercase", letterSpacing: 0.5 }}>Giving</div>
          {giving.map((act) => <Chip key={act} act={act} fullValue={`${act} - giving`} />)}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textDisabled, textTransform: "uppercase", letterSpacing: 0.5 }}>Receiving</div>
          {receiving.map((act) => <Chip key={act} act={act} fullValue={`${act} - receiving`} />)}
        </div>
      </div>
      {neutral.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
          {neutral.map((opt) => <Chip key={opt} act={opt} fullValue={opt} />)}
        </div>
      )}
    </div>
  );
}

// Multi-select picker backed by a real registry (Kink/Chems/Protection/
// Symptoms) instead of freeform text. `value` is an array of registry
// IDs. Typing a name that already exists in the registry links to it
// (case-insensitively); typing a genuinely new name creates a new
// registry entry via findOrCreate — same "pick existing or type new"
// ergonomics the old TagField had, but now backed by a real linked
// entity instead of a bare string, closing the "Fist vs Fisting never
// matched" gap flagged back on 18 Aug.
function RegistryTagPicker({ label, value, onChange, T, registry, placeholder, excludeIds = [], trackRole = false, roleOptions = [] }) {
  const [draft, setDraft] = useState("");
  const listId = `registry-${label.replace(/\s+/g, "-")}`;
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const nameFor = (id) => allEntries.find((e) => e.id === id)?.name || registry.getById(id)?.name || "?";

  // ADDED 18 Aug 2026 — trackRole mode: `value` becomes an array of
  // {kinkId, role} selections instead of plain registry IDs — Kane's
  // real per-session ask: "fisting happened" is enough on its own, with
  // an OPTIONAL role if he wants to note "I was fisting top" for that
  // specific encounter. Same mechanism as Contacts' Stated Kinks.
  const selectedIds = trackRole ? value.map((v) => v.kinkId) : value;
  const hasSelection = (id) => selectedIds.includes(id);

  // ADDED 18 Aug 2026 — visible tappable suggestions, matching the
  // pattern already used in Contacts/My Profile. This picker never had
  // them, relying only on the native <datalist> dropdown, which is easy
  // to type straight past without noticing — same gap already flagged
  // and fixed elsewhere.
  const visibleSuggestions = allEntries.filter((e) => !hasSelection(e.id) && !excludeIds.includes(e.id)).slice(0, 10);

  const addEntries = (ids) => {
    if (ids.length === 0) return;
    if (trackRole) onChange([...value, ...ids.map((id) => ({ kinkId: id, role: null }))]);
    else onChange([...value, ...ids]);
  };
  const removeEntry = (id) => {
    if (trackRole) onChange(value.filter((v) => v.kinkId !== id));
    else onChange(value.filter((v) => v !== id));
  };
  const cycleRole = (id) => {
    if (!trackRole) return;
    onChange(value.map((v) => {
      if (v.kinkId !== id) return v;
      const currentIndex = v.role ? roleOptions.indexOf(v.role) : -1;
      const nextRole = currentIndex + 1 < roleOptions.length ? roleOptions[currentIndex + 1] : null;
      return { ...v, role: nextRole };
    }));
  };

  // CHANGED 18 Aug 2026 — real bug fix, same as Contacts/My Profile:
  // "fisting, gooning, piss" used to become one registry entry named
  // that whole string. Now splits on commas, resolves each piece
  // independently.
  const commit = () => {
    const raw = draft.trim();
    if (!raw) { setDraft(""); return; }
    const parts = raw.split(",").map((t) => t.trim()).filter(Boolean);
    const newIds = [];
    parts.forEach((part) => {
      const entry = registry.findOrCreate(part);
      if (entry && !hasSelection(entry.id) && !newIds.includes(entry.id)) newIds.push(entry.id);
    });
    addEntries(newIds);
    setDraft("");
  };

  const tapSuggestion = (entry) => {
    if (!hasSelection(entry.id)) addEntries([entry.id]);
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
        {(trackRole ? value : value.map((id) => ({ kinkId: id, role: null }))).map((sel) => (
          <div key={sel.kinkId} style={{ display: "flex", alignItems: "center", borderRadius: radius.full, border: `1px solid ${T.border}`, overflow: "hidden" }}>
            <div style={{ padding: "4px 8px", fontSize: 12, color: T.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
              {nameFor(sel.kinkId)}
              <X size={11} style={{ cursor: "pointer" }} onClick={() => removeEntry(sel.kinkId)} />
            </div>
            {trackRole && (
              <div onClick={() => cycleRole(sel.kinkId)}
                style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", borderLeft: `1px solid ${T.border}`, color: sel.role ? T.encountersPink : T.textDisabled }}>
                {sel.role || "+ role"}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* ADDED 18 Aug 2026 — rendered above the input on purpose, same
          reasoning as Contacts/My Profile: the on-screen keyboard covers
          whatever's below the input the moment you tap in. */}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.encountersPink}`, color: T.encountersPink, cursor: "pointer" }}>
              + {e.name}
            </div>
          ))}
        </div>
      )}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        list={listId}
        placeholder={placeholder || "Pick existing or type new ones, comma-separated"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      <datalist id={listId}>
        {allEntries.map((e) => <option key={e.id} value={e.name} />)}
      </datalist>
    </div>
  );
}

// Single-select version, for Location — one registry ID, not an array.
function RegistrySinglePicker({ label, value, onChange, T, registry, placeholder }) {
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const current = value ? (allEntries.find((e) => e.id === value)?.name || registry.getById(value)?.name || "") : "";
  const [draft, setDraft] = useState(current);

  // ADDED 18 Aug 2026 — real feedback: relying only on the native
  // <datalist> dropdown "doesn't feel right" — no visible tap target,
  // easy to miss the dropdown affordance entirely on a phone. Same fix
  // already shipped for RegistryTagPicker earlier this session: visible
  // tappable suggestion chips for existing entries, not just a native
  // browser dropdown as the only way in.
  const listId = `registry-single-${label.replace(/\s+/g, "-")}`;
  const visibleSuggestions = allEntries.filter((e) => e.id !== value).slice(0, 8);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) { onChange(""); return; }
    const entry = registry.findOrCreate(trimmed);
    // CHANGED 18 Aug 2026 — real bug: draft never synced back to the
    // entry's canonical stored name after commit, so typing "sauna"
    // when "Sauna" already existed would match the existing entry
    // (findOrCreate is case-insensitive) but leave the field showing
    // lowercase "sauna" — visually inconsistent with what's actually
    // saved. This is very likely what "doesn't feel right after
    // clicking out" was describing.
    if (entry) { onChange(entry.id); setDraft(entry.name); }
  };

  const tapSuggestion = (entry) => {
    onChange(entry.id);
    setDraft(entry.name);
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.encountersPink}`, color: T.encountersPink, cursor: "pointer" }}>
              {e.name}
            </div>
          ))}
        </div>
      )}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        list={listId}
        placeholder={placeholder || "Pick existing or type a new one"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
      <datalist id={listId}>
        {allEntries.map((e) => <option key={e.id} value={e.name} />)}
      </datalist>
    </div>
  );
}

function AttendeePicker({ value, onChange, T, contacts }) {
  const toggle = (id) => {
    const has = value.includes(id);
    onChange(has ? value.filter((v) => v !== id) : [...value, id]);
  };
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
        {contacts.length === 0 && <div style={{ fontSize: 12, color: T.textDisabled, fontStyle: "italic" }}>No contacts yet — add one in Contacts first.</div>}
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

// ── Encounter Card (Doc 3 B2) — used in the Activity Landing timeline ──
function EncounterCard({ encounter, contacts, T, onClick }) {
  const attendeeNames = encounter.attendeeIds.map((id) => contactName(contacts, id));
  const shown = attendeeNames.slice(0, 3);
  const extra = attendeeNames.length - shown.length;
  const locationName = encounter.locationId ? (LocationsRepository.getById(encounter.locationId)?.name || "") : "";
  // Local copy — ActivityDetails has its own further down; this card
  // renders in a different component/scope (the encounter list), so it
  // needs its own rather than reaching across function boundaries.
  const kinkNames = encounter.kinksInvolved.map((sel) => {
    const name = KinkRegistry.getById(sel.kinkId)?.name;
    return name ? (sel.role ? `${name} (${sel.role})` : name) : null;
  }).filter(Boolean);
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
          <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: T.textSecondary, display: "flex", alignItems: "center", gap: 3 }}>
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

// ── 3a. Activity Landing ──
function ActivityLanding({ T, onOpenEncounter, onAdd }) {
  const [encounters, setEncounters] = useState(loadEncounters);
  const [contacts] = useState(loadContacts);
  const [showArchived, setShowArchived] = useState(false);

  const visible = useMemo(() => {
    const base = encounters.filter((e) => (showArchived ? true : !e.isArchived));
    return sortByDateDesc(base);
  }, [encounters, showArchived]);

  return (
    <div style={{ background: T.bg, minHeight: "100vh", paddingBottom: 90 }}>
      <div style={{ position: "sticky", top: 0, background: T.bg, padding: "16px 16px 8px", zIndex: 5 }}>
        <div style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 800, fontSize: 22, color: T.textPrimary }}>Activity</div>
        <div onClick={() => setShowArchived((s) => !s)} style={{ fontSize: 12, color: T.textSecondary, marginTop: 4, cursor: "pointer" }}>
          {showArchived ? "Hide archived" : "Show archived"}
        </div>
      </div>
      <div style={{ padding: "8px 16px" }}>
        {visible.length === 0 && (
          <div style={{ textAlign: "center", color: T.textDisabled, fontStyle: "italic", padding: "40px 0" }}>No encounters logged yet.</div>
        )}
        {visible.map((e) => (
          <EncounterCard key={e.id} encounter={e} contacts={contacts} T={T} onClick={() => onOpenEncounter(e.id)} />
        ))}
      </div>
      <div onClick={onAdd} style={{ position: "fixed", bottom: 24, right: 24, width: 56, height: 56, borderRadius: radius.full, background: T.fabBg, color: T.fabIcon, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)" }}>
        <Plus size={26} />
      </div>
    </div>
  );
}

// ── 3b. Activity Details ──
function ActivityDetails({ T, encounterId, onBack, onEdit }) {
  const [encounter, setEncounter] = useState(() => EncounterRepository.getById(encounterId));
  const [contacts] = useState(loadContacts);
  const [menuOpen, setMenuOpen] = useState(false);
  if (!encounter) return null;

  // Resolves an array of registry IDs to their display names — used
  // below for Kinks/Chems/Protection/Symptoms, since those are now real
  // registry links, not plain strings.
  const resolveNames = (registry, ids) => ids.map((id) => registry.getById(id)?.name).filter(Boolean);
  // ADDED 18 Aug 2026 — kinksInvolved is now {kinkId, role} selections,
  // not plain IDs (see encounterRepository.js) — this resolves each to
  // its display name, appending the role in parentheses when set.
  const resolveKinkSelections = (selections) => selections.map((sel) => {
    const name = KinkRegistry.getById(sel.kinkId)?.name;
    return name ? (sel.role ? `${name} (${sel.role})` : name) : null;
  }).filter(Boolean);
  const locationName = encounter.locationId ? (LocationsRepository.getById(encounter.locationId)?.name || "") : "";

  const archive = () => {
    EncounterRepository.archive(encounter.id);
    setEncounter(EncounterRepository.getById(encounter.id));
    setMenuOpen(false);
  };

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
        </SectionCard>

        <SectionCard title="Attendees" T={T}>
          {encounter.attendeeIds.length === 0
            ? <div style={{ fontSize: 13, color: T.textDisabled, fontStyle: "italic", padding: "8px 0" }}>None recorded.</div>
            : encounter.attendeeIds.map((id) => (
              <div key={id} style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, fontSize: 13, color: T.encountersPink, fontWeight: 600 }}>
                {contactName(contacts, id)}
              </div>
            ))}
        </SectionCard>

        <SectionCard title="Practices" T={T}>
          <ReadRow label="My role" value={encounter.myRole} T={T} />
          <ReadRow label="My position" value={encounter.myPosition} T={T} />
          <ReadRow label="Where did I cum?" value={encounter.whereICame} T={T} />
          <ReadRow label="Where did he cum?" value={encounter.whereHeCame} T={T} />
        </SectionCard>

        <SectionCard title="Kink & chems" T={T}>
          <ReadRow label="Kinks involved" value={resolveKinkSelections(encounter.kinksInvolved)} T={T} />
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
          <div style={{ fontSize: 14, color: encounter.notes ? T.textPrimary : T.textDisabled, fontStyle: encounter.notes ? "normal" : "italic" }}>
            {encounter.notes || "No notes yet."}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Add/Edit sheet ──
function EncounterEditSheet({ T, encounterId, onClose, onSaved }) {
  const isNew = !encounterId;
  const [contacts] = useState(loadContacts);
  // ADDED 19 Aug 2026 — draft autosave, same pattern/reasoning as
  // Contacts — see draftStorage.js.
  const draftKey = `encounterEdit_${encounterId || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return isNew ? { ...DEFAULT_ENCOUNTER } : EncounterRepository.getById(encounterId);
  });
  const [draftRestored] = useState(() => !!loadDraft(draftKey));
  useEffect(() => {
    saveDraft(draftKey, form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const save = () => {
    clearDraft(draftKey);
    if (isNew) EncounterRepository.create(form);
    else EncounterRepository.update(encounterId, form);
    onSaved();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 20, overflowY: "auto" }} data-encounter-sheet>
      <div style={{ position: "sticky", top: 0, background: T.bg, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
        <X size={22} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 700, fontSize: 16 }}>{isNew ? "Add Activity" : "Edit Activity"}</span>
        <div onClick={save}
          style={{ padding: "6px 14px", borderRadius: radius.full, background: T.encountersPink, color: "#FFFFFF", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Save
        </div>
      </div>

      {draftRestored && (
        <div style={{ margin: "10px 16px 0", fontSize: 11, color: T.actionGreen, background: `${T.actionGreen}15`, borderRadius: radius.sm, padding: "6px 10px" }}>
          Restored unsaved changes from earlier.
        </div>
      )}

      <div style={{ padding: "0 16px 40px" }}>
        <SectionCard title="Overview" T={T}>
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Alex — coffee then back to his" />
          <DateTimeField label="Date & time" value={form.date} onChange={set("date")} T={T} />
          <SelectField label="Encounter type" value={form.encounterType} onChange={set("encounterType")} options={ENCOUNTER_TYPE_OPTIONS} T={T} />
          <SelectField label="Would meet again" value={form.wouldMeetAgain} onChange={set("wouldMeetAgain")} options={WOULD_MEET_AGAIN_OPTIONS} T={T} />
          <TextField label="Enjoyment rating (0–100)" value={form.enjoymentRating} onChange={set("enjoymentRating")} T={T} type="number" />
        </SectionCard>

        <SectionCard title="Attendees" T={T}>
          <AttendeePicker value={form.attendeeIds} onChange={set("attendeeIds")} T={T} contacts={contacts} />
        </SectionCard>

        <SectionCard title="Practices" T={T}>
          <SelectField label="My role" value={form.myRole} onChange={set("myRole")} options={MY_ROLE_OPTIONS} T={T} />
          <GivingReceivingChips label="My position" value={form.myPosition} onChange={set("myPosition")} options={MY_POSITION_OPTIONS} T={T} />
          <MultiSelectChips label="Where did I cum?" value={form.whereICame} onChange={set("whereICame")} options={CUM_LOCATION_OPTIONS} T={T} />
          <MultiSelectChips label="Where did he cum?" value={form.whereHeCame} onChange={set("whereHeCame")} options={CUM_LOCATION_OPTIONS} T={T} />
        </SectionCard>

        <SectionCard title="Kink & chems" T={T}>
          <RegistryTagPicker label="Kinks involved" value={form.kinksInvolved} onChange={set("kinksInvolved")} T={T} registry={KinkRegistry} trackRole roleOptions={KINK_ROLE_OPTIONS} />
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

// ── Top-level module component — same shape as the Contacts/Medication
// top-level components, so App.jsx's switcher can drop this in directly. ──
export default function EncountersModule({ openAddOnMount = false, onConsumedQuickAdd } = {}) {
  const [screen, setScreen] = useState({ name: "landing" });

  // ADDED 19 Aug 2026 — same Dashboard quick-add pattern as Contacts;
  // see that file for the fuller reasoning on why mount-only is enough.
  useEffect(() => {
    if (openAddOnMount) {
      setScreen({ name: "edit", id: null });
      onConsumedQuickAdd?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIXED 19 Aug 2026 — real bug Kane spotted ("looked like Times New
  // Roman"): every other module wraps its content in a div that sets
  // fontFamily: 'Public Sans' AND loads the actual Google Font via a
  // <style>@import</style> tag. This module never did either — it just
  // returned each screen's content directly. Individual elements that
  // explicitly set fontFamily: "'Public Sans', sans-serif" would still
  // fall through to the browser's default serif font, because Public
  // Sans itself was never actually loaded here, and anything that
  // *didn't* set its own fontFamily had nothing to inherit from either.
  // Same fix as every other module: one wrapper, one font import,
  // applied once regardless of which screen is showing.
  let screenContent = null;
  if (screen.name === "landing") {
    screenContent = (
      <ActivityLanding T={LIGHT}
        onOpenEncounter={(id) => setScreen({ name: "detail", id })}
        onAdd={() => setScreen({ name: "edit", id: null })} />
    );
  } else if (screen.name === "detail") {
    screenContent = (
      <ActivityDetails T={LIGHT} encounterId={screen.id}
        onBack={() => setScreen({ name: "landing" })}
        onEdit={(id) => setScreen({ name: "edit", id })} />
    );
  } else if (screen.name === "edit") {
    screenContent = (
      <EncounterEditSheet T={LIGHT} encounterId={screen.id}
        onClose={() => setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" })}
        onSaved={() => setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" })} />
    );
  }

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');`}</style>
      {screenContent}
    </div>
  );
}
