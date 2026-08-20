import React, { useState, useMemo, useEffect } from "react";
import { Plus, ChevronLeft, Check, Archive, ArchiveRestore } from "lucide-react";
import { SymptomLogRepository, DEFAULT_SYMPTOM_ENTRY, SEVERITY_OPTIONS } from "../repositories/symptomLogRepository";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { EncounterRepository } from "../repositories/encounterRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";

// ADDED 19 Aug 2026 — Symptom Log (Symptoms Tracker in Notion — see
// symptomLogRepository.js's header for the deliberate naming decision
// avoiding confusion with the Symptoms Registry vocabulary). Same
// self-contained-module pattern, Healthcare blue, Public Sans +
// JetBrains Mono conventions as Testing/Clinic Visits.
const LIGHT = {
  bg: "#F0F0F3", surface: "#FFFFFF", surfaceVariant: "#E7E7EB", border: "#DCDCE1",
  textPrimary: "#1B1B1F", textSecondary: "#5B5B62", textDisabled: "#9A9AA1",
  healthcareBlue: "#4A80F0", actionRed: "#E5484D", actionGreen: "#1B9E77",
};
const radius = { sm: 8, md: 16, lg: 24, full: 999 };
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');`;

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function severityColor(severity, T) {
  if (severity === "Severe") return T.actionRed;
  if (severity === "Moderate") return "#F59E0B";
  return T.textSecondary;
}

function SectionCard({ title, T, children }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: radius.md, background: T.surface, padding: "4px 14px 14px", marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue, textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 12, marginBottom: 2 }}>{title}</div>
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, T, placeholder, type = "text" }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
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

// Single-value picker over SymptomsRegistry — deliberately single, not
// a tag list: this entry already has its own free-text Title (what
// happened), Symptom here is "which vocabulary entry does this map
// to" — one real occurrence maps to one registry concept in every case
// Kane's actual data suggests, same judgment already applied to
// Encounters' locationId.
function SymptomSelect({ value, onChange, T }) {
  const entries = SymptomsRegistry.getAll().filter((e) => !e.isArchived);
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Symptom (registry)</div>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }}>
        <option value="">—</option>
        {entries.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
    </div>
  );
}

// Real relations, both ends now exist — Kane's standing instruction.
// Multi-select tag pickers over Encounters/Tests, same visual pattern
// as Clinic Visits' own RelationPicker.
function RelationPicker({ label, value, onChange, T, items, placeholder }) {
  const visibleSuggestions = items.filter((i) => !value.includes(i.id)).slice(0, 8);
  const nameFor = (id) => items.find((i) => i.id === id)?.name || "?";
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((id) => (
            <div key={id} onClick={() => onChange(value.filter((v) => v !== id))}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer" }}>
              {nameFor(id)} ✕
            </div>
          ))}
        </div>
      )}
      {visibleSuggestions.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {visibleSuggestions.map((i) => (
            <div key={i.id} onClick={() => onChange([...value, i.id])}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              + {i.name}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: T.textDisabled, fontStyle: "italic" }}>{placeholder}</div>
      )}
    </div>
  );
}

function ReadRow({ label, value, T, alert }) {
  if (value === "" || value == null || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.textSecondary, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: alert ? T.actionRed : T.textPrimary, fontWeight: 500, textAlign: "right" }}>{display}</span>
    </div>
  );
}

