import React, { useState, useMemo, useEffect, useRef } from "react";
import { Plus, ChevronLeft, Check, Paperclip, Upload, Trash2, Calendar, RefreshCcw, X } from "lucide-react";
import { useEditUndo } from "../calculations/editUndoHelpers";
import {
  ClinicVisitsRepository, DEFAULT_CLINIC_VISIT, generateAdHocMedId,
  CLINICIAN_OPTIONS,
} from "../repositories/clinicVisitsRepository";
// ADDED 19 Aug 2026 — REASON_FOR_VISIT_OPTIONS/FOLLOW_UP_TYPE_OPTIONS
// now live here, real in-app editable option lists.
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { ResultsRegistry } from "../registries/resultsRegistry";
// ADDED 19 Aug 2026 — draft autosave, same pattern as every other
// edit sheet this round.
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, ACCENTS, ACTION, RADIUS } from "../calculations/designTokens";

// Same Healthcare blue + font conventions as Testing — applied from
// creation, not retrofitted, per Kane's standing instruction.
const LIGHT = {
  ...NEUTRAL,
  healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red, actionGreen: ACTION.green,
};
const radius = RADIUS;

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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
              style={{ padding: "5px 10px", borderRadius: radius.full, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.healthcareBlue : T.border}`, color: active ? T.healthcareBlue : T.textSecondary, background: active ? `${T.healthcareBlue}15` : "transparent" }}>
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
    <div onClick={() => onChange(!value)} style={{ width: 40, height: 24, borderRadius: radius.full, background: value ? T.healthcareBlue : T.surfaceVariant, position: "relative", cursor: "pointer", transition: "background 150ms ease" }}>
      <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 20, height: 20, borderRadius: radius.full, background: "#FFFFFF", transition: "left 150ms ease", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </div>
  );
}

function ReadRow({ label, value, T }) {
  if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  const display = Array.isArray(value) ? value.join(", ") : String(value);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 12, color: T.textSecondary, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: T.textPrimary, fontWeight: 500, textAlign: "right" }}>{display}</span>
    </div>
  );
}

// Real relations, all resolved through actual repositories/registries
// — Testing, Medication, Symptoms Registry, Results Registry all exist.
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

// CHANGED — real ask: "allow for more than one." Was single free-text,
// now a real multi-select tag picker — same underlying suggestion-chip
// mechanism, just adds to an array instead of replacing one value.
function getKnownClinicians() {
  const typed = ClinicVisitsRepository.getAll().flatMap((v) => v.clinician || []).filter(Boolean);
  return Array.from(new Set([...CLINICIAN_OPTIONS, ...typed]));
}
function ClinicianField({ value, onChange, T }) {
  const known = useMemo(() => getKnownClinicians(), []);
  const [draft, setDraft] = useState("");
  const visibleSuggestions = known.filter((c) => !value.includes(c)).slice(0, 8);
  const addClinician = (name) => {
    const trimmed = name.trim();
    if (trimmed && !value.includes(trimmed)) onChange([...value, trimmed]);
    setDraft("");
  };
  const removeClinician = (name) => onChange(value.filter((c) => c !== name));
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Clinician(s) (optional)</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          {value.map((c) => (
            <div key={c} onClick={() => removeClinician(c)}
              style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {c} <X size={11} />
            </div>
          ))}
        </div>
      )}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((c) => (
            <div key={c} onClick={() => addClinician(c)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              {c}
            </div>
          ))}
        </div>
      )}
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addClinician(draft); } }}
        onBlur={() => addClinician(draft)}
        placeholder="e.g. Lucy — leave blank if unknown"
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

// ADDED — real ask: "Include location on card if known" — same real
// free-text-plus-suggestions pattern as Clinician above, not a full
// Locations Repository relation (Encounters' own, heavier system) —
// this is just naming which clinic, not a place with its own address/
// notes/related-contact concept.
function getKnownClinicVisitLocations() {
  const typed = ClinicVisitsRepository.getAll().map((v) => v.location).filter(Boolean);
  return Array.from(new Set(typed));
}
function ClinicVisitLocationField({ value, onChange, T }) {
  const known = useMemo(() => getKnownClinicVisitLocations(), []);
  const visibleSuggestions = known.filter((l) => l !== value).slice(0, 8);
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Location (optional)</div>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((l) => (
            <div key={l} onClick={() => onChange(l)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              {l}
            </div>
          ))}
        </div>
      )}
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Conifer Sexual Health Clinic — leave blank if unknown"
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

// ADDED 19 Aug 2026 — real feedback batch: "'Future appointment'
// should read as an explicit yes/no question", not a bare toggle with
// a one-word label that leaves what "on" means to context. Same
// underlying boolean, just an unambiguous either/or.
function YesNoQuestion({ question, value, onChange, T }) {
  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>{question}</div>
      <div style={{ display: "flex", gap: 8 }}>
        {[{ label: "Yes", val: true }, { label: "No", val: false }].map((opt) => (
          <div key={opt.label} onClick={() => onChange(opt.val)}
            style={{ flex: 1, textAlign: "center", padding: "8px 0", borderRadius: radius.sm, cursor: "pointer", fontSize: 13, fontWeight: 700, border: `1px solid ${value === opt.val ? T.healthcareBlue : T.border}`, background: value === opt.val ? `${T.healthcareBlue}15` : "transparent", color: value === opt.val ? T.healthcareBlue : T.textSecondary }}>
            {opt.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — real feedback batch: medications given in-clinic
// that aren't in Kane's personal Medication tracker — a simple
// add/remove list of free-text {name, notes} entries, distinct from
// the registry-linked RelationPicker used for medicationsGivenIds.
function AdHocMedicationsManager({ value, onChange, T }) {
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onChange([...value, { id: generateAdHocMedId(), name: trimmed, notes: notes.trim() }]);
    setName(""); setNotes("");
  };
  const remove = (id) => onChange(value.filter((m) => m.id !== id));
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Other medications given (not in your Medication tracker)</div>
      {value.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
          {value.map((m) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: radius.sm, background: T.surfaceVariant }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{m.name}</div>
                {m.notes && <div style={{ fontSize: 11, color: T.textSecondary }}>{m.notes}</div>}
              </div>
              <X size={14} color={T.actionRed} style={{ cursor: "pointer" }} onClick={() => remove(m.id)} />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ceftriaxone 1g IM"
          style={{ flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 13 }} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)"
          style={{ flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 13 }} />
        <div onClick={add} style={{ padding: "8px 12px", borderRadius: radius.sm, background: T.healthcareBlue, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Add</div>
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — real feedback batch: "linked tests should be
// either pickable from existing Tests, or startable here with just a
// name and continued properly in Testing later." Creates a real,
// minimal Test record (title + this visit's date) via the actual
// TestingRepository, links it immediately, same honest "switches to
// the right module, not a deep-link to the exact record" scope limit
// already used everywhere else cross-module linking happens in this
// app — there's no plumbing anywhere yet for opening one specific
// record from outside its own module.
function StartTestInline({ visitDate, onCreated, T }) {
  const [name, setName] = useState("");
  const [showInput, setShowInput] = useState(false);
  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const test = TestingRepository.create({ title: trimmed, date: visitDate || new Date().toISOString() });
    onCreated(test.id);
    setName(""); setShowInput(false);
  };
  if (!showInput) {
    return (
      <div onClick={() => setShowInput(true)} style={{ fontSize: 11, color: T.healthcareBlue, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
        + Start a new test here
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Test name — continue details in Testing"
        onKeyDown={(e) => { if (e.key === "Enter") create(); }}
        style={{ flex: 1, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontSize: 13 }} />
      <div onClick={create} style={{ padding: "8px 12px", borderRadius: radius.sm, background: T.healthcareBlue, color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Start</div>
    </div>
  );
}

function AttachmentManager({ visitId, attachments, onChanged, T }) {
  const inputRef = useRef(null);
  const [pendingType, setPendingType] = useState("Other");
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      ClinicVisitsRepository.addAttachment(visitId, { title: file.name, type: pendingType, fileDataUrl: reader.result });
      onChanged();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const remove = (id) => { ClinicVisitsRepository.removeAttachment(visitId, id); onChanged(); };
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Attachments</div>
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {attachments.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: radius.sm, background: T.surfaceVariant }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Paperclip size={13} color={T.textSecondary} />
                <div style={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
              </div>
              <Trash2 size={14} color={T.actionRed} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => remove(a.id)} />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <select value={pendingType} onChange={(e) => setPendingType(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, fontSize: 12 }}>
          {["Test result", "Prescription", "ID", "Photo", "Other"].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, color: T.textPrimary, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <Upload size={13} /> Add file
          <input ref={inputRef} type="file" onChange={handleFile} style={{ display: "none" }} />
        </label>
      </div>
    </div>
  );
}

// ── Add/Edit sheet ──
function VisitEditSheet({ visitId, onClose, onSaved, onBeforeEdit, onAfterEdit, T }) {
  const isNew = !visitId;
  const existing = visitId ? ClinicVisitsRepository.getById(visitId) : null;
  // ADDED 19 Aug 2026 — real in-app editable option lists.
  const reasonForVisitOptions = useMemo(() => CustomOptionListsRepository.get("reasonForVisit"), []);
  const followUpTypeOptions = useMemo(() => CustomOptionListsRepository.get("followUpType"), []);
  // ADDED 19 Aug 2026 — draft autosave.
  const draftKey = `visitEdit_${visitId || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return existing || { ...DEFAULT_CLINIC_VISIT };
  });
  const [draftRestored] = useState(() => !!loadDraft(draftKey));
  const [refreshKey, setRefreshKey] = useState(0);
  // CHANGED — real bug fix, same as Encounters: fired on the very
  // first render too, immediately autosaving the pristine, untouched
  // default form the instant this sheet opened — so just opening and
  // closing it with zero real edits left a draft behind, later shown
  // as a false "Restored unsaved changes" prompt. Skips the initial
  // mount with a ref, only saves once the form has genuinely changed.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    saveDraft(draftKey, form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canSave = form.title.trim().length > 0;

  const allTests = useMemo(() => TestingRepository.getAll().filter((t) => !t.isArchived).map((t) => ({ id: t.id, name: t.title || "Untitled test" })), [refreshKey]);
  const allMeds = useMemo(() => MedicationRepository.getAll().filter((m) => !m.isArchived).map((m) => ({ id: m.id, name: m.name })), []);
  const allSymptoms = useMemo(() => SymptomsRegistry.getAll().filter((s) => !s.isArchived), []);
  // ADDED 19 Aug 2026 — real feedback batch: "pulling from recent"
  // symptoms means suggesting real Symptom Log occurrences, not just
  // the vocabulary. Recent-first ordering.
  const allSymptomLogEntries = useMemo(
    () => SymptomLogRepository.getAll().filter((s) => !s.isArchived).sort((a, b) => new Date(b.dateStarted || 0) - new Date(a.dateStarted || 0))
      .map((s) => ({ id: s.id, name: `${s.title || "Symptom entry"} · ${formatDate(s.dateStarted)}` })),
    []
  );
  const allVaccinations = useMemo(
    () => VaccinationRepository.getAll().filter((v) => !v.isArchived).map((v) => ({ id: v.id, name: `${v.title || v.vaccine || "Vaccination"} · ${formatDate(v.date)}` })),
    []
  );

  const save = () => {
    clearDraft(draftKey);
    if (isNew) {
      const created = ClinicVisitsRepository.create(form);
      // Real two-way link: if tests were linked from this side, update
      // each test's own clinicVisitIds too — same reasoning as the
      // proven test in this session's Notion work.
      form.linkedTestIds.forEach((testId) => {
        const test = TestingRepository.getById(testId);
        if (test && !test.clinicVisitIds.includes(created.id)) {
          TestingRepository.update(testId, { clinicVisitIds: [...test.clinicVisitIds, created.id] });
        }
      });
      onSaved(created.id);
    } else {
      const before = ClinicVisitsRepository.getById(visitId);
      // ADDED 19 Aug 2026 — real undo/redo extension, same shared
      // mechanism as every other module.
      onBeforeEdit?.(visitId);
      ClinicVisitsRepository.update(visitId, form);
      onAfterEdit?.(visitId);
      // Sync the two-way link for any tests added/removed this edit.
      const added = form.linkedTestIds.filter((id) => !before.linkedTestIds.includes(id));
      const removed = before.linkedTestIds.filter((id) => !form.linkedTestIds.includes(id));
      added.forEach((testId) => {
        const test = TestingRepository.getById(testId);
        if (test && !test.clinicVisitIds.includes(visitId)) {
          TestingRepository.update(testId, { clinicVisitIds: [...test.clinicVisitIds, visitId] });
        }
      });
      removed.forEach((testId) => {
        const test = TestingRepository.getById(testId);
        if (test) TestingRepository.update(testId, { clinicVisitIds: test.clinicVisitIds.filter((id) => id !== visitId) });
      });
      onSaved(visitId);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 200, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}`, zIndex: 1 }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>{isNew ? "New visit" : "Edit visit"}</span>
        <div onClick={() => canSave && save()}
          style={{ padding: "6px 14px", borderRadius: radius.full, background: canSave ? T.healthcareBlue : T.surfaceVariant, color: canSave ? "#FFFFFF" : T.textDisabled, fontSize: 13, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
          Save
        </div>
      </div>

      {draftRestored && (
        <div style={{ margin: "10px 16px 0", fontSize: 11, color: T.actionGreen, background: `${T.actionGreen}15`, borderRadius: radius.sm, padding: "6px 10px" }}>
          Restored unsaved changes from earlier.
        </div>
      )}

      <div style={{ padding: "0 16px 100px" }}>
        <SectionCard title="Overview" T={T}>
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Routine screening" />
          <TextField label="Date" value={form.date ? form.date.slice(0, 10) : ""} onChange={(v) => set("date")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
          {/* CHANGED 19 Aug 2026 — real feedback batch: free text, not
              a fixed list, and not mandatory (no validation ever
              required it — this was already true, just now also
              genuinely free-text). */}
          <ClinicianField value={form.clinician} onChange={set("clinician")} T={T} />
          <ClinicVisitLocationField value={form.location} onChange={set("location")} T={T} />
          <MultiSelectChips label="Reason for visit" value={form.reasonForVisit} onChange={set("reasonForVisit")} options={reasonForVisitOptions} T={T} />
          {/* CHANGED 19 Aug 2026 — explicit yes/no question, not a
              bare toggle. */}
          <YesNoQuestion question="Is this a future appointment?" value={form.isFutureAppointment} onChange={set("isFutureAppointment")} T={T} />
          {/* ADDED 19 Aug 2026 — real feedback batch: "arrange
              follow-up" — what kind, paired with the existing date
              field for when. */}
          <SelectField label="Arrange follow-up" value={form.followUpType} onChange={set("followUpType")} options={followUpTypeOptions} T={T} />
          {/* ADDED 19 Aug 2026 — real ask: a small descriptor for
              anything ambiguous/unlabelled. "TOC" is a genuine medical
              abbreviation, not obvious without sexual-health context. */}
          {form.followUpType === "TOC" && (
            <div style={{ fontSize: 11, color: T.textDisabled, marginTop: -6, marginBottom: 6 }}>TOC = Test of Cure, a follow-up test confirming treatment actually worked.</div>
          )}
          {/* ADDED — real ask: expand the meaning of the other two
              options too, not just TOC. */}
          {form.followUpType === "Routine" && (
            <div style={{ fontSize: 11, color: T.textDisabled, marginTop: -6, marginBottom: 6 }}>e.g. medication review, annual check-up.</div>
          )}
          {form.followUpType === "Other" && (
            <div style={{ fontSize: 11, color: T.textDisabled, marginTop: -6, marginBottom: 6 }}>e.g. contraception, vaccination.</div>
          )}
          <TextField label="Follow-up / next review date" value={form.nextReviewDate ? form.nextReviewDate.slice(0, 10) : ""} onChange={(v) => set("nextReviewDate")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
        </SectionCard>

        <SectionCard title="Linked records" T={T}>
          <RelationPicker label="Linked tests" value={form.linkedTestIds} onChange={set("linkedTestIds")} items={allTests} T={T} placeholder="No tests logged yet" />
          {/* ADDED 19 Aug 2026 — real feedback batch: start a test
              here with just a name, continue the rest in Testing. */}
          <StartTestInline visitDate={form.date} onCreated={(testId) => { set("linkedTestIds")([...form.linkedTestIds, testId]); setRefreshKey((k) => k + 1); }} T={T} />
          {/* CHANGED 19 Aug 2026 — real feedback batch: each linked
              test's own real result now shows inline, read-only —
              this REPLACES the old standalone Results field (see
              clinicVisitsRepository.js's header for the full
              reasoning: results belong in Testing only, this embeds
              rather than duplicates). */}
          {form.linkedTestIds.length > 0 && (
            <div style={{ marginTop: 4, marginBottom: 8 }}>
              {form.linkedTestIds.map((id) => {
                const t = TestingRepository.getById(id);
                if (!t) return null;
                const resultNames = (t.resultIds || []).map((rid) => ResultsRegistry.getById(rid)?.name).filter(Boolean);
                if (resultNames.length === 0) return null;
                const isPositive = resultNames.some((n) => n.toLowerCase() === "positive");
                return (
                  <div key={id} style={{ fontSize: 11, color: isPositive ? T.actionRed : T.textSecondary, marginBottom: 2 }}>
                    {t.title || "Test"}: <strong>{resultNames.join(", ")}</strong>
                  </div>
                );
              })}
            </div>
          )}

          <RelationPicker label="Medications given (from your Medication tracker)" value={form.medicationsGivenIds} onChange={set("medicationsGivenIds")} items={allMeds} T={T} placeholder="No medications in registry" />
          <AdHocMedicationsManager value={form.adHocMedicationsGiven} onChange={set("adHocMedicationsGiven")} T={T} />

          <RelationPicker label="Vaccinations given" value={form.vaccinationsGivenIds} onChange={set("vaccinationsGivenIds")} items={allVaccinations} T={T} placeholder="No vaccinations logged yet" />

          <RelationPicker label="Symptom types discussed" value={form.symptomTypeIds} onChange={set("symptomTypeIds")} items={allSymptoms} T={T} placeholder="No symptoms in registry" />
          {/* ADDED 19 Aug 2026 — real feedback batch: pull from recent
              real Symptom Log entries, richer than the flat vocabulary
              picker above. */}
          <RelationPicker label="Specific symptom entries discussed" value={form.symptomsDiscussedIds} onChange={(v) => {
            set("symptomsDiscussedIds")(v);
            if (form.primaryReasonSymptomLogId && !v.includes(form.primaryReasonSymptomLogId)) set("primaryReasonSymptomLogId")("");
          }} items={allSymptomLogEntries} T={T} placeholder="No symptom entries logged yet" />
          {form.symptomsDiscussedIds.length > 0 && (
            <div style={{ padding: "6px 0" }}>
              <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 4 }}>Which one is why you're here? (optional)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {form.symptomsDiscussedIds.map((id) => {
                  const s = SymptomLogRepository.getById(id);
                  const isPrimary = form.primaryReasonSymptomLogId === id;
                  return (
                    <div key={id} onClick={() => set("primaryReasonSymptomLogId")(isPrimary ? "" : id)}
                      style={{ padding: "4px 9px", borderRadius: radius.full, fontSize: 11, fontWeight: isPrimary ? 700 : 400, cursor: "pointer", border: `1px solid ${isPrimary ? T.actionRed : T.border}`, color: isPrimary ? T.actionRed : T.textSecondary, background: isPrimary ? `${T.actionRed}12` : "transparent" }}>
                      {s?.title || "Entry"}{isPrimary ? " ★" : ""}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Clinical notes</div>
            <textarea value={form.clinicalNotes} onChange={(e) => set("clinicalNotes")(e.target.value)} rows={3}
              placeholder="e.g. Discussed PrEP adherence, no concerns raised. Advised to continue current regimen."
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </div>
        </SectionCard>

        {!isNew && (
          <SectionCard title="Attachments" T={T}>
            <AttachmentManager visitId={visitId} attachments={ClinicVisitsRepository.getById(visitId)?.attachments || []} onChanged={() => setForm(ClinicVisitsRepository.getById(visitId))} T={T} />
          </SectionCard>
        )}
        {isNew && (
          <div style={{ fontSize: 11, color: T.textDisabled, textAlign: "center", padding: "12px 0", fontStyle: "italic" }}>
            Save this visit first, then attachments can be added.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail view ──
function VisitDetail({ visitId, onBack, onEdit, onOpenTest, T }) {
  const [visit, setVisit] = useState(() => ClinicVisitsRepository.getById(visitId));
  // ADDED — real ask: real delete, with a confirmation step, same
  // pattern already proven for Testing/Vaccinations/Symptom Log.
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!visit) return null;

  const testEntries = visit.linkedTestIds.map((id) => TestingRepository.getById(id)).filter(Boolean);
  const medNames = visit.medicationsGivenIds.map((id) => MedicationRepository.getById(id)?.name).filter(Boolean);
  const symptomNames = visit.symptomTypeIds.map((id) => SymptomsRegistry.getById(id)?.name).filter(Boolean);
  const symptomLogEntries = visit.symptomsDiscussedIds.map((id) => SymptomLogRepository.getById(id)).filter(Boolean);
  const vaccinationEntries = visit.vaccinationsGivenIds.map((id) => VaccinationRepository.getById(id)).filter(Boolean);

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={() => onEdit(visitId)}>Edit</span>
          <Trash2 size={17} color={T.actionRed} style={{ cursor: "pointer" }} onClick={() => setConfirmDelete(true)} />
        </div>
      </div>
      {confirmDelete && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: radius.sm, border: `1px solid ${T.actionRed}`, background: `${T.actionRed}11` }}>
          <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>
            This permanently deletes the record — unlike archiving, there's no getting it back. Only use this for a genuinely wrong entry.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={() => { ClinicVisitsRepository.delete(visitId); onBack(); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.actionRed, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Delete permanently</button>
          </div>
        </div>
      )}

      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: T.healthcareBlue, display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{visit.title || "Untitled visit"}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20, fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(visit.date)}</div>

        <SectionCard title="Overview" T={T}>
          <ReadRow label="Clinician" value={visit.clinician} T={T} />
          <ReadRow label="Location" value={visit.location} T={T} />
          <ReadRow label="Reason for visit" value={visit.reasonForVisit} T={T} />
          <ReadRow label="Future appointment" value={visit.isFutureAppointment ? "Yes" : ""} T={T} />
          <ReadRow label="Follow-up arranged" value={visit.followUpType && visit.followUpType !== "None" ? visit.followUpType : ""} T={T} />
          <ReadRow label="Follow-up / next review" value={formatDate(visit.nextReviewDate) !== "—" ? formatDate(visit.nextReviewDate) : ""} T={T} />
        </SectionCard>

        <SectionCard title="Linked records" T={T}>
          {testEntries.length > 0 && (
            <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Linked tests</div>
              {testEntries.map((t) => {
                const resultNames = (t.resultIds || []).map((rid) => ResultsRegistry.getById(rid)?.name).filter(Boolean);
                const isPositive = resultNames.some((n) => n.toLowerCase() === "positive");
                return (
                  <div key={t.id} onClick={() => onOpenTest?.(t.id)} style={{ cursor: onOpenTest ? "pointer" : "default", marginBottom: 4 }}>
                    <div style={{ fontSize: 13, color: T.healthcareBlue, fontWeight: 600 }}>{t.title || "Test"}</div>
                    {/* CHANGED 19 Aug 2026 — embeds the linked test's OWN
                        real result live, replacing the old standalone
                        (and duplicative) resultIds field. */}
                    {resultNames.length > 0 && (
                      <div style={{ fontSize: 11, color: isPositive ? T.actionRed : T.textSecondary, fontWeight: isPositive ? 700 : 400 }}>{resultNames.join(", ")}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <ReadRow label="Medications given (tracker)" value={medNames} T={T} />
          {visit.adHocMedicationsGiven.length > 0 && (
            <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Other medications given</div>
              {visit.adHocMedicationsGiven.map((m) => (
                <div key={m.id} style={{ fontSize: 13, color: T.textPrimary, marginBottom: 2 }}>{m.name}{m.notes ? ` — ${m.notes}` : ""}</div>
              ))}
            </div>
          )}
          <ReadRow label="Vaccinations given" value={vaccinationEntries.map((v) => v.title || v.vaccine)} T={T} />
          <ReadRow label="Symptom types discussed" value={symptomNames} T={T} />
          {symptomLogEntries.length > 0 && (
            <div style={{ padding: "7px 0" }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Specific symptom entries</div>
              {symptomLogEntries.map((s) => (
                <div key={s.id} style={{ fontSize: 13, color: visit.primaryReasonSymptomLogId === s.id ? T.actionRed : T.textPrimary, fontWeight: visit.primaryReasonSymptomLogId === s.id ? 700 : 400, marginBottom: 2 }}>
                  {s.title}{visit.primaryReasonSymptomLogId === s.id ? " — why I'm here" : ""}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          <ReadRow label="Clinical notes" value={visit.clinicalNotes} T={T} />
        </SectionCard>

        {visit.attachments.length > 0 && (
          <SectionCard title="Attachments" T={T}>
            {visit.attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                <Paperclip size={13} color={T.textSecondary} />
                <span style={{ fontSize: 13, color: T.textPrimary }}>{a.title}</span>
                <span style={{ fontSize: 11, color: T.textDisabled }}>({a.type})</span>
              </div>
            ))}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ── List / landing view ──
function VisitsLanding({ onOpen, onAdd, T }) {
  const [visits, setVisits] = useState(() => ClinicVisitsRepository.getAll().filter((v) => !v.isArchived));
  const sorted = useMemo(() => [...visits].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [visits]);

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ padding: "18px 16px 2px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary }}>Clinic Visits</span>
      </div>
      {/* CHANGED — same real fix, consistent with the standardized
          floating-add-button ask applied across every other module. */}
      <div onClick={onAdd} style={{ position: "fixed", bottom: 90, right: 20, width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", zIndex: 20 }}>
        <Plus size={24} />
      </div>

      <div style={{ padding: "12px 16px 100px", display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>
            No clinic visits logged yet. Tap + to add one.
          </div>
        )}
        {sorted.map((v) => (
          <div key={v.id} onClick={() => onOpen(v.id)}
            style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.md, padding: 14, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: radius.full, background: T.healthcareBlue, display: "inline-block" }} />
              <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{v.title || "Untitled visit"}</span>
              {v.isFutureAppointment && <Calendar size={13} color={T.healthcareBlue} />}
            </div>
            <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(v.date)}</div>
            {/* CHANGED — real bug caught before shipping: clinician is
                now an array (multiple clinicians support), rendering
                it directly would either show nothing (empty array is
                truthy but has no content) or concatenate names with
                no separator. */}
            {v.clinician.length > 0 && <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2 }}>{v.clinician.join(", ")}</div>}
            {v.location && <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2 }}>{v.location}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top-level module ──
export default function ClinicVisitsModule({ openAddOnMount = false, onConsumedQuickAdd, onOpenTest } = {}) {
  const [screen, setScreen] = useState({ name: "landing" });
  const T = LIGHT;
  // ADDED 19 Aug 2026 — real undo/redo extension.
  const editUndo = useEditUndo(ClinicVisitsRepository);

  useEffect(() => {
    if (openAddOnMount) {
      setScreen({ name: "edit", id: null });
      onConsumedQuickAdd?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToList = () => setScreen({ name: "landing" });

  let screenContent = null;
  if (screen.name === "landing") {
    screenContent = <VisitsLanding T={T} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "edit", id: null })} />;
  } else if (screen.name === "detail") {
    screenContent = <VisitDetail T={T} visitId={screen.id} onBack={backToList} onEdit={(id) => setScreen({ name: "edit", id })} onOpenTest={onOpenTest} />;
  } else if (screen.name === "edit") {
    screenContent = (
      <VisitEditSheet T={T} visitId={screen.id}
        onClose={() => setScreen(screen.id ? { name: "detail", id: screen.id } : { name: "landing" })}
        onSaved={(id) => setScreen({ name: "detail", id })}
        onBeforeEdit={editUndo.captureBeforeEdit}
        onAfterEdit={editUndo.notifyEdited} />
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      {/* ADDED 19 Aug 2026 — real undo/redo toast, same pattern as
          every other module. */}
      {editUndo.toast && (
        <div onClick={editUndo.toast.mode === "undo" ? editUndo.undo : editUndo.redo}
          style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", width: 340, background: editUndo.toast.mode === "undo" ? "#1B1B1F" : T.healthcareBlue, color: "#FFFFFF", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {editUndo.toast.mode === "undo" ? <Check size={14} /> : <RefreshCcw size={14} />}
          {editUndo.toast.mode === "undo" ? "Clinic visit updated — tap to undo" : "Undone — tap to redo"}
        </div>
      )}
      {screenContent}
    </div>
  );
}
