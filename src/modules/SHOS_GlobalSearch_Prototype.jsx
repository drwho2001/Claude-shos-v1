import React, { useState, useMemo } from "react";
import { Search, X, Users, Activity, Pill, HeartPulse, ChevronRight } from "lucide-react";
import { ContactRepository } from "../repositories/contactRepository";
import { MedicationRepository } from "../repositories/medicationRepository";
import { EncounterRepository } from "../repositories/encounterRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { ClinicVisitsRepository } from "../repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
import { formatRelativeDate } from "../calculations/encounterCalculations";

// ADDED 19 Aug 2026 — Global Search, one of Kane's two joint-top
// priority items (alongside Settings) from the FULL VERIFIED AUDIT's
// "bigger builds" list. Doc 1 scopes this to: Contacts · Episodes
// [PLANNED] · Medications · Tests · Activities · Symptoms.
//
// Episodes isn't built — Clinical Episode is still an open, undecided
// architecture question in Notion itself, not just an app gap, so
// there's nothing real to search yet.
//
// UPDATED 19 Aug 2026 — "Symptoms" IS now its own real result type:
// Symptom Log (Notion's Symptoms Tracker) exists as a real dated-
// occurrence module now, distinct from the Symptom Registry tag
// vocabulary already searchable as part of whichever Encounter/Clinic
// Visit record it's attached to. Doc 1's own "Symptoms" listing is
// satisfied for real now, not worked around.
//
// Clinic Visits is included even though Doc 1 (written before that
// module existed) doesn't list it — it's a real, built module now, and
// the project's own standing practice is to keep search coverage
// honest against actual app state rather than a doc written earlier.
const RESULT_META = {
  contact: { label: "Contact", icon: Users, color: "#14B8A6", tab: "contacts" },
  encounter: { label: "Activity", icon: Activity, color: "#E24E9C", tab: "activity" },
  medication: { label: "Medication", icon: Pill, color: "#3B82F6", tab: "medication" },
  test: { label: "Test", icon: HeartPulse, color: "#4A80F0", tab: "healthcare", subTab: "testing" },
  clinicVisit: { label: "Clinic Visit", icon: HeartPulse, color: "#4A80F0", tab: "healthcare", subTab: "clinicVisits" },
  symptomLog: { label: "Symptom Log", icon: HeartPulse, color: "#4A80F0", tab: "healthcare", subTab: "symptomLog" },
  vaccination: { label: "Vaccination", icon: HeartPulse, color: "#4A80F0", tab: "healthcare", subTab: "vaccinations" },
};

function norm(v) {
  return (v == null ? "" : String(v)).toLowerCase();
}

// Builds the full unfiltered index once per screen-open — the whole
// app's data is small enough (single user, not thousands of rows) that
// filtering client-side on every keystroke is simpler and fast enough,
// same "don't over-engineer for a single-user app" judgment already
// applied elsewhere in this project (e.g. the ID scheme staying
// human-readable rather than moving to UUIDs).
function buildIndex() {
  const results = [];

  ContactRepository.getAll().filter((c) => !c.isArchived).forEach((c) => {
    const searchText = [c.name, c.nickname, c.phone, c.snapchat, c.fabguys, c.fabswingers, c.city, c.notes].join(" ");
    results.push({
      type: "contact", id: c.id,
      title: c.nickname || c.name || "Unnamed contact",
      subtitle: c.city || "",
      searchText,
    });
  });

  MedicationRepository.getAll().filter((m) => !m.isArchived).forEach((m) => {
    const searchText = [m.name, m.medicationType, m.usualSupplier, m.route].join(" ");
    results.push({
      type: "medication", id: m.id,
      title: m.name || "Unnamed medication",
      subtitle: m.medicationType || m.route || "",
      searchText,
    });
  });

  EncounterRepository.getAll().filter((e) => !e.isArchived).forEach((e) => {
    const searchText = [e.title, e.encounterType, e.notes].join(" ");
    results.push({
      type: "encounter", id: e.id,
      title: e.title || e.encounterType || "Encounter",
      subtitle: e.date ? formatRelativeDate(e.date) : "",
      searchText,
    });
  });

  TestingRepository.getAll().filter((t) => !t.isArchived).forEach((t) => {
    const searchText = [t.title, ...(t.testingFor || []), t.trackingInfo].join(" ");
    results.push({
      type: "test", id: t.id,
      title: t.title || (t.testingFor || []).join("/") || "Test",
      subtitle: t.date ? formatRelativeDate(t.date) : "",
      searchText,
    });
  });

  ClinicVisitsRepository.getAll().filter((v) => !v.isArchived).forEach((v) => {
    const searchText = [v.title, v.clinician, ...(v.reasonForVisit || []), v.clinicalNotes].join(" ");
    results.push({
      type: "clinicVisit", id: v.id,
      title: v.title || (v.reasonForVisit || []).join("/") || "Clinic visit",
      subtitle: v.date ? formatRelativeDate(v.date) : "",
      searchText,
    });
  });

  // ADDED 19 Aug 2026 — Symptom Log, added the same session it was
  // built, immediately (not after a session-long gap the way Testing's
  // own backup omission was caught once already this project).
  SymptomLogRepository.getAll().filter((e) => !e.isArchived).forEach((e) => {
    const searchText = [e.title, e.notes].join(" ");
    results.push({
      type: "symptomLog", id: e.id,
      title: e.title || "Symptom entry",
      subtitle: e.dateStarted ? formatRelativeDate(e.dateStarted) : "",
      searchText,
    });
  });

  VaccinationRepository.getAll().filter((v) => !v.isArchived).forEach((v) => {
    const searchText = [v.title, v.vaccine, v.provider, v.notes].join(" ");
    results.push({
      type: "vaccination", id: v.id,
      title: v.title || v.vaccine || "Vaccination",
      subtitle: v.date ? formatRelativeDate(v.date) : "",
      searchText,
    });
  });

  return results;
}

