import React, { useState, useMemo, useEffect, useRef } from "react";
import { Plus, ChevronLeft, MoreVertical, X, Archive, Check, Paperclip, Upload, Trash2, RefreshCcw } from "lucide-react";
import { useEditUndo } from "../calculations/editUndoHelpers";
import {
  TestingRepository, DEFAULT_TEST,
  SETTING_OPTIONS, TESTING_FOR_OPTIONS,
} from "../repositories/testingRepository";
// ADDED 19 Aug 2026 — SAMPLE_TYPE_OPTIONS now lives here, real in-app
// editable list.
import { CustomOptionListsRepository } from "../repositories/customOptionListsRepository";
import { OrganismRegistry } from "../registries/organismRegistry";
import { ResultsRegistry } from "../registries/resultsRegistry";
// ADDED 19 Aug 2026 — real gap found in an orphaned-code audit:
// ClinicVisitsRepository.getByLinkedTest() was built specifically as
// "the read side" of the two-way Testing↔Clinic Visits link, but this
// module never actually called it — Clinic Visits' own detail view
// shows its linked tests, Testing's never showed its linked visits.
// One real direction of a two-way link with no UI at all.
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { suggestedRoutineRetestDate } from "../calculations/testingCalculations";
// ADDED 19 Aug 2026 — draft autosave, same pattern as every other
// edit sheet this round. See draftStorage.js for the full reasoning.
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here, so this screen can't silently drift from every other
// module's "same" color/radius. See designTokens.js.
import { NEUTRAL, ACCENTS, ACTION, RADIUS } from "../calculations/designTokens";

// ADDED 19 Aug 2026 — Healthcare blue (#4A80F0), per Doc 2's design
// system exactly: "Healthcare & Clinical (blue — unified) ... Testing,
// Results Registry, Organism Registry ...". Font/theme conventions
// (Public Sans + JetBrains Mono for stat displays, same radius scale)
// applied from the start per Kane's explicit instruction this session
// — not something to retrofit later the way earlier modules had to be.
const LIGHT = {
  ...NEUTRAL,
  healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red, actionGreen: ACTION.green,
  navActive: ACCENTS.healthcare,
};
const radius = RADIUS;

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

// ── Shared form primitives — same self-contained pattern as every
// other module this session (each module owns its own copies, no
// shared UI-library file yet). ──
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

// Registry-backed picker (Organism/Result) — same pattern already
// proven this session in Contacts/Encounters/My Profile, no role
// tracking needed here (that's a kink-specific concept).
function RegistryTagPicker({ label, value, onChange, T, registry, placeholder }) {
  const [draft, setDraft] = useState("");
  const listId = `registry-${label.replace(/\s+/g, "-")}`;
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const nameFor = (id) => allEntries.find((e) => e.id === id)?.name || registry.getById(id)?.name || "?";
  const visibleSuggestions = allEntries.filter((e) => !value.includes(e.id)).slice(0, 10);

  const commit = () => {
    const raw = draft.trim();
    if (!raw) return;
    const parts = raw.split(",").map((t) => t.trim()).filter(Boolean);
    const newIds = [];
    parts.forEach((part) => {
      const entry = registry.findOrCreate(part);
      if (entry && !value.includes(entry.id) && !newIds.includes(entry.id)) newIds.push(entry.id);
    });
    if (newIds.length > 0) onChange([...value, ...newIds]);
    setDraft("");
  };
  const tapSuggestion = (entry) => { if (!value.includes(entry.id)) onChange([...value, entry.id]); };

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
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              + {e.name}
            </div>
          ))}
        </div>
      )}
      <input list={listId} value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={placeholder || "Pick existing or type new ones, comma-separated"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      <datalist id={listId}>{allEntries.map((e) => <option key={e.id} value={e.name} />)}</datalist>
    </div>
  );
}

