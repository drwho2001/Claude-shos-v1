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

import React, { useState, useMemo } from "react";
import { Plus, ChevronLeft, MoreVertical, X, Archive, Users, MapPin, Heart } from "lucide-react";
import {
  EncounterRepository, DEFAULT_ENCOUNTER,
  ENCOUNTER_TYPE_OPTIONS, MY_POSITION_OPTIONS, CUM_LOCATION_OPTIONS, MY_ROLE_OPTIONS,
  PREP_COVERAGE_OPTIONS, DOXYPEP_STATUS_OPTIONS, WOULD_MEET_AGAIN_OPTIONS,
} from "./encounterRepository";
import { timeOfDay, sortByDateDesc, formatRelativeDate } from "./encounterCalculations";
import { ContactRepository } from "./contactRepository";
// New 18 Aug 2026: real registries now exist for these fields — replaces
// the free-text TagField stubs used until this session.
import { KinkRegistry } from "./kinkRegistry";
import { ChemsRegistry } from "./chemsRegistry";
import { ProtectionRegistry } from "./protectionRegistry";
import { SymptomsRegistry } from "./symptomsRegistry";
import { LocationsRepository } from "./locationsRepository";

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

// Multi-select picker backed by a real registry (Kink/Chems/Protection/
// Symptoms) instead of freeform text. `value` is an array of registry
// IDs. Typing a name that already exists in the registry links to it
// (case-insensitively); typing a genuinely new name creates a new
// registry entry via findOrCreate — same "pick existing or type new"
// ergonomics the old TagField had, but now backed by a real linked
// entity instead of a bare string, closing the "Fist vs Fisting never
// matched" gap flagged back on 18 Aug.
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

// Single-select version, for Location — one registry ID, not an array.
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
          <ReadRow label="Follow-up needed" value={encounter.followUpNeeded ? "Yes" : ""} T={T} />
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
  const [form, setForm] = useState(() => isNew ? { ...DEFAULT_ENCOUNTER } : EncounterRepository.getById(encounterId));
  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const save = () => {
    if (isNew) EncounterRepository.create(form);
    else EncounterRepository.update(encounterId, form);
    onSaved();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 20, overflowY: "auto" }} data-encounter-sheet>
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

// ── Top-level module component — same shape as the Contacts/Medication
// top-level components, so App.jsx's switcher can drop this in directly. ──
export default function EncountersModule() {
  const [screen, setScreen] = useState({ name: "landing" });

  if (screen.name === "landing") {
    return (
      <>
        <ActivityLanding T={LIGHT}
          onOpenEncounter={(id) => setScreen({ name: "detail", id })}
          onAdd={() => setScreen({ name: "edit", id: null })} />
      </>
    );
  }
  if (screen.name === "detail") {
    return (
      <ActivityDetails T={LIGHT} encounterId={screen.id}
        onBack={() => setScreen({ name: "landing" })}
        onEdit={(id) => setScreen({ name: "edit", id })} />
    );
  }
  if (screen.name === "edit") {
    return (
      <EncounterEditSheet T={LIGHT} encounterId={screen.id}
        onClose={() => setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" })}
        onSaved={() => setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" })} />
    );
  }
  return null;
}
