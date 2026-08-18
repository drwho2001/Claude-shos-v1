// SHOS_MyProfile_Prototype.jsx
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// The "My Profile / Shareable Contact Card" screen. Two things live
// here, and only two: (1) editing YOUR OWN shareable profile data
// (backed by myProfileRepository.js), and (2) sharing it out / pulling
// someone else's shared profile in as a new Contact (backed by
// profileShareService.js). This module never touches ContactRepository
// directly except via importProfileAsContact() — importing a shared
// profile is what CREATES a Contact, this module doesn't manage
// Contacts itself.
//
// Same self-contained pattern as Encounters: own theme constants, own
// form primitives, no shared UI-library file yet (that's a possible
// future abstraction once several modules exist to compare, not
// something to impose now). Colored teal — this lives under Identity
// alongside Contacts in Notion, and the profile IS "what a Contact
// entry would look like for you", so sharing Contacts' color makes
// that relationship visible rather than picking an arbitrary new hue.

import React, { useState } from "react";
import { User, Download, Copy, Upload, Check, X, ChevronLeft } from "lucide-react";
import { MyProfileRepository, DEFAULT_PROFILE } from "../repositories/myProfileRepository";
import {
  buildProfileShare, exportProfileShare,
  importProfileShareFromFile, importProfileShareFromText,
} from "../storage/profileShareService";
// Reusing Contacts' own option constants for fields that must line up
// with Contact's real values (Hosts/Travels/Availability/etc.) — same
// values, not retyped, so a shared profile always maps onto a valid
// Contact field value on the receiving end.
import {
  HOSTS_OPTIONS, TRAVELS_OPTIONS, AVAILABILITY_OPTIONS, READILY_AVAILABLE_OPTIONS,
  LENGTH_OPTIONS, THICKNESS_OPTIONS, FORESKIN_OPTIONS, CHASTITY_OPTIONS, CUMMER_OPTIONS,
  PREP_DOXY_OPTIONS, DAYS_OF_WEEK, TIME_CONSTRAINT_TYPES, AVAILABILITY_RULE_TYPES,
  BDSM_ROLE_OPTIONS, SEXUAL_POSITION_OPTIONS,
} from "../repositories/contactRepository";
import { KinkRegistry, KINK_ROLE_OPTIONS } from "../registries/kinkRegistry";
import { ChemsRegistry } from "../registries/chemsRegistry";

const LIGHT = {
  bg: "#F0F0F3", surface: "#FFFFFF", surfaceVariant: "#E7E7EB", border: "#DCDCE1",
  textPrimary: "#1B1B1F", textSecondary: "#5B5B62", textDisabled: "#9A9AA1",
  contactsTeal: "#14B8A6", actionRed: "#E5484D", actionGreen: "#1B9E77",
  navActive: "#14B8A6", fabBg: "#1B1B1F", fabIcon: "#FFFFFF",
};
const radius = { sm: 8, md: 16, lg: 24, full: 999 };

function idFromLabel(label) {
  return "combo-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ── Shared form primitives — same visual shape as Contacts', kept
// local per the self-contained-module pattern rather than importing
// from a file that isn't a shared UI library. ──

function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.contactsTeal, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 12, marginBottom: 2 }}>{title}</div>
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