// ADDED 19 Aug 2026 — real feedback batch: "only one Result should be
// allowed at a time (currently multi-select) — retroactive updates
// (Pending → Positive/Negative) should REPLACE, not add to, the
// existing result." A real single-select variant of RegistryTagPicker
// above — tapping a suggestion or committing typed text REPLACES the
// selection rather than appending to it. Still writes/reads a
// single-element array (`resultIds`) rather than a bare string, since
// every other module that reads a test's result (Clinic Card,
// Timeline, exposureWindows.js) already expects `resultIds` as an
// array — this only changes what the UI lets you put IN it, not the
// underlying data shape, so nothing downstream needed touching.
function RegistrySingleResultPicker({ label, value, onChange, T, registry, placeholder }) {
  const [draft, setDraft] = useState("");
  const listId = `registry-result-${label.replace(/\s+/g, "-")}`;
  const allEntries = registry.getAll().filter((e) => !e.isArchived);
  const currentId = value[0] || null;
  const currentName = currentId ? (allEntries.find((e) => e.id === currentId)?.name || registry.getById(currentId)?.name || "?") : null;
  const visibleSuggestions = allEntries.filter((e) => e.id !== currentId).slice(0, 10);

  const commit = () => {
    const raw = draft.trim();
    if (!raw) return;
    const entry = registry.findOrCreate(raw);
    if (entry) onChange([entry.id]);
    setDraft("");
  };
  const tapSuggestion = (entry) => onChange([entry.id]);

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
      {currentName && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
          <div onClick={() => onChange([])}
            style={{ padding: "4px 8px", borderRadius: radius.full, fontSize: 12, background: T.surfaceVariant, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            {currentName} <X size={11} />
          </div>
        </div>
      )}
      {visibleSuggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 6 }}>
          {visibleSuggestions.map((e) => (
            <div key={e.id} onClick={() => tapSuggestion(e)}
              style={{ padding: "3px 9px", borderRadius: radius.full, fontSize: 11, border: `1px solid ${T.healthcareBlue}`, color: T.healthcareBlue, cursor: "pointer" }}>
              {e.name}
            </div>
          ))}
        </div>
      )}
      <input list={listId} value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={placeholder || "Pick or type a result"}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
      <datalist id={listId}>{allEntries.map((e) => <option key={e.id} value={e.name} />)}</datalist>
    </div>
  );
}