function EntrySheet({ entry, onSave, onClose, T }) {
  const isNew = !entry;
  const draftKey = `symptomLog_${entry?.id || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return entry ? { ...entry } : { ...DEFAULT_SYMPTOM_ENTRY, dateStarted: new Date().toISOString().slice(0, 10) };
  });
  useEffect(() => { saveDraft(draftKey, form); }, [form]);
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canSave = form.title.trim().length > 0;
  const encounters = useMemo(() => EncounterRepository.getAll().map((e) => ({ id: e.id, name: `${e.title || e.encounterType || "Encounter"} · ${formatDate(e.date)}` })), []);
  const tests = useMemo(() => TestingRepository.getAll().filter((t) => !t.isArchived).map((t) => ({ id: t.id, name: `${t.title || (t.testingFor || []).join("/") || "Test"} · ${formatDate(t.date)}` })), []);

  const doSave = () => {
    clearDraft(draftKey);
    onSave(form);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 210 }} onClick={onClose}>
      <div style={{ background: T.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>{isNew ? "Log symptom" : "Edit symptom entry"}</span>
        </div>
        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Rash after chem session" />
          <SymptomSelect value={form.symptomId} onChange={set("symptomId")} T={T} />
          <SelectField label="Severity" value={form.severity} onChange={set("severity")} options={SEVERITY_OPTIONS} T={T} />
          <TextField label="Date started" value={form.dateStarted} onChange={set("dateStarted")} T={T} type="date" />
          <TextField label="Date resolved (leave blank if still active)" value={form.dateResolved} onChange={set("dateResolved")} T={T} type="date" />
          <RelationPicker label="Related encounters" value={form.relatedEncounterIds} onChange={set("relatedEncounterIds")} T={T} items={encounters} placeholder="No encounters logged yet" />
          <RelationPicker label="Related tests" value={form.relatedTestIds} onChange={set("relatedTestIds")} T={T} items={tests} placeholder="No tests logged yet" />
          <div style={{ padding: "8px 0 20px" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Notes</div>
            <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={() => canSave && doSave()} style={{ width: "100%", padding: 16, borderRadius: radius.full, border: "none", background: canSave ? T.healthcareBlue : T.textDisabled, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
            {isNew ? "Add entry" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryDetail({ entryId, onBack, onEdit, T }) {
  const [entry, setEntry] = useState(() => SymptomLogRepository.getById(entryId));
  if (!entry) return null;
  const symptomName = SymptomsRegistry.getById(entry.symptomId)?.name;
  const encounterNames = entry.relatedEncounterIds.map((id) => {
    const e = EncounterRepository.getById(id);
    return e ? `${e.title || e.encounterType || "Encounter"} · ${formatDate(e.date)}` : null;
  }).filter(Boolean);
  const testNames = entry.relatedTestIds.map((id) => {
    const t = TestingRepository.getById(id);
    return t ? `${t.title || (t.testingFor || []).join("/") || "Test"} · ${formatDate(t.date)}` : null;
  }).filter(Boolean);
  const isActive = !entry.dateResolved;

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={() => onEdit(entryId)}>Edit</span>
      </div>
      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: isActive ? severityColor(entry.severity, T) : T.actionGreen, display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{entry.title}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20, fontFamily: "'JetBrains Mono', monospace" }}>
          {isActive ? "Active" : `Resolved ${formatDate(entry.dateResolved)}`}
        </div>

        <SectionCard title="Overview" T={T}>
          <ReadRow label="Symptom" value={symptomName} T={T} />
          <ReadRow label="Severity" value={entry.severity} T={T} alert={entry.severity === "Severe"} />
          <ReadRow label="Started" value={formatDate(entry.dateStarted)} T={T} />
          <ReadRow label="Resolved" value={entry.dateResolved ? formatDate(entry.dateResolved) : ""} T={T} />
        </SectionCard>

        {(encounterNames.length > 0 || testNames.length > 0) && (
          <SectionCard title="Related records" T={T}>
            <ReadRow label="Encounters" value={encounterNames} T={T} />
            <ReadRow label="Tests" value={testNames} T={T} />
          </SectionCard>
        )}

        <SectionCard title="Notes" T={T}>
          <ReadRow label="Notes" value={entry.notes} T={T} />
        </SectionCard>
      </div>
    </div>
  );
}

function SymptomLogLanding({ onOpen, onAdd, T }) {
  const [entries, setEntries] = useState(() => SymptomLogRepository.getAll().filter((e) => !e.isArchived));
  const active = useMemo(() => entries.filter((e) => !e.dateResolved).sort((a, b) => new Date(b.dateStarted || 0) - new Date(a.dateStarted || 0)), [entries]);
  const resolved = useMemo(() => entries.filter((e) => e.dateResolved).sort((a, b) => new Date(b.dateResolved) - new Date(a.dateResolved)), [entries]);

  const Row = (e) => {
    const symptomName = SymptomsRegistry.getById(e.symptomId)?.name;
    const isActive = !e.dateResolved;
    return (
      <div key={e.id} onClick={() => onOpen(e.id)}
        style={{ background: T.surface, border: `1px solid ${isActive && e.severity === "Severe" ? T.actionRed : T.border}`, borderRadius: radius.md, padding: 14, cursor: "pointer", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: radius.full, background: isActive ? severityColor(e.severity, T) : T.actionGreen, display: "inline-block" }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{e.title}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
          {symptomName ? `${symptomName} · ` : ""}{formatDate(e.dateStarted)}{e.severity ? ` · ${e.severity}` : ""}
        </div>
      </div>
    );
  };

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ padding: "18px 16px 2px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary }}>Symptom Log</span>
        <Plus size={22} color={T.healthcareBlue} style={{ cursor: "pointer" }} onClick={onAdd} />
      </div>
      <div style={{ padding: "12px 16px 100px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Active ({active.length})</div>
        {active.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 20px", color: T.textDisabled, fontSize: 13 }}>Nothing active. Tap + to log a symptom.</div>
        ) : active.map(Row)}

        {resolved.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, margin: "16px 0 6px" }}>Resolved ({resolved.length})</div>
            {resolved.map(Row)}
          </>
        )}
      </div>
    </div>
  );
}

export default function SymptomLogModule({ openAddOnMount = false, onConsumedQuickAdd } = {}) {
  const [screen, setScreen] = useState({ name: "list" });

  useEffect(() => {
    if (openAddOnMount) {
      setScreen({ name: "add" });
      onConsumedQuickAdd?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToList = () => setScreen({ name: "list" });
  const createEntry = (data) => { SymptomLogRepository.create(data); backToList(); };
  const saveEntry = (data) => { SymptomLogRepository.update(screen.id, data); setScreen({ name: "detail", id: screen.id }); };

  let content;
  if (screen.name === "list") content = <SymptomLogLanding T={LIGHT} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "add" })} />;
  else if (screen.name === "detail") content = <EntryDetail T={LIGHT} entryId={screen.id} onBack={backToList} onEdit={(id) => setScreen({ name: "edit", id })} />;

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif", background: LIGHT.bg, minHeight: "100vh" }}>
      <style>{FONT_IMPORT}</style>
      {content}
      {screen.name === "add" && <EntrySheet T={LIGHT} entry={null} onSave={createEntry} onClose={backToList} />}
      {screen.name === "edit" && <EntrySheet T={LIGHT} entry={SymptomLogRepository.getById(screen.id)} onSave={saveEntry} onClose={() => setScreen({ name: "detail", id: screen.id })} />}
    </div>
  );
}