function TextAreaField({ label, value, onChange, T, placeholder }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
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
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.contactsTeal : T.border}`, color: active ? T.contactsTeal : T.textSecondary, background: active ? `${T.contactsTeal}15` : "transparent" }}>
              {opt}
            </div>
          );
        })}
      </div>
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
          style={{ width: 90, padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
        <div onClick={() => onChangeApprox(!ageIsApprox)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <ToggleSwitch T={T} value={ageIsApprox} onChange={onChangeApprox} />
          <span style={{ fontSize: 12, color: T.textSecondary }}>Approximate</span>
        </div>
      </div>
    </div>
  );
}

// Same TagInput shape as Contacts' — free-text tags, used only for
// contactableVia here (extra platforms beyond the named fields below).
function TagInput({ label, value, onChange, T, placeholder }) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const raw = draft.trim();
    if (!raw) return;
    const parts = raw.split(",").map((t) => t.trim()).filter((t) => t && !value.includes(t));
    if (parts.length > 0) onChange([...value, ...parts]);
    setDraft("");
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
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={placeholder || "Type, comma-separated, then Enter"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
    </div>
  );
}

// Registry-backed picker, same shape/behavior as Contacts' own
// RegistryTagPicker — resolves stored IDs to display names, creates a
// new registry entry (case-insensitively deduped) on a fresh typed tag.
function RegistryTagPicker({ label, value, onChange, T, registry, placeholder, excludeIds = [], trackRole = false, roleOptions = [] }) {
  const [draft, setDraft] = useState("");
  const listId = idFromLabel(label) + "-registry";
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const nameFor = (id) => allEntries.find((e) => e.id === id)?.name || registry.getById(id)?.name || "?";

  // ADDED 18 Aug 2026 — trackRole mode: `value` becomes an array of
  // {kinkId, role} selections — matches Contacts' Stated Kinks/
  // Encounters' Kinks Involved, so a shared profile always maps onto
  // the same field shape a Contact expects on import.
  const selectedIds = trackRole ? value.map((v) => v.kinkId) : value;
  const hasSelection = (id) => selectedIds.includes(id);

  // CHANGED 18 Aug 2026 — excludes excludeIds too now, so a kink already
  // marked "into" doesn't get suggested as a limit and vice versa.
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

  // CHANGED 18 Aug 2026 — real bug fix: "fisting, gooning, piss" used to
  // become one registry entry with that whole string as its name. Now
  // splits on commas and resolves each piece independently.
  const commitDraft = () => {
    const raw = draft.trim();
    if (!raw) return;
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
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {(trackRole ? value : value.map((id) => ({ kinkId: id, role: null }))).map((sel) => (
            <div key={sel.kinkId} style={{ display: "flex", alignItems: "center", borderRadius: radius.full, background: T.surfaceVariant, overflow: "hidden" }}>
              <div onClick={() => removeEntry(sel.kinkId)}
                style={{ padding: "4px 8px", fontSize: 12, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                {nameFor(sel.kinkId)} <X size={11} />
              </div>
              {trackRole && (
                <div onClick={() => cycleRole(sel.kinkId)}
                  style={{ padding: "4px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", borderLeft: `1px solid ${T.border}`, color: sel.role ? T.contactsTeal : T.textDisabled }}>
                  {sel.role || "+ role"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* CHANGED 18 Aug 2026 — moved above the input so the on-screen
          keyboard doesn't cover the suggestions the moment you tap in. */}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, cursor: "pointer" }}>
              + {e.name}
            </div>
          ))}
        </div>
      )}
      <input list={listId} value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDraft(); } }}
        onBlur={commitDraft}
        placeholder={placeholder || "Pick existing or type new ones, comma-separated"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      <datalist id={listId}>
        {allEntries.map((e) => <option key={e.id} value={e.name} />)}
      </datalist>
    </div>
  );
}

// Same repeatable day/time rule builder as Contacts' non-availability
// rules — same shape kept deliberately, since these end up on a
// Contact record shaped identically once imported on the other end.
function AvailabilityRuleBuilder({ rules, onChange, T }) {
  const [draft, setDraft] = useState({ type: "Unavailable", days: [], timeConstraint: "All day", time: "18:00", note: "" });

  const toggleDay = (day) => {
    setDraft((d) => ({ ...d, days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day] }));
  };
  const addRule = () => {
    if (draft.days.length === 0) return;
    onChange([...rules, { id: `rule_${Date.now()}`, ...draft }]);
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
              <X size={14} style={{ cursor: "pointer", flexShrink: 0, marginLeft: 8 }} onClick={() => removeRule(r.id)} />
            </div>
          ))}
        </div>
      )}
      <div style={{ padding: 10, borderRadius: radius.sm, border: `1px dashed ${T.border}` }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {AVAILABILITY_RULE_TYPES.map((t) => (
            <div key={t} onClick={() => setDraft((d) => ({ ...d, type: t }))}
              style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${draft.type === t ? T.contactsTeal : T.border}`, color: draft.type === t ? T.contactsTeal : T.textSecondary }}>
              {t}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} onClick={() => toggleDay(d)}
              style={{ width: 32, height: 32, borderRadius: radius.full, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${draft.days.includes(d) ? T.contactsTeal : T.border}`, color: draft.days.includes(d) ? T.contactsTeal : T.textSecondary, background: draft.days.includes(d) ? `${T.contactsTeal}15` : "transparent" }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {TIME_CONSTRAINT_TYPES.map((tc) => (
            <div key={tc} onClick={() => setDraft((d) => ({ ...d, timeConstraint: tc }))}
              style={{ padding: "4px 10px", borderRadius: radius.full, fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${draft.timeConstraint === tc ? T.contactsTeal : T.border}`, color: draft.timeConstraint === tc ? T.contactsTeal : T.textSecondary }}>
              {tc}
            </div>
          ))}
          {draft.timeConstraint !== "All day" && (
            <input type="time" value={draft.time} onChange={(e) => setDraft((d) => ({ ...d, time: e.target.value }))}
              style={{ padding: "4px 8px", borderRadius: radius.sm, border: `1px solid ${T.border}`, fontSize: 12 }} />
          )}
        </div>
        <input value={draft.note} onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
          placeholder="Optional note"
          style={{ width: "100%", padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surface, fontSize: 12, boxSizing: "border-box", marginBottom: 8 }} />
        <div onClick={addRule}
          style={{ textAlign: "center", padding: "8px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", background: draft.days.length ? T.contactsTeal : T.surfaceVariant, color: draft.days.length ? "#FFFFFF" : T.textDisabled }}>
          Add exception
        </div>
      </div>
    </div>
  );
}