// ADDED 19 Aug 2026 — Attachments, real and working, per Kane's ask
// ("add attachment option for testing/clinic, but again not actually
// used to date" — built as a genuine capability, kept intentionally
// lean since it's not expected to see real use yet). Same data-URL
// approach as Contacts' Profile Picture; same honest size caveat
// applies (see testingRepository.js's comment).
function AttachmentManager({ testId, attachments, onChanged, T }) {
  const inputRef = useRef(null);
  const [pendingType, setPendingType] = useState("Other");

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      TestingRepository.addAttachment(testId, { title: file.name, type: pendingType, fileDataUrl: reader.result });
      onChanged();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const remove = (attachmentId) => {
    TestingRepository.removeAttachment(testId, attachmentId);
    onChanged();
  };

  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 6 }}>Attachments</div>
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {attachments.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: radius.sm, background: T.surfaceVariant }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <Paperclip size={13} color={T.textSecondary} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: T.textPrimary, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</div>
                  <div style={{ fontSize: 10, color: T.textDisabled }}>{a.type} · {formatDate(a.date)}</div>
                </div>
              </div>
              <Trash2 size={14} color={T.actionRed} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => remove(a.id)} />
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <select value={pendingType} onChange={(e) => setPendingType(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 12 }}>
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
function TestEditSheet({ testId, onClose, onSaved, onBeforeEdit, onAfterEdit, T }) {
  const isNew = !testId;
  const existing = testId ? TestingRepository.getById(testId) : null;
  // ADDED 19 Aug 2026 — real in-app editable option list.
  const sampleTypeOptions = useMemo(() => CustomOptionListsRepository.get("sampleType"), []);
  // ADDED 19 Aug 2026 — draft autosave.
  const draftKey = `testEdit_${testId || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return existing || { ...DEFAULT_TEST };
  });
  const [draftRestored] = useState(() => !!loadDraft(draftKey));
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
  const canSave = form.title.trim().length > 0 || form.testingFor.length > 0;

  const save = () => {
    clearDraft(draftKey);
    if (isNew) {
      const created = TestingRepository.create(form);
      onSaved(created.id);
    } else {
      // ADDED 19 Aug 2026 — real undo/redo extension.
      onBeforeEdit?.(testId);
      TestingRepository.update(testId, form);
      onAfterEdit?.(testId);
      onSaved(testId);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 200, overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}`, zIndex: 1 }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>{isNew ? "New test" : "Edit test"}</span>
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
          <TextField label="Title" value={form.title} onChange={set("title")} T={T} placeholder="e.g. Routine 3-month screen" />
          <TextField label="Date" value={form.date ? form.date.slice(0, 10) : ""} onChange={(v) => set("date")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
          {/* ADDED 19 Aug 2026 — real feedback batch: Result Date,
              separate from the specimen date above — can lag behind
              it depending on sample/lab turnaround. */}
          <TextField label="Result date" value={form.resultDate ? form.resultDate.slice(0, 10) : ""} onChange={(v) => set("resultDate")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
          <SelectField label="Setting" value={form.setting} onChange={set("setting")} options={SETTING_OPTIONS} T={T} />
          <MultiSelectChips label="Sample type" value={form.sampleType} onChange={set("sampleType")} options={sampleTypeOptions} T={T} />
          <MultiSelectChips label="Testing for?" value={form.testingFor} onChange={set("testingFor")} options={TESTING_FOR_OPTIONS} T={T} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ fontSize: 13, color: T.textPrimary }}>Most recent</span>
            <ToggleSwitch T={T} value={form.mostRecent} onChange={set("mostRecent")} />
          </div>
        </SectionCard>

        <SectionCard title="Result" T={T}>
          <RegistryTagPicker label="Organism (if positive)" value={form.organismIds} onChange={set("organismIds")} registry={OrganismRegistry} T={T} placeholder="e.g. Chlamydia" />
          {/* CHANGED 19 Aug 2026 — real feedback batch: only one Result
              should ever apply at a time — picking a new one now
              REPLACES rather than adds to the existing selection, so
              a retroactive Pending → Positive update genuinely
              updates the result instead of leaving both. */}
          <RegistrySingleResultPicker label="Result" value={form.resultIds} onChange={set("resultIds")} registry={ResultsRegistry} T={T} placeholder="e.g. Positive, Negative" />
          {/* CHANGED 19 Aug 2026 — relabeled per real feedback: this
              date specifically means "when treatment happened, if
              positive" — not a generic catch-all follow-up date. */}
          <TextField label="Date of treatment (if positive)" value={form.followUpActionedDate ? form.followUpActionedDate.slice(0, 10) : ""} onChange={(v) => set("followUpActionedDate")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
          {/* ADDED 19 Aug 2026 — real feedback batch: a free-text
              written plan, distinct from the structured date above —
              answers "what's the plan" rather than "when was it done". */}
          <TextField label="Written plan" value={form.writtenPlan} onChange={set("writtenPlan")} T={T} placeholder="e.g. f/u in 2 weeks for treatment" />
          {/* ADDED 19 Aug 2026 — real feedback batch: "if negative,
              follow-up defaults to nil or routine 3-month retest
              (6-month if HIV is next due)". Purely informational —
              computed fresh from the real result/date/testingFor,
              never stored, same spirit as the exposure-window
              flagging elsewhere in this app. Only shows once a
              Negative result and a date are both present. */}
          {(() => {
            const suggested = suggestedRoutineRetestDate(form);
            return suggested ? (
              <div style={{ fontSize: 12, color: T.healthcareBlue, background: `${T.healthcareBlue}12`, borderRadius: radius.sm, padding: "8px 10px", marginTop: 6 }}>
                Routine retest suggested around {formatDate(suggested)} ({(form.testingFor || []).includes("HIV") ? "6 months" : "3 months"} after this test).
              </div>
            ) : null;
          })()}
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          {/* CHANGED 19 Aug 2026 — real feedback batch: clarified this
              is specifically for home test kits, and only shown when
              Setting is actually Home — was previously always visible
              with no context for what it was for. */}
          {form.setting === "🏠 Home" && (
            <TextField label="Tracking info (home test kit)" value={form.trackingInfo} onChange={set("trackingInfo")} T={T} placeholder="e.g. barcode, reference number" />
          )}
        </SectionCard>

        {!isNew && (
          <SectionCard title="Attachments" T={T}>
            <AttachmentManager testId={testId} attachments={TestingRepository.getById(testId)?.attachments || []} onChanged={() => setForm(TestingRepository.getById(testId))} T={T} />
          </SectionCard>
        )}
        {isNew && (
          <div style={{ fontSize: 11, color: T.textDisabled, textAlign: "center", padding: "12px 0", fontStyle: "italic" }}>
            Save this test first, then attachments can be added.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Detail view ──
function TestDetail({ testId, onBack, onEdit, T }) {
  const [test, setTest] = useState(() => TestingRepository.getById(testId));
  if (!test) return null;

  const organismNames = test.organismIds.map((id) => OrganismRegistry.getById(id)?.name).filter(Boolean);
  const resultNames = test.resultIds.map((id) => ResultsRegistry.getById(id)?.name).filter(Boolean);
  const isPositive = resultNames.some((r) => r.toLowerCase() === "positive");
  // ADDED 19 Aug 2026 — real data, previously built but never
  // displayed. See the import comment above for the full reasoning.
  const linkedVisits = ClinicVisitsRepository.getByLinkedTest(testId);

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px" }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onBack} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.healthcareBlue, cursor: "pointer" }} onClick={() => onEdit(testId)}>Edit</span>
      </div>

      <div style={{ padding: "0 16px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: radius.full, background: isPositive ? T.actionRed : T.healthcareBlue, display: "inline-block" }} />
          <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{test.title || "Untitled test"}</span>
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 20, fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(test.date)}</div>

        <SectionCard title="Overview" T={T}>
          <ReadRow label="Setting" value={test.setting} T={T} />
          <ReadRow label="Sample type" value={test.sampleType} T={T} />
          <ReadRow label="Testing for?" value={test.testingFor} T={T} />
          <ReadRow label="Most recent" value={test.mostRecent ? "Yes" : ""} T={T} />
          <ReadRow label="Result date" value={test.resultDate ? formatDate(test.resultDate) : ""} T={T} />
        </SectionCard>

        <SectionCard title="Result" T={T}>
          <ReadRow label="Organism" value={organismNames} T={T} />
          <ReadRow label="Result" value={resultNames} T={T} />
          <ReadRow label="Date of treatment" value={formatDate(test.followUpActionedDate) !== "—" ? formatDate(test.followUpActionedDate) : ""} T={T} />
          <ReadRow label="Written plan" value={test.writtenPlan} T={T} />
          {(() => {
            const suggested = suggestedRoutineRetestDate(test);
            return suggested ? (
              <div style={{ fontSize: 12, color: T.healthcareBlue, background: `${T.healthcareBlue}12`, borderRadius: radius.sm, padding: "8px 10px", marginTop: 8 }}>
                Routine retest suggested around {formatDate(suggested)}.
              </div>
            ) : null;
          })()}
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          {test.setting === "🏠 Home" && <ReadRow label="Tracking info (home test kit)" value={test.trackingInfo} T={T} />}
        </SectionCard>

        {test.attachments.length > 0 && (
          <SectionCard title="Attachments" T={T}>
            {test.attachments.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                <Paperclip size={13} color={T.textSecondary} />
                <span style={{ fontSize: 13, color: T.textPrimary }}>{a.title}</span>
                <span style={{ fontSize: 11, color: T.textDisabled }}>({a.type})</span>
              </div>
            ))}
          </SectionCard>
        )}

        {/* ADDED 19 Aug 2026 — same known, honest scope limit already
            stated elsewhere in the app (Clinic Visits' own linked-test
            row): this switches to the Clinic Visits sub-tab's list, not
            a true deep-link to that one visit's detail screen — full
            cross-module "open this specific record" plumbing doesn't
            exist yet anywhere in the app. Real and useful stop short of
            that, not a silent downgrade. */}
        {linkedVisits.length > 0 && (
          <SectionCard title="Linked clinic visits" T={T}>
            {linkedVisits.map((v) => (
              <div key={v.id} style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 13, color: T.textPrimary, fontWeight: 600 }}>{v.title || (v.reasonForVisit || []).join("/") || "Clinic visit"}</div>
                <div style={{ fontSize: 11, color: T.textSecondary }}>{formatDate(v.date)}</div>
              </div>
            ))}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ── List / landing view ──
function TestingLanding({ onOpen, onAdd, T }) {
  const [tests, setTests] = useState(() => TestingRepository.getAll().filter((t) => !t.isArchived));
  const sorted = useMemo(() => [...tests].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)), [tests]);

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ padding: "18px 16px 2px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary }}>Testing</span>
      </div>
      {/* CHANGED — real ask: "Add test button doesn't hover and lock
          position like every other module" — same fix already applied
          to Vaccinations/Symptom Log, same real pattern. */}
      <div onClick={onAdd} style={{ position: "fixed", bottom: 90, right: 20, width: 56, height: 56, borderRadius: 999, background: T.healthcareBlue, color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,.2)", zIndex: 20 }}>
        <Plus size={24} />
      </div>

      <div style={{ padding: "12px 16px 100px", display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: T.textDisabled, fontSize: 13 }}>
            No tests logged yet. Tap + to add one.
          </div>
        )}
        {sorted.map((t) => {
          const resultNames = t.resultIds.map((id) => ResultsRegistry.getById(id)?.name).filter(Boolean);
          const isPositive = resultNames.some((r) => r.toLowerCase() === "positive");
          return (
            <div key={t.id} onClick={() => onOpen(t.id)}
              style={{ background: T.surface, border: `1px solid ${isPositive ? T.actionRed : T.border}`, borderRadius: radius.md, padding: 14, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: radius.full, background: isPositive ? T.actionRed : T.healthcareBlue, display: "inline-block" }} />
                <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>{t.title || "Untitled test"}</span>
                {t.mostRecent && <Check size={13} color={T.healthcareBlue} />}
              </div>
              <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{formatDate(t.date)}</div>
              {/* ADDED — real ask: "state on card location of test
                  (home/clinic)" — was only ever shown on the detail
                  screen before, never the list card itself. */}
              {t.setting && (
                <div style={{ fontSize: 12, color: T.textSecondary, marginLeft: 16, marginTop: 2 }}>{t.setting}</div>
              )}
              {resultNames.length > 0 && (
                <div style={{ fontSize: 12, color: isPositive ? T.actionRed : T.textSecondary, marginLeft: 16, marginTop: 2, fontWeight: isPositive ? 700 : 400 }}>{resultNames.join(", ")}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Top-level module ──
export default function TestingModule({ openAddOnMount = false, onConsumedQuickAdd } = {}) {
  const [screen, setScreen] = useState({ name: "landing" });
  const T = LIGHT;
  // ADDED 19 Aug 2026 — real undo/redo extension, same shared
  // mechanism as Encounters/Contacts/Medication.
  const editUndo = useEditUndo(TestingRepository);

  // Same Dashboard quick-add pattern as every other module this
  // session — see SHOS_Contacts_Prototype.jsx for the fuller reasoning.
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
    screenContent = <TestingLanding T={T} onOpen={(id) => setScreen({ name: "detail", id })} onAdd={() => setScreen({ name: "edit", id: null })} />;
  } else if (screen.name === "detail") {
    screenContent = <TestDetail T={T} testId={screen.id} onBack={backToList} onEdit={(id) => setScreen({ name: "edit", id })} />;
  } else if (screen.name === "edit") {
    screenContent = (
      <TestEditSheet T={T} testId={screen.id}
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
          {editUndo.toast.mode === "undo" ? "Test updated — tap to undo" : "Undone — tap to redo"}
        </div>
      )}
      {screenContent}
    </div>
  );
}