function ResultRow({ result, onSelect }) {
  const meta = RESULT_META[result.type];
  const Icon = meta.icon;
  return (
    <div onClick={() => onSelect(result)}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #DCDCE1", cursor: "pointer", background: "#FFFFFF" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{ width: 34, height: 34, borderRadius: 999, background: `${meta.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={16} color={meta.color} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1B1B1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{result.title}</div>
          <div style={{ fontSize: 11, color: "#5B5B62" }}>{meta.label}{result.subtitle ? ` · ${result.subtitle}` : ""}</div>
        </div>
      </div>
      <ChevronRight size={16} color="#9A9AA1" style={{ flexShrink: 0 }} />
    </div>
  );
}

// onNavigate(tabKey, subTab) — switches App.jsx's active tab (and, for
// Healthcare, the internal Testing/Clinic Visits sub-tab). Deliberately
// NOT a deep-link into the specific record itself: full cross-module
// "open this exact record" plumbing doesn't exist yet anywhere in the
// app (the same disclosed, honest scope limit already stated in
// clinicVisitsRepository.js/App.jsx for tapping a linked test from a
// Clinic Visit). Landing on the right module/sub-tab, with the record
// visible in the list you land on, is a real and useful stop short of
// that — not a silent downgrade, just not overbuilt beyond what's
// actually there yet.
export default function GlobalSearchScreen({ onClose, onNavigate }) {
  const [query, setQuery] = useState("");
  const index = useMemo(() => buildIndex(), []);
  const results = useMemo(() => {
    const q = query.trim();
    if (!q.length) return [];
    return index.filter((r) => norm(r.searchText).includes(norm(q))).slice(0, 30);
  }, [query, index]);

  const handleSelect = (result) => {
    const meta = RESULT_META[result.type];
    onNavigate(meta.tab, meta.subTab);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#F0F0F3", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, borderBottom: "1px solid #DCDCE1", background: "#FFFFFF" }}>
        <Search size={18} color="#9A9AA1" style={{ flexShrink: 0 }} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts, medications, activities, tests, clinic visits..."
          style={{ flex: 1, border: "none", outline: "none", fontSize: 15, background: "transparent", color: "#1B1B1F", fontFamily: "'Public Sans', sans-serif" }}
        />
        <X size={20} color="#5B5B62" style={{ cursor: "pointer", flexShrink: 0 }} onClick={onClose} />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {query.trim().length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#9A9AA1", fontSize: 13 }}>
            Start typing to search across Contacts, Medications, Activities, Tests, and Clinic Visits.
          </div>
        )}
        {query.trim().length > 0 && results.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "#9A9AA1", fontSize: 13 }}>
            No matches for "{query}".
          </div>
        )}
        {results.map((r) => (
          <ResultRow key={`${r.type}-${r.id}`} result={r} onSelect={handleSelect} />
        ))}
      </div>
    </div>
  );
}