// ── Edit screen ──
function MyProfileEditScreen({ profile, onSave, onCancel, T }) {
  const [form, setForm] = useState(profile);
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div data-myprofile-sheet style={{ position: "fixed", inset: 0, background: T.bg, overflowY: "auto", zIndex: 50 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}`, zIndex: 1 }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onCancel} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>Edit My Profile</span>
        <div onClick={() => onSave(form)} style={{ padding: "6px 14px", borderRadius: radius.full, background: T.contactsTeal, color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Save</div>
      </div>

      <div style={{ padding: "0 16px 100px" }}>
        <SectionCard title="Identity" T={T}>
          <TextField label="Display name" value={form.displayName} onChange={set("displayName")} T={T} placeholder="What shows up as your name" />
          <TextField label="Nickname" value={form.nickname} onChange={set("nickname")} T={T} />
          <AgeField age={form.age} ageIsApprox={form.ageIsApprox} onChangeAge={set("age")} onChangeApprox={set("ageIsApprox")} T={T} />
          <TextField label="City" value={form.city} onChange={set("city")} T={T} placeholder="Deliberately city, not full address — see privacy note" />
        </SectionCard>

        <SectionCard title="Find me on" T={T}>
          <TextField label="Phone/WhatsApp" value={form.phone} onChange={set("phone")} T={T} />
          <TextField label="Snapchat" value={form.snapchat} onChange={set("snapchat")} T={T} />
          <TextField label="Fabguys" value={form.fabguys} onChange={set("fabguys")} T={T} />
          <TextField label="Fabswingers" value={form.fabswingers} onChange={set("fabswingers")} T={T} />
          <TagInput label="Other platforms" value={form.contactableVia} onChange={set("contactableVia")} T={T} placeholder="Grindr, Tinder, etc." />
        </SectionCard>

        <SectionCard title="Hosting / Travel" T={T}>
          <SelectField label="Hosts" value={form.hosts} onChange={set("hosts")} options={HOSTS_OPTIONS} T={T} />
          <SelectField label="Travels" value={form.travels} onChange={set("travels")} options={TRAVELS_OPTIONS} T={T} />
        </SectionCard>

        <SectionCard title="Availability" T={T}>
          <MultiSelectChips label="General availability" value={form.availability} onChange={set("availability")} options={AVAILABILITY_OPTIONS} T={T} />
          <SelectField label="Readily available?" value={form.readilyAvailable} onChange={set("readilyAvailable")} options={READILY_AVAILABLE_OPTIONS} T={T} />
          <AvailabilityRuleBuilder rules={form.nonAvailabilityRules} onChange={set("nonAvailabilityRules")} T={T} />
        </SectionCard>

        <SectionCard title="Into / Limits" T={T}>
          <RegistryTagPicker label="Into" value={form.statedKinks} onChange={set("statedKinks")} registry={KinkRegistry} T={T} excludeIds={form.limits} trackRole roleOptions={KINK_ROLE_OPTIONS} />
          <RegistryTagPicker label="Limits" value={form.limits} onChange={set("limits")} registry={KinkRegistry} T={T} excludeIds={form.statedKinks.map((s) => s.kinkId)} />
          <MultiSelectChips label="Role" value={form.bdsmRole} onChange={set("bdsmRole")} options={BDSM_ROLE_OPTIONS} T={T} />
          <MultiSelectChips label="Position" value={form.sexualPosition} onChange={set("sexualPosition")} options={SEXUAL_POSITION_OPTIONS} T={T} />
        </SectionCard>

        <SectionCard title="Chems" T={T}>
          <RegistryTagPicker label="Known chems" value={form.knownChems} onChange={set("knownChems")} registry={ChemsRegistry} T={T} />
        </SectionCard>

        <SectionCard title="Physical" T={T}>
          <SelectField label="Length" value={form.length} onChange={set("length")} options={LENGTH_OPTIONS} T={T} />
          <SelectField label="Thickness" value={form.thickness} onChange={set("thickness")} options={THICKNESS_OPTIONS} T={T} />
          <SelectField label="Foreskin" value={form.foreskin} onChange={set("foreskin")} options={FORESKIN_OPTIONS} T={T} />
          <SelectField label="Chastity status" value={form.chastityStatus} onChange={set("chastityStatus")} options={CHASTITY_OPTIONS} T={T} />
          <MultiSelectChips label="Cummer" value={form.cummer} onChange={set("cummer")} options={CUMMER_OPTIONS} T={T} />
        </SectionCard>

        <SectionCard title="Sexual health status" T={T}>
          <MultiSelectChips label="Known PrEP/DoxyPEP" value={form.knownPrepDoxy} onChange={set("knownPrepDoxy")} options={PREP_DOXY_OPTIONS} T={T} />
          <TextField label="Last tested date" value={form.lastTestedDate} onChange={set("lastTestedDate")} T={T} type="date" />
        </SectionCard>

        <SectionCard title="About me" T={T}>
          <TextAreaField label="A short note about yourself" value={form.aboutMeNotes} onChange={set("aboutMeNotes")} T={T} placeholder="Not shown to anyone unless you share your profile." />
        </SectionCard>
      </div>
    </div>
  );
}

// ── Share / Import screen ──
function ShareImportPanel({ profile, T, onImported }) {
  const [status, setStatus] = useState(null);
  const [pasteText, setPasteText] = useState("");

  const doExportFile = () => {
    exportProfileShare();
    setStatus({ ok: true, msg: "Profile file downloaded." });
  };

  const doCopyText = async () => {
    const json = JSON.stringify(buildProfileShare(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setStatus({ ok: true, msg: "Copied — paste it into a message to share." });
    } catch {
      setStatus({ ok: false, msg: "Couldn't copy automatically — select and copy the text manually." });
    }
  };

  const doImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importProfileShareFromFile(
      file,
      (newContact) => { setStatus({ ok: true, msg: `Added "${newContact.name}" to your Contacts.` }); onImported?.(); },
      (err) => setStatus({ ok: false, msg: err.message })
    );
    e.target.value = "";
  };

  const doImportPaste = () => {
    importProfileShareFromText(
      pasteText,
      (newContact) => { setStatus({ ok: true, msg: `Added "${newContact.name}" to your Contacts.` }); setPasteText(""); onImported?.(); },
      (err) => setStatus({ ok: false, msg: err.message })
    );
  };

  return (
    <div style={{ padding: "0 16px 100px" }}>
      <SectionCard title="Share your profile" T={T}>
        <div style={{ fontSize: 12, color: T.textSecondary, padding: "8px 0" }}>
          Sends only what's above — never your relationship notes or how-we-met info about anyone else, because those don't exist on this record at all.
        </div>
        <div style={{ display: "flex", gap: 8, padding: "4px 0" }}>
          <div onClick={doExportFile} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: radius.full, background: T.contactsTeal, color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Download size={15} /> Save as file
          </div>
          <div onClick={doCopyText} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: radius.full, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Copy size={15} /> Copy as text
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Import a shared profile" T={T}>
        <div style={{ fontSize: 12, color: T.textSecondary, padding: "8px 0" }}>
          Creates a brand-new Contact from someone else's shared profile. Doesn't touch or merge with any existing contact.
        </div>
        <TextAreaField label="Paste a shared profile" value={pasteText} onChange={setPasteText} T={T} placeholder="Paste the JSON text someone sent you" />
        <div onClick={doImportPaste} style={{ textAlign: "center", padding: "10px", borderRadius: radius.full, fontSize: 13, fontWeight: 600, cursor: "pointer", background: pasteText.trim() ? T.contactsTeal : T.surfaceVariant, color: pasteText.trim() ? "#FFFFFF" : T.textDisabled, marginBottom: 10 }}>
          Import from pasted text
        </div>
        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", borderRadius: radius.full, border: `1px solid ${T.border}`, color: T.textPrimary, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <Upload size={15} /> Import from file
          <input type="file" accept="application/json" onChange={doImportFile} style={{ display: "none" }} />
        </label>
      </SectionCard>

      {status && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: radius.sm, marginTop: 14, background: status.ok ? `${T.actionGreen}15` : `${T.actionRed}15`, color: status.ok ? T.actionGreen : T.actionRed, fontSize: 13 }}>
          {status.ok ? <Check size={16} /> : <X size={16} />}
          {status.msg}
        </div>
      )}
    </div>
  );
}

// ── Read-only summary of the current profile, shown above the
// share/import tools so it's obvious what's about to go out. ──
function ProfileSummary({ profile, T, onEdit }) {
  const filledCount = Object.keys(DEFAULT_PROFILE).filter((k) => {
    const v = profile[k];
    if (Array.isArray(v)) return v.length > 0;
    return v !== "" && v !== null && v !== undefined;
  }).length;
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary }}>{profile.displayName || profile.nickname || "My Profile"}</div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{filledCount} of {Object.keys(DEFAULT_PROFILE).length - 1} fields filled</div>
        </div>
        <div onClick={onEdit} style={{ padding: "8px 16px", borderRadius: radius.full, border: `1px solid ${T.contactsTeal}`, color: T.contactsTeal, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Edit
        </div>
      </div>
    </div>
  );
}

export default function MyProfileModule() {
  const [profile, setProfile] = useState(() => MyProfileRepository.getProfile());
  const [editing, setEditing] = useState(false);
  const T = LIGHT;

  const refresh = () => setProfile(MyProfileRepository.getProfile());

  const saveEdit = (form) => {
    MyProfileRepository.update(form);
    refresh();
    setEditing(false);
  };

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif", background: T.bg, minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={{ width: 390, background: T.bg, minHeight: "100vh", borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "18px 16px 0" }}>
          <User size={18} color={T.contactsTeal} />
          <span style={{ fontSize: 12, fontWeight: 700, color: T.contactsTeal, textTransform: "uppercase", letterSpacing: 0.5 }}>My Profile</span>
        </div>

        <ProfileSummary profile={profile} T={T} onEdit={() => setEditing(true)} />
        <ShareImportPanel profile={profile} T={T} onImported={refresh} />

        {editing && (
          <MyProfileEditScreen profile={profile} onSave={saveEdit} onCancel={() => setEditing(false)} T={T} />
        )}
      </div>
    </div>
  );
}
