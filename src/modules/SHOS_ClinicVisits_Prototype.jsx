import React, { useState, useMemo, useEffect, useRef } from "react";
import { Plus, ChevronLeft, Check, Paperclip, Upload, Trash2, Calendar } from "lucide-react";
import {
  ClinicVisitsRepository, DEFAULT_CLINIC_VISIT,
  CLINICIAN_OPTIONS, REASON_FOR_VISIT_OPTIONS,
} from "../repositories/clinicVisitsRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { ResultsRegistry } from "../registries/resultsRegistry";
// ADDED 19 Aug 2026 — draft autosave, same pattern as every other
// edit sheet this round.
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";

// Same Healthcare blue + font conventions as Testing — applied from
// creation, not retrofitted, per Kane's standing instruction.
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
function VisitEditSheet({ visitId, onClose, onSaved, T }) {
  const isNew = !visitId;
  const existing = visitId ? ClinicVisitsRepository.getById(visitId) : null;
  // ADDED 19 Aug 2026 — draft autosave.
  const draftKey = `visitEdit_${visitId || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return existing || { ...DEFAULT_CLINIC_VISIT };
  });
  const [draftRestored] = useState(() => !!loadDraft(draftKey));
  useEffect(() => {
    saveDraft(draftKey, form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canSave = form.title.trim().length > 0;

  const allTests = useMemo(() => TestingRepository.getAll().filter((t) => !t.isArchived).map((t) => ({ id: t.id, name: t.title || "Untitled test" })), []);
  const allMeds = useMemo(() => MedicationRepository.getAll().filter((m) => !m.isArchived).map((m) => ({ id: m.id, name: m.name })), []);
  const allSymptoms = useMemo(() => SymptomsRegistry.getAll().filter((s) => !s.isArchived), []);
  const allResults = useMemo(() => ResultsRegistry.getAll().filter((r) => !r.isArchived), []);

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
      ClinicVisitsRepository.update(visitId, form);
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
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 50, overflowY: "auto" }}>
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
          <SelectField label="Clinician" value={form.clinician} onChange={set("clinician")} options={CLINICIAN_OPTIONS} T={T} />
          <MultiSelectChips label="Reason for visit" value={form.reasonForVisit} onChange={set("reasonForVisit")} options={REASON_FOR_VISIT_OPTIONS} T={T} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ fontSize: 13, color: T.textPrimary }}>Future appointment</span>
            <ToggleSwitch T={T} value={form.isFutureAppointment} onChange={set("isFutureAppointment")} />
          </div>
          <TextField label="Next review date" value={form.nextReviewDate ? form.nextReviewDate.slice(0, 10) : ""} onChange={(v) => set("nextReviewDate")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
        </SectionCard>

        <SectionCard title="Linked records" T={T}>
          <RelationPicker label="Linked tests" value={form.linkedTestIds} onChange={set("linkedTestIds")} items={allTests} T={T} placeholder="No tests logged yet" />
          <RelationPicker label="Medications given" value={form.medicationsGivenIds} onChange={set("medicationsGivenIds")} items={allMeds} T={T} placeholder="No medications in registry" />
          <RelationPicker label="Symptom types" value={form.symptomTypeIds} onChange={set("symptomTypeIds")} items={allSymptoms} T={T} placeholder="No symptoms in registry" />
          <RelationPicker label="Results" value={form.resultIds} onChange={set("resultIds")} items={allResults} T={T} placeholder="No results in registry" />
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Clinical notes</div>
            <textarea value={form.clinicalNotes} onChange={(e) => set("clinicalNotes")(e.target.value)} rows={3}
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
  if (!visit) return null;

  const testNames = visit.linkedTestIds.map((id) => ({ id, name: TestingRepository.getById(id)?.title })).filter((t) => t.name);
  const medNames = visit.medicationsGivenIds.map((id) => MedicationRepository.getById(id)?.name).filter(Boolean);
  const symptomNames = visit.symptomTypeIds.map((id) => SymptomsRegistry.getById(id)?.name).filter(Boolean);
  const resultNames = visit.resultIds.map((id) => ResultsRegistry.getById(id)?.name).filter(Boolean);

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={() => onEdit(visitId)}>Edit</span>
      </div>

      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: T.healthcareBlue, display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{visit.title || "Untitled visit"}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20, fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(visit.date)}</div>

        <SectionCard title="Overview" T={T}>
          <ReadRow label="Clinician" value={visit.clinician} T={T} />
          <ReadRow label="Reason for visit" value={visit.reasonForVisit} T={T} />
          <ReadRow label="Future appointment" value={visit.isFutureAppointment ? "Yes" : ""} T={T} />
          <ReadRow label="Next review" value={formatDate(visit.nextReviewDate) !== "—" ? formatDate(visit.nextReviewDate) : ""} T={T} />
        </SectionCard>

        <SectionCard title="Linked records" T={T}>
          {testNames.length > 0 && (
            <div style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Linked tests</div>
              {testNames.map((t) => (
                <div key={t.id} onClick={() => onOpenTest?.(t.id)} style={{ fontSize: 13, color: T.healthcareBlue, fontWeight: 600, cursor: onOpenTest ? "pointer" : "default", marginBottom: 2 }}>{t.name}</div>
              ))}
            </div>
          )}
          <ReadRow label="Medications given" value={medNames} T={T} />
          <ReadRow label="Symptom types" value={symptomNames} T={T} />
          <ReadRow label="Results" value={resultNames} T={T} />
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
        <Plus size={22} color={T.healthcareBlue} style={{ cursor: "pointer" }} onClick={onAdd} />
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
            {v.clinician && <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2 }}>{v.clinician}</div>}
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
        onSaved={(id) => setScreen({ name: "detail", id })} />
    );
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <style>{`${FONT_IMPORT}`}</style>
      {screenContent}
    </div>
  );
}
