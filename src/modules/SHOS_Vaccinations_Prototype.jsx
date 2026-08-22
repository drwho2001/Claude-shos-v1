import React, { useState, useMemo, useEffect, useRef } from "react";
import { Plus, ChevronLeft, Check, RefreshCcw } from "lucide-react";
import { VaccinationRepository, DEFAULT_VACCINATION } from "../repositories/vaccinationRepository";
// ADDED 19 Aug 2026 — VACCINE_OPTIONS/REASON_OPTIONS/INJECTION_SITE_OPTIONS
// now live here, real in-app editable option lists.
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
import { useEditUndo } from "../calculations/editUndoHelpers";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, ACCENTS, ACTION, RADIUS } from "../calculations/designTokens";

// ADDED 19 Aug 2026 — Vaccinations, real live Notion schema. Same
// self-contained-module pattern, Healthcare blue, Public Sans +
// JetBrains Mono conventions as Testing/Clinic Visits/Symptom Log.
const LIGHT = {
  ...NEUTRAL,
  healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red,
};
const radius = RADIUS;

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function isOverdue(nextDue) {
  if (!nextDue) return false;
  return nextDue < new Date().toISOString().slice(0, 10);
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

// CHANGED — real ask: "not an exhaustive vaccine name given, should be
// free/partially free text with recognition, so e.g. MENACWY can be
// added" — the underlying data already came from the editable option
// list, but the field itself was still a closed <select>, meaning
// typing a new one directly on this form wasn't actually possible.
// Same free-text-plus-suggestions pattern already proven for Clinician
// in Clinic Visits — genuinely typing a new value here also saves it
// to the real shared option list, so it's a real suggestion next time.
function VaccineField({ value, onChange, options, onAddNew, T }) {
  const visibleSuggestions = options.filter((v) => v !== value).slice(0, 8);
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Vaccine</div>
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((v) => (
            <div key={v} onClick={() => onChange(v)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              {v}
            </div>
          ))}
        </div>
      )}
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        onBlur={() => { if (value && value.trim()) onAddNew(value.trim()); }}
        placeholder="e.g. MENACWY"
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
    </div>
  );
}

