import React, { useState, useMemo, useEffect, useRef } from "react";
import { Plus, ChevronLeft, MoreVertical, X, Archive, Check, Paperclip, Upload, Trash2 } from "lucide-react";
import {
  TestingRepository, DEFAULT_TEST,
  SETTING_OPTIONS, SAMPLE_TYPE_OPTIONS, TESTING_FOR_OPTIONS,
} from "../repositories/testingRepository";
import { OrganismRegistry } from "../registries/organismRegistry";
import { ResultsRegistry } from "../registries/resultsRegistry";
// ADDED 19 Aug 2026 — draft autosave, same pattern as every other
// edit sheet this round. See draftStorage.js for the full reasoning.
import { saveDraft, loadDraft, clearDraft } from "../storage/draftStorage";

// ADDED 19 Aug 2026 — Healthcare blue (#4A80F0), per Doc 2's design
// system exactly: "Healthcare & Clinical (blue — unified) ... Testing,
// Results Registry, Organism Registry ...". Font/theme conventions
// (Public Sans + JetBrains Mono for stat displays, same radius scale)
// applied from the start per Kane's explicit instruction this session
// — not something to retrofit later the way earlier modules had to be.
const LIGHT = {
  bg: "#F0F0F3", surface: "#FFFFFF", surfaceVariant: "#E7E7EB", border: "#DCDCE1",
  textPrimary: "#1B1B1F", textSecondary: "#5B5B62", textDisabled: "#9A9AA1",
  healthcareBlue: "#4A80F0", actionRed: "#E5484D", actionGreen: "#1B9E77",
  navActive: "#4A80F0",
};
const radius = { sm: 8, md: 16, lg: 24, full: 999 };
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');`;

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
function TestEditSheet({ testId, onClose, onSaved, T }) {
  const isNew = !testId;
  const existing = testId ? TestingRepository.getById(testId) : null;
  // ADDED 19 Aug 2026 — draft autosave.
  const draftKey = `testEdit_${testId || "new"}`;
  const [form, setForm] = useState(() => {
    const draft = loadDraft(draftKey);
    if (draft) return draft.data;
    return existing || { ...DEFAULT_TEST };
  });
  const [draftRestored] = useState(() => !!loadDraft(draftKey));
  useEffect(() => {
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
      TestingRepository.update(testId, form);
      onSaved(testId);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 50, overflowY: "auto" }}>
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
          <SelectField label="Setting" value={form.setting} onChange={set("setting")} options={SETTING_OPTIONS} T={T} />
          <MultiSelectChips label="Sample type" value={form.sampleType} onChange={set("sampleType")} options={SAMPLE_TYPE_OPTIONS} T={T} />
          <MultiSelectChips label="Testing for?" value={form.testingFor} onChange={set("testingFor")} options={TESTING_FOR_OPTIONS} T={T} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0" }}>
            <span style={{ fontSize: 13, color: T.textPrimary }}>Most recent</span>
            <ToggleSwitch T={T} value={form.mostRecent} onChange={set("mostRecent")} />
          </div>
        </SectionCard>

        <SectionCard title="Result" T={T}>
          <RegistryTagPicker label="Organism (if positive)" value={form.organismIds} onChange={set("organismIds")} registry={OrganismRegistry} T={T} placeholder="e.g. Chlamydia" />
          <RegistryTagPicker label="Result" value={form.resultIds} onChange={set("resultIds")} registry={ResultsRegistry} T={T} placeholder="e.g. Positive, Negative" />
          <TextField label="Follow-up actioned date" value={form.followUpActionedDate ? form.followUpActionedDate.slice(0, 10) : ""} onChange={(v) => set("followUpActionedDate")(v ? new Date(v).toISOString() : null)} T={T} type="date" />
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          <TextField label="Tracking info" value={form.trackingInfo} onChange={set("trackingInfo")} T={T} placeholder="e.g. barcode, reference number" />
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
        </SectionCard>

        <SectionCard title="Result" T={T}>
          <ReadRow label="Organism" value={organismNames} T={T} />
          <ReadRow label="Result" value={resultNames} T={T} />
          <ReadRow label="Follow-up actioned" value={formatDate(test.followUpActionedDate) !== "—" ? formatDate(test.followUpActionedDate) : ""} T={T} />
        </SectionCard>

        <SectionCard title="Notes" T={T}>
          <ReadRow label="Tracking info" value={test.trackingInfo} T={T} />
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
        <Plus size={22} color={T.healthcareBlue} style={{ cursor: "pointer" }} onClick={onAdd} />
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