function VaccinationSheet({ vaccination, onSave, onClose, T }) {
  const isNew = !vaccination;
  // ADDED 19 Aug 2026 — real in-app editable option lists.
  const [vaccineOptions, setVaccineOptions] = useState(() => CustomOptionListsRepository.get("vaccine"));
  const vaccinationReasonOptions = useMemo(() => CustomOptionListsRepository.get("vaccinationReason"), []);
  const injectionSiteOptions = useMemo(() => CustomOptionListsRepository.get("injectionSite"), []);
  const draftKey = `vaccination_${vaccination?.id || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return vaccination ? { ...vaccination } : { ...DEFAULT_VACCINATION, date: new Date().toISOString().slice(0, 10) };
  });
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
  }, [form]);
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canSave = form.title.trim().length > 0;
  const symptoms = useMemo(() => SymptomsRegistry.getAll().filter((s) => !s.isArchived), []);
  const visits = useMemo(() => ClinicVisitsRepository.getAll().filter((v) => !v.isArchived).map((v) => ({ id: v.id, name: `${v.title || (v.reasonForVisit || []).join("/") || "Clinic visit"} · ${formatDate(v.date)}` })), []);

  const doSave = () => {
    clearDraft(draftKey);
    onSave(form);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 210 }} onClick={onClose}>
      <div style={{ background: T.bg, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>{isNew ? "Log vaccination" : "Edit vaccination"}</span>
        </div>
        <div style={{ overflowY: "auto", padding: "0 20px", flex: 1 }}>
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Hep B booster" />
          <VaccineField value={form.vaccine} onChange={set("vaccine")} options={vaccineOptions}
            onAddNew={(v) => setVaccineOptions(CustomOptionListsRepository.add("vaccine", v))} T={T} />
          <MultiSelectChips label="Reason" value={form.reason} onChange={set("reason")} options={vaccinationReasonOptions} T={T} />
          <TextField label="Dose number" value={form.doseNumber ?? ""} onChange={(v) => set("doseNumber")(v === "" ? null : Number(v))} T={T} type="number" />
          <TextField label="Date" value={form.date} onChange={set("date")} T={T} type="date" />
          <TextField label="Next due" value={form.nextDue} onChange={set("nextDue")} T={T} type="date" />
          <SelectField label="Injection site" value={form.injectionSite} onChange={set("injectionSite")} options={injectionSiteOptions} T={T} />
          <TextField label="Provider" value={form.provider} onChange={set("provider")} T={T} placeholder="e.g. Sexual Health Clinic" />
          <MultiSelectChips label="Symptom" value={form.symptomIds} onChange={set("symptomIds")}
            options={symptoms.map((s) => s.name)} T={T} />
          <RelationPicker label="Clinic visits" value={form.clinicVisitIds} onChange={set("clinicVisitIds")} T={T} items={visits} placeholder="No clinic visits logged yet" />
          <div style={{ padding: "8px 0 20px" }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>Notes</div>
            <textarea value={form.notes} onChange={(e) => set("notes")(e.target.value)} rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box", resize: "vertical" }} />
          </div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <button onClick={() => canSave && doSave()} style={{ width: "100%", padding: 16, borderRadius: radius.full, border: "none", background: canSave ? T.healthcareBlue : T.textDisabled, color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: canSave ? "pointer" : "default" }}>
            {isNew ? "Add vaccination" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VaccinationDetail({ vaccinationId, onBack, onEdit, T }) {
  const [v, setV] = useState(() => VaccinationRepository.getById(vaccinationId));
  if (!v) return null;
  const overdue = isOverdue(v.nextDue);
  const visitNames = v.clinicVisitIds.map((id) => {
    const visit = ClinicVisitsRepository.getById(id);
    return visit ? `${visit.title || (visit.reasonForVisit || []).join("/") || "Clinic visit"} · ${formatDate(visit.date)}` : null;
  }).filter(Boolean);

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={() => onEdit(vaccinationId)}>Edit</span>
      </div>
      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: overdue ? T.actionRed : T.healthcareBlue, display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{v.title}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20, fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(v.date)}</div>

        <SectionCard title="Overview" T={T}>
          <ReadRow label="Vaccine" value={v.vaccine} T={T} />
          <ReadRow label="Reason" value={v.reason} T={T} />
          <ReadRow label="Dose number" value={v.doseNumber} T={T} />
          <ReadRow label="Injection site" value={v.injectionSite} T={T} />
          <ReadRow label="Provider" value={v.provider} T={T} />
          <ReadRow label="Next due" value={v.nextDue ? formatDate(v.nextDue) : ""} T={T} alert={overdue} />
        </SectionCard>

        {(v.symptomIds.length > 0 || visitNames.length > 0) && (
          <SectionCard title="Related records" T={T}>
            <ReadRow label="Symptom" value={v.symptomIds} T={T} />
            <ReadRow label="Clinic visits" value={visitNames} T={T} />
          </SectionCard>
        )}

        <SectionCard title="Notes" T={T}>
          <ReadRow label="Notes" value={v.notes} T={T} />
        </SectionCard>
      </div>
    </div>
  );
}

function VaccinationsLanding({ onOpen, onAdd, T }) {
  const [vaccinations, setVaccinations] = useState(() => VaccinationRepository.getAll().filter((v) => !v.isArchived));
  const sorted = useMemo(() => [...vaccinations].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [vaccinations]);
  const overdueCount = sorted.filter((v) => isOverdue(v.nextDue)).length;

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ padding: "18px 16px 2px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary }}>Vaccinations</span>
      </div>
      {overdueCount > 0 && (
        <div style={{ margin: "8px 16px 0", fontSize: 12, color: T.actionRed, fontWeight: 600 }}>{overdueCount} overdue</div>
      )}
      {/* CHANGED — real ask: Add button now floats bottom-right, same
          fixed-position pattern as every other module, instead of an
          inline header icon that scrolled away with the rest of the
          page. */}
      <div onClick={onAdd} style={{ position: "fixed", bottom: 90, right: 20, width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", zIndex: 20 }}>
        <Plus size={24} />
      </div>
      <div style={{ padding: "12px 16px 100px", display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>
            No vaccinations logged yet. Tap + to add one.
          </div>
        )}
        {sorted.map((v) => {
          const overdue = isOverdue(v.nextDue);
          return (
            <div key={v.id} onClick={() => onOpen(v.id)}
              style={{ background: T.surface, border: `1px solid ${overdue ? T.actionRed : T.border}`, borderRadius: radius.md, padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: radius.full, background: overdue ? T.actionRed : T.healthcareBlue, display: "inline-block" }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{v.title}</span>
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(v.date)}</div>
              {v.nextDue && (
                <div style={{ fontSize: 12, color: overdue ? T.actionRed : T.textSecondary, marginLeft: 16, marginTop: 2, fontWeight: overdue ? 700 : 400 }}>
                  {overdue ? "Overdue since" : "Next due"} {formatDate(v.nextDue)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function VaccinationsModule({ openAddOnMount = false, onConsumedQuickAdd } = {}) {
  const [screen, setScreen] = useState({ name: "list" });
  // ADDED 19 Aug 2026 — real undo/redo extension.
  const editUndo = useEditUndo(VaccinationRepository);

  useEffect(() => {
    if (openAddOnMount) {
      setScreen({ name: "add" });
      onConsumedQuickAdd?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToList = () => setScreen({ name: "list" });
  const createVaccination = (data) => { VaccinationRepository.create(data); backToList(); };
  const saveVaccination = (data) => {
    editUndo.captureBeforeEdit(screen.id);
    VaccinationRepository.update(screen.id, data);
    editUndo.notifyEdited(screen.id);
    setScreen({ name: "detail", id: screen.id });
  };

  let content;
  if (screen.name === "list") content = <VaccinationsLanding T={LIGHT} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "add" })} />;
  else if (screen.name === "detail") content = <VaccinationDetail T={LIGHT} vaccinationId={screen.id} onBack={backToList} onEdit={(id) => setScreen({ name: "edit", id })} />;

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif", background: LIGHT.bg, minHeight: "100vh" }}>
      {/* ADDED 19 Aug 2026 — real undo/redo toast, same pattern as
          every other module. */}
      {editUndo.toast && (
        <div onClick={editUndo.toast.mode === "undo" ? editUndo.undo : editUndo.redo}
          style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", width: 340, background: editUndo.toast.mode === "undo" ? "#1B1B1F" : LIGHT.healthcareBlue, color: "#FFFFFF", borderRadius: 999, padding: "10px 16px", fontSize: 13, fontWeight: 600, textAlign: "center", cursor: "pointer", boxShadow: "0 8px 24px rgba(0,0,0,.25)", zIndex: 230, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {editUndo.toast.mode === "undo" ? <Check size={14} /> : <RefreshCcw size={14} />}
          {editUndo.toast.mode === "undo" ? "Vaccination updated — tap to undo" : "Undone — tap to redo"}
        </div>
      )}
      {content}
      {screen.name === "add" && <VaccinationSheet T={LIGHT} vaccination={null} onSave={createVaccination} onClose={backToList} />}
      {screen.name === "edit" && <VaccinationSheet T={LIGHT} vaccination={VaccinationRepository.getById(screen.id)} onSave={saveVaccination} onClose={() => setScreen({ name: "detail", id: screen.id })} />}
    </div>
  );
}
