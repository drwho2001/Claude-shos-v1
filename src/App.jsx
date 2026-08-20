import React, { useState, useRef, useEffect } from "react";
import ContactsModule from "./modules/SHOS_Contacts_Prototype";
import MedicationDashboard from "./modules/SHOS_Medication_Dashboard_Prototype";
import EncountersModule from "./modules/SHOS_Encounters_Prototype";
import TestingModule from "./modules/SHOS_Testing_Prototype";
import ClinicVisitsModule from "./modules/SHOS_ClinicVisits_Prototype";
import SymptomLogModule from "./modules/SHOS_SymptomLog_Prototype";
import VaccinationsModule from "./modules/SHOS_Vaccinations_Prototype";
import { exportBackup, importBackupFromFile, EXPORT_GROUPS } from "./storage/backupService";
import { localStorageAdapter } from "./storage/storageAdapter";
import { ContactRepository } from "./repositories/contactRepository";
import { EncounterRepository } from "./repositories/encounterRepository";
import { MedicationRepository } from "./repositories/medicationRepository";
import { LogRepository } from "./repositories/logRepository";
import { TestingRepository } from "./repositories/testingRepository";
import { ClinicVisitsRepository } from "./repositories/clinicVisitsRepository";
import { SymptomLogRepository } from "./repositories/symptomLogRepository";
import { VaccinationRepository } from "./repositories/vaccinationRepository";
import { EpisodeRepository } from "./repositories/episodeRepository";
import { ResultsRegistry } from "./registries/resultsRegistry";
import { OrganismRegistry } from "./registries/organismRegistry";
import { KinkRegistry } from "./registries/kinkRegistry";
import { ChemsRegistry } from "./registries/chemsRegistry";
import { ProtectionRegistry } from "./registries/protectionRegistry";
import { SymptomsRegistry } from "./registries/symptomsRegistry";
import { LocationsRepository } from "./repositories/locationsRepository";
import MyProfileModule from "./modules/SHOS_MyProfile_Prototype";
import GlobalSearchScreen from "./modules/SHOS_GlobalSearch_Prototype";
import ClinicCardScreen from "./modules/SHOS_ClinicCard_Prototype";
import AttachmentsScreen from "./modules/SHOS_Attachments_Prototype";
import TimelineModule from "./modules/SHOS_Timeline_Prototype";
import RegistryManagementScreen from "./modules/SHOS_RegistryManagement_Prototype";
import { computeKinkUsage, computeChemsUsage, computeProtectionUsage, computeSymptomsUsage, computeOrganismUsage, computeResultsUsage } from "./calculations/registryUsage";
import { formatRelativeDate } from "./calculations/encounterCalculations";
import { Home, Users, Activity, Pill, HeartPulse, Download, Upload, ChevronRight, Settings as SettingsIcon, ChevronLeft, User, Search, Database, Trash2, AlertTriangle, Check, ClipboardList, ListTree, Paperclip, History } from "lucide-react";

// CHANGED 18 Aug 2026 — real persistent bottom nav, replacing the old
// top switcher. Per Doc 1 (Master Navigation Map v1.0): five tabs —
// Home · Contacts · Activity · Medication · Healthcare. Healthcare
// doesn't exist as a real screen yet (needs Testing/Vaccination/Clinic
// Visits, none built), shown but disabled rather than omitted or
// faked. Home is now real (see HomeScreen below, added 19 Aug 2026) —
// a genuine summary + quick-add screen, not a placeholder.
//
// My Profile is deliberately NOT a tab here — Doc 1 places it under
// Settings, not primary nav. Reached from Contacts for now (see the
// header icon in SHOS_Contacts_Prototype.jsx) until a real Settings
// screen exists to give it a permanent home.
// CHANGED 19 Aug 2026 — Healthcare is now real, starting with Testing.
// Doc 1 groups Testing/Clinic Visits/Vaccinations/Symptoms Tracker
// under one Healthcare tab; only Testing exists so far (Clinic Visits/
// Vaccinations/Symptoms Tracker deliberately not started this session
// — see testingRepository.js's header for the scope-cut reasoning).
// Healthcare's own component is Testing directly for now; if/when the
// others exist, this tab gets its own internal sub-nav rather than
// staying single-purpose.
// ADDED 19 Aug 2026 — Healthcare now has two real modules (Testing,
// Clinic Visits), so it needs its own internal sub-nav rather than
// pointing straight at one module. A simple segmented control, not a
// second bottom nav — Doc 1 only specifies one bottom nav bar.
// Quick-add always lands on Testing's sub-tab specifically, matching
// Home's existing "Log test" button; Clinic Visits' own quick-add
// (added this round) switches to that sub-tab instead.
// KNOWN SCOPE LIMIT, stated plainly rather than silently simplified:
// tapping a linked test from a Clinic Visit's detail view switches to
// the Testing sub-tab's list, not a true deep-link to that specific
// test's detail screen — full cross-module deep-linking would need
// each module to accept an "open this specific record" prop, which
// doesn't exist yet. Reasonable now, worth building properly later if
// it turns out to matter in real use.
function HealthcareScreen({ openAddOnMount, onConsumedQuickAdd, quickAddTarget }) {
  const [subTab, setSubTab] = useState(
    quickAddTarget === "clinicVisits" ? "clinicVisits" :
    quickAddTarget === "symptomLog" ? "symptomLog" :
    quickAddTarget === "vaccinations" ? "vaccinations" : "testing"
  );
  const [showClinicCard, setShowClinicCard] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const T = { healthcareBlue: "#4A80F0", border: "#DCDCE1", textSecondary: "#5B5B62", surface: "#FFFFFF" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px 0", background: "#F0F0F3" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ key: "testing", label: "Testing" }, { key: "clinicVisits", label: "Clinic Visits" }, { key: "symptomLog", label: "Symptom Log" }, { key: "vaccinations", label: "Vaccinations" }].map((t) => (
            <div key={t.key} onClick={() => setSubTab(t.key)}
              style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", background: subTab === t.key ? T.healthcareBlue : T.surface, color: subTab === t.key ? "#FFFFFF" : T.textSecondary, border: `1px solid ${subTab === t.key ? T.healthcareBlue : T.border}` }}>
              {t.label}
            </div>
          ))}
        </div>
        {/* ADDED 19 Aug 2026 — Timeline entry point, alongside Clinic
            Card + Attachments, same "icon in Healthcare's header"
            pattern — see also Home's own Timeline shortcut below,
            matching Clinic Card's existing dual-entry-point precedent
            (an icon here, a button on Home) rather than picking one. */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div onClick={() => setShowTimeline(true)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <History size={15} color={T.healthcareBlue} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue }}>Timeline</span>
          </div>
          <div onClick={() => setShowAttachments(true)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <Paperclip size={15} color={T.healthcareBlue} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue }}>Attachments</span>
          </div>
          <div onClick={() => setShowClinicCard(true)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <ClipboardList size={16} color={T.healthcareBlue} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue }}>Clinic Card</span>
          </div>
        </div>
      </div>
      {subTab === "testing" ? (
        <TestingModule openAddOnMount={openAddOnMount && quickAddTarget === "testing"} onConsumedQuickAdd={onConsumedQuickAdd} />
      ) : subTab === "clinicVisits" ? (
        <ClinicVisitsModule openAddOnMount={openAddOnMount && quickAddTarget === "clinicVisits"} onConsumedQuickAdd={onConsumedQuickAdd} onOpenTest={() => setSubTab("testing")} />
      ) : subTab === "symptomLog" ? (
        <SymptomLogModule openAddOnMount={openAddOnMount && quickAddTarget === "symptomLog"} onConsumedQuickAdd={onConsumedQuickAdd} />
      ) : (
        <VaccinationsModule openAddOnMount={openAddOnMount && quickAddTarget === "vaccinations"} onConsumedQuickAdd={onConsumedQuickAdd} />
      )}
      {showClinicCard && <ClinicCardScreen onClose={() => setShowClinicCard(false)} />}
      {showAttachments && (
        <AttachmentsScreen onClose={() => setShowAttachments(false)}
          onNavigateToSource={(sourceType, sourceId) => {
            setSubTab(sourceType === "clinicVisit" ? "clinicVisits" : "testing");
            setShowAttachments(false);
          }} />
      )}
      {showTimeline && (
        <div style={{ position: "fixed", inset: 0, zIndex: 210 }}>
          <TimelineModule onClose={() => setShowTimeline(false)} />
        </div>
      )}
    </div>
  );
}

// CHANGED 19 Aug 2026 — reordered per Kane's ask: Contacts, Activity,
// Home (centred), Medication, Healthcare. Each tab now carries its own
// accent color, matching that module's own established theme (Contacts
// teal, Activity pink, Medication blue, Healthcare blue) — the nav
// icons themselves stayed one flat color before, inconsistent with
// every module's own color identity. Home gets its own distinctive
// treatment (dark, circular, raised) rather than a flat accent, since
// it isn't tied to one domain color the way the other four are — see
// the nav bar's own render logic below for the raised-circle styling.
const TABS = [
  { key: "contacts", label: "Contacts", icon: Users, component: ContactsModule, accent: "#14B8A6" },
  { key: "activity", label: "Activity", icon: Activity, component: EncountersModule, accent: "#E24E9C" },
  { key: "home", label: "Home", icon: Home, component: null, accent: "#1B1B1F" },
  { key: "medication", label: "Medication", icon: Pill, component: MedicationDashboard, accent: "#3B82F6" },
  { key: "healthcare", label: "Healthcare", icon: HeartPulse, component: HealthcareScreen, accent: "#4A80F0" },
];

// ADDED 19 Aug 2026 — real Home screen: a genuine summary of recent
// activity across the three built modules, plus quick-add buttons that
// actually jump straight into each module's real add flow (not just
// switch tabs and leave you to find the button yourself — see
// onQuickAdd below and the matching openAddOnMount prop each module
// now accepts). Reads directly from each repository on mount; this is
// a summary screen, not something that needs to stay live-reactive to
// changes happening on OTHER tabs while you're looking at Home.
function HomeScreen({ onQuickAdd, onOpenSettings, onOpenSearch }) {
  const [lastContact, setLastContact] = useState(null);
  const [lastEncounter, setLastEncounter] = useState(null);
  const [lastDose, setLastDose] = useState(null);
  const [lastTest, setLastTest] = useState(null);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showClinicCard, setShowClinicCard] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  // ADDED 19 Aug 2026 — next scheduled clinic visit, real data.
  const [nextVisit, setNextVisit] = useState(null);

  useEffect(() => {
    const contacts = ContactRepository.getAll().filter((c) => !c.isArchived);
    const sortedContacts = [...contacts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setLastContact(sortedContacts[0] || null);

    const encounters = EncounterRepository.getAll();
    const sortedEncounters = [...encounters].sort((a, b) => new Date(b.date) - new Date(a.date));
    setLastEncounter(sortedEncounters[0] || null);

    const meds = MedicationRepository.getAll();
    const doseLogs = LogRepository.getAll().filter((l) => l.type === "dose" && !l.voided);
    const sortedLogs = [...doseLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const lastLog = sortedLogs[0];
    if (lastLog) {
      const med = meds.find((m) => m.id === lastLog.medicationId);
      setLastDose(med ? { name: med.name, date: lastLog.date } : null);
    }

    // ADDED 19 Aug 2026 — Testing and Home are both fully built now, so
    // this is a real, appropriate interconnection (same "recent
    // activity" pattern already used for the other three modules) —
    // unlike Clinic Visits/Related symptoms, which stay stubbed in
    // testingRepository.js because those modules don't exist yet and
    // there's nothing real to connect to.
    const tests = TestingRepository.getAll().filter((t) => !t.isArchived);
    const sortedTests = [...tests].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    setLastTest(sortedTests[0] || null);

    // ADDED 19 Aug 2026 — real, appropriate now that Clinic Visits
    // exists too: soonest upcoming appointment, if any.
    const visits = ClinicVisitsRepository.getAll().filter((v) => !v.isArchived && v.isFutureAppointment && v.date);
    const sortedUpcoming = [...visits].sort((a, b) => new Date(a.date) - new Date(b.date));
    setNextVisit(sortedUpcoming[0] || null);
  }, []);

  // ADDED 19 Aug 2026 — real fix, Kane's ask: explicit time, not just
  // a vague relative string. Within the last 24h: relative time-since
  // PLUS a 12-hour AM/PM clock time, no date needed. Older than 24h:
  // the actual date plus a 24-hour clock time — matches how the rest
  // of the app already distinguishes "recent" from "historical" data.
  // CHANGED 19 Aug 2026 — date formatting made explicit rather than
  // locale-dependent. `toLocaleDateString(undefined, ...)` defers to
  // whatever the device's locale happens to be set to — US devices
  // format month-first ("Aug 16"), UK devices day-first ("16 Aug").
  // Since this needs to read consistently regardless of device
  // settings, spelling it out explicitly rather than trusting that.
  function formatDoseTime(iso) {
    if (!iso) return "—";
    const then = new Date(iso);
    const now = new Date();
    const diffMs = now - then;
    const diffHours = diffMs / 3600000;
    if (diffHours >= 0 && diffHours < 24) {
      let h12 = then.getHours() % 12;
      if (h12 === 0) h12 = 12;
      const mm12 = String(then.getMinutes()).padStart(2, "0");
      const ampm = then.getHours() < 12 ? "AM" : "PM";
      const clock = `${h12}:${mm12} ${ampm}`;
      const wholeHours = Math.floor(diffHours);
      const mins = Math.floor((diffMs % 3600000) / 60000);
      const relative = wholeHours > 0 ? `${wholeHours}h ago` : mins > 0 ? `${mins}m ago` : "just now";
      return `${relative} (${clock})`;
    }
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = `${then.getDate()} ${MONTHS[then.getMonth()]}`;
    const hh = String(then.getHours()).padStart(2, "0");
    const mm = String(then.getMinutes()).padStart(2, "0");
    return `${dateStr}, ${hh}:${mm}`;
  }

  const SummaryRow = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #DCDCE1" }}>
      <span style={{ fontSize: 13, color: "#5B5B62" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#1B1B1F", fontWeight: 600, textAlign: "right" }}>{value}</span>
    </div>
  );

  const QuickAddButton = ({ icon: Icon, label, color, onClick }) => (
    <div onClick={onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 16, border: "1px solid #DCDCE1", background: "#FFFFFF", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={18} color={color} />
        <span style={{ fontSize: 14, fontWeight: 600, color: "#1B1B1F" }}>{label}</span>
      </div>
      <ChevronRight size={16} color="#9A9AA1" />
    </div>
  );

  return (
    <div style={{ padding: "20px 16px", fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1B1B1F", marginBottom: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Home
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* ADDED 19 Aug 2026 — Global Search, canonical Home placement
              per Doc 1, same treatment as the Settings gear icon right
              next to it. */}
          <Search size={19} color="#5B5B62" style={{ cursor: "pointer" }} onClick={onOpenSearch} />
          {/* ADDED 19 Aug 2026 — My Profile access on Home too, per
              Kane's ask, alongside the existing Contacts shortcut. */}
          <User size={19} color="#5B5B62" style={{ cursor: "pointer" }} onClick={() => setShowMyProfile(true)} />
          {/* ADDED 19 Aug 2026 — canonical Settings location per Doc 1:
              "gear icon in the Top App Bar, canonically on Home." */}
          <SettingsIcon size={20} color="#5B5B62" style={{ cursor: "pointer" }} onClick={onOpenSettings} />
        </div>
      </div>

      {/* ADDED 19 Aug 2026 — welcome text, Kane's own wording as the
          basis: open, non-judgemental, genuinely useful tone. */}
      <div style={{ fontSize: 13, color: "#5B5B62", lineHeight: 1.5, marginBottom: 20 }}>
        Welcome to your personal sexual health operating system. Log hookups, testing, clinic visits, medications, and more — all in one place, with clear summaries when you need them. No judgement here, just a useful record that's actually yours.
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#5B5B62", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Recent activity</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, padding: "0 14px", marginBottom: 24 }}>
        <SummaryRow label="Last encounter" value={lastEncounter ? `${lastEncounter.title || lastEncounter.encounterType || "Encounter"} · ${formatRelativeDate(lastEncounter.date)}` : "None yet"} />
        <SummaryRow label="Last medication dose" value={lastDose ? `${lastDose.name} · ${formatDoseTime(lastDose.date)}` : "None yet"} />
        <SummaryRow label="Last test" value={lastTest ? `${lastTest.title || lastTest.testingFor.join("/") || "Test"} · ${formatRelativeDate(lastTest.date)}` : "None yet"} />
        <SummaryRow label="Next clinic visit" value={nextVisit ? `${(nextVisit.reasonForVisit || []).join("/") || nextVisit.title || "Visit"} · ${formatRelativeDate(nextVisit.date)}` : "None scheduled"} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#5B5B62", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Quick add</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <QuickAddButton icon={Users} label="New contact" color="#14B8A6" onClick={() => onQuickAdd("contacts")} />
        <QuickAddButton icon={Activity} label="New encounter" color="#E24E9C" onClick={() => onQuickAdd("activity")} />
        <QuickAddButton icon={Pill} label="Log medication" color="#3B82F6" onClick={() => onQuickAdd("medication")} />
        <QuickAddButton icon={HeartPulse} label="Log test" color="#4A80F0" onClick={() => onQuickAdd("healthcare", "testing")} />
        <QuickAddButton icon={HeartPulse} label="New clinic visit" color="#4A80F0" onClick={() => onQuickAdd("healthcare", "clinicVisits")} />
        <QuickAddButton icon={HeartPulse} label="Log symptom" color="#4A80F0" onClick={() => onQuickAdd("healthcare", "symptomLog")} />
        <QuickAddButton icon={HeartPulse} label="Log vaccination" color="#4A80F0" onClick={() => onQuickAdd("healthcare", "vaccinations")} />
      </div>

      <div onClick={() => setShowClinicCard(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 24, padding: "12px 16px", borderRadius: 16, border: "1px solid #DCDCE1", background: "#FFFFFF", cursor: "pointer" }}>
        <ClipboardList size={15} color="#4A80F0" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#4A80F0" }}>View Clinic Card</span>
      </div>

      {/* ADDED 19 Aug 2026 — Timeline shortcut, matching Clinic Card's
          existing dual-entry-point pattern exactly (icon in Healthcare's
          header, button here on Home) rather than picking one location —
          episodes touch Encounters and Medication too, both outside
          Healthcare entirely. */}
      <div onClick={() => setShowTimeline(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: "12px 16px", borderRadius: 16, border: "1px solid #DCDCE1", background: "#FFFFFF", cursor: "pointer" }}>
        <History size={15} color="#4A80F0" />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#4A80F0" }}>View Timeline</span>
      </div>

      {showMyProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <MyProfileModule onClose={() => setShowMyProfile(false)} />
        </div>
      )}
      {showClinicCard && <ClinicCardScreen onClose={() => setShowClinicCard(false)} />}
      {showTimeline && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
          <TimelineModule onClose={() => setShowTimeline(false)} />
        </div>
      )}
    </div>
  );
}

// ADDED 19 Aug 2026 — Selective export, real ask from the ~90-item
// feedback batch: default is "export everything" (unchanged — the
// plain Export backup row still does a full export in one tap), this
// is the opt-in path for choosing a subset. Reads its checkbox
// structure straight from `EXPORT_GROUPS` in backupService.js — this
// component doesn't know or care what the data keys mean, so a future
// module addition only needs that one file touched, not this one too.
function SelectiveExportSheet({ onClose, onExported }) {
  // All items checked by default — "everything, but deselectable",
  // exactly as asked, rather than starting from nothing and making
  // Kane build the full set back up by hand every time.
  const allKeys = EXPORT_GROUPS.flatMap((g) => g.items.map((i) => i.dataKey));
  const [checked, setChecked] = useState(() => new Set(allKeys));

  const isGroupFullyChecked = (group) => group.items.every((i) => checked.has(i.dataKey));
  const isGroupPartiallyChecked = (group) => group.items.some((i) => checked.has(i.dataKey)) && !isGroupFullyChecked(group);

  const toggleItem = (dataKey) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  };
  const toggleGroup = (group) => {
    const shouldCheck = !isGroupFullyChecked(group);
    setChecked((prev) => {
      const next = new Set(prev);
      group.items.forEach((i) => (shouldCheck ? next.add(i.dataKey) : next.delete(i.dataKey)));
      return next;
    });
  };

  const doExport = () => {
    exportBackup(checked.size === allKeys.length ? null : Array.from(checked));
    onExported?.();
    onClose();
  };

  const Box = ({ state }) => (
    <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${state === "empty" ? "#9A9AA1" : "#3D63C9"}`, background: state === "full" ? "#3D63C9" : state === "partial" ? "#C7D5F7" : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {state === "full" && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 220 }} onClick={onClose}>
      <div style={{ background: "#F0F0F3", width: "100%", maxHeight: "85vh", display: "flex", flexDirection: "column", borderTopLeftRadius: 24, borderTopRightRadius: 24, fontFamily: "'Public Sans', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "20px 20px 4px", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: "#1B1B1F" }}>Export — choose what to include</span>
          <div style={{ fontSize: 12, color: "#5B5B62", marginTop: 4 }}>Everything is included by default. Untick anything you'd rather leave out of this particular file.</div>
        </div>
        <div style={{ overflowY: "auto", padding: "8px 20px", flex: 1 }}>
          {EXPORT_GROUPS.map((group) => (
            <div key={group.key} style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, marginBottom: 10, overflow: "hidden" }}>
              <div onClick={() => toggleGroup(group)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", borderBottom: group.items.length > 1 ? "1px solid #DCDCE1" : "none" }}>
                <Box state={isGroupFullyChecked(group) ? "full" : isGroupPartiallyChecked(group) ? "partial" : "empty"} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#1B1B1F" }}>{group.label}</span>
              </div>
              {group.items.length > 1 && group.items.map((item) => (
                <div key={item.dataKey} onClick={() => toggleItem(item.dataKey)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px 9px 34px", cursor: "pointer" }}>
                  <Box state={checked.has(item.dataKey) ? "full" : "empty"} />
                  <span style={{ fontSize: 13, color: "#5B5B62" }}>{item.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: "14px 20px", borderTop: "1px solid #DCDCE1", flexShrink: 0 }}>
          <button onClick={doExport} disabled={checked.size === 0}
            style={{ width: "100%", padding: 16, borderRadius: 999, border: "none", background: checked.size === 0 ? "#9A9AA1" : "#3D63C9", color: "#FFFFFF", fontSize: 16, fontWeight: 700, cursor: checked.size === 0 ? "default" : "pointer" }}>
            {checked.size === allKeys.length ? "Export everything" : `Export selected (${checked.size} of ${allKeys.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Developer tools, real content instead of the
// honest-but-empty "Not built yet" stub. Deliberately modest scope for
// a single-user prototype: a storage overview (so Kane can see at a
// glance whether the app is actually holding what he thinks it's
// holding) and a full reset, which is the one genuinely useful
// "developer tool" this app needs right now. Preferences/Privacy/
// Appearance stay stubbed — those involve real, unresolved design
// forks (what counts as identifiable for the anonymise-mode idea;
// the font/theme system's own cross-cutting refactor already flagged
// as needing its own dedicated session) that shouldn't be guessed at
// just to fill in a Settings row.
function DeveloperToolsScreen({ onClose }) {
  const [resetStage, setResetStage] = useState("idle"); // idle -> confirming -> done
  const counts = [
    { label: "Contacts", value: ContactRepository.getAll().length },
    { label: "Encounters", value: EncounterRepository.getAll().length },
    { label: "Medications", value: MedicationRepository.getAll().length },
    { label: "Medication log entries", value: LogRepository.getAll().length },
    { label: "Tests", value: TestingRepository.getAll().length },
    { label: "Clinic visits", value: ClinicVisitsRepository.getAll().length },
    { label: "Symptom Log entries", value: SymptomLogRepository.getAll().length },
    { label: "Vaccinations", value: VaccinationRepository.getAll().length },
    { label: "Timeline episodes", value: EpisodeRepository.getAll().length },
    { label: "Kink Registry entries", value: KinkRegistry.getAll().length },
    { label: "Chems Registry entries", value: ChemsRegistry.getAll().length },
    { label: "Protection Registry entries", value: ProtectionRegistry.getAll().length },
    { label: "Symptoms Registry entries", value: SymptomsRegistry.getAll().length },
    { label: "Locations", value: LocationsRepository.getAll().length },
    { label: "Organism Registry entries", value: OrganismRegistry.getAll().length },
    { label: "Results Registry entries", value: ResultsRegistry.getAll().length },
  ];

  const handleReset = () => {
    localStorageAdapter.clearAllAppData();
    setResetStage("done");
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: "#F0F0F3", borderBottom: "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color="#1B1B1F" style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#1B1B1F" }}>Developer tools</span>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 16px 6px" }}>Storage overview</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", padding: "4px 14px" }}>
        {counts.map((c) => (
          <div key={c.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid #DCDCE1" }}>
            <span style={{ fontSize: 13, color: "#5B5B62" }}>{c.label}</span>
            <span style={{ fontSize: 13, color: "#1B1B1F", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{c.value}</span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Danger zone</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #E5484D", borderRadius: 16, margin: "0 16px 20px", padding: 16 }}>
        {resetStage === "done" ? (
          <div style={{ fontSize: 13, color: "#1B1B1F" }}>All app data cleared. Reload the app to see the fresh-start state.</div>
        ) : resetStage === "confirming" ? (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 12 }}>
              <AlertTriangle size={16} color="#E5484D" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: "#1B1B1F" }}>This permanently deletes every contact, encounter, medication, log, test, clinic visit, and registry entry on this device. There's no undo — export a backup first if you're not sure. Type nothing needed, just confirm.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setResetStage("idle")} style={{ flex: 1, padding: 12, borderRadius: 12, border: "1px solid #DCDCE1", background: "#FFFFFF", color: "#5B5B62", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={handleReset} style={{ flex: 1, padding: 12, borderRadius: 12, border: "none", background: "#E5484D", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Yes, delete everything</button>
            </div>
          </>
        ) : (
          <div onClick={() => setResetStage("confirming")} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <Trash2 size={17} color="#E5484D" />
            <span style={{ fontSize: 14, color: "#E5484D", fontWeight: 600 }}>Reset all app data</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Registries picker: the entry point to the 6
// shared Registry Management screens. Colors match Doc 2's real domain
// assignments exactly (Kink=red, Protection=Encounters pink, Chems=
// neutral grey, Symptoms/Organism/Results=Healthcare blue), re-checked
// directly against the doc rather than guessed at.
const REGISTRIES = [
  { key: "kink", label: "Kink Registry", registry: KinkRegistry, color: "#E5484D", computeUsage: computeKinkUsage },
  { key: "protection", label: "Protection Registry", registry: ProtectionRegistry, color: "#E24E9C", computeUsage: computeProtectionUsage },
  { key: "chems", label: "Chems Registry", registry: ChemsRegistry, color: "#5B5B62", computeUsage: computeChemsUsage },
  { key: "symptoms", label: "Symptoms Registry", registry: SymptomsRegistry, color: "#4A80F0", computeUsage: computeSymptomsUsage },
  { key: "organism", label: "Organism Registry", registry: OrganismRegistry, color: "#4A80F0", computeUsage: computeOrganismUsage },
  { key: "results", label: "Results Registry", registry: ResultsRegistry, color: "#4A80F0", computeUsage: computeResultsUsage },
];

function RegistriesScreen({ onClose }) {
  const [openRegistry, setOpenRegistry] = useState(null);
  return (
    <div style={{ position: "fixed", inset: 0, background: "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: "#F0F0F3", borderBottom: "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color="#1B1B1F" style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#1B1B1F" }}>Registries</span>
      </div>
      <div style={{ fontSize: 12, color: "#5B5B62", padding: "10px 16px 0" }}>
        Manage the shared vocabularies used across Contacts, Encounters, Testing, and Clinic Visits — rename or archive an entry directly, rather than only through whichever picker happens to reference it.
      </div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, margin: "16px 16px 20px", overflow: "hidden" }}>
        {REGISTRIES.map((r) => (
          <div key={r.key} onClick={() => setOpenRegistry(r)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #DCDCE1", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: r.color, flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: "#1B1B1F", fontWeight: 500 }}>{r.label}</span>
            </div>
            <ChevronRight size={16} color="#9A9AA1" />
          </div>
        ))}
      </div>
      {openRegistry && (
        <RegistryManagementScreen registry={openRegistry.registry} label={openRegistry.label} color={openRegistry.color} computeUsage={openRegistry.computeUsage} onClose={() => setOpenRegistry(null)} />
      )}
    </div>
  );
}

// ADDED 19 Aug 2026 — real Settings screen, per Doc 1's spec exactly:
// "gear icon in the Top App Bar, canonically on Home. Contents: Profile
// · Preferences · Data export/import/backup · Privacy · Appearance ·
// Developer tools." My Profile and Backup/Restore are real, working
// sections here now — moved out of the old black top bar (which is
// gone entirely, replaced by this). Preferences/Privacy/Appearance/
// Developer tools are honestly labeled as not built yet, same pattern
// as Home/Healthcare's own honesty about what doesn't exist —
// deliberately not faked with dead buttons that look functional.
function SettingsScreen({ onClose, onExport, onImportClick, status }) {
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showSelectiveExport, setShowSelectiveExport] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showRegistries, setShowRegistries] = useState(false);

  const SettingsRow = ({ icon: Icon, label, onClick, disabled }) => (
    <div onClick={disabled ? undefined : onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #DCDCE1", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={17} color="#5B5B62" />
        <span style={{ fontSize: 14, color: "#1B1B1F", fontWeight: 500 }}>{label}</span>
      </div>
      {!disabled && <ChevronRight size={16} color="#9A9AA1" />}
      {disabled && <span style={{ fontSize: 11, color: "#9A9AA1", fontStyle: "italic" }}>Not built yet</span>}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "#F0F0F3", zIndex: 200, overflowY: "auto", fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px", position: "sticky", top: 0, background: "#F0F0F3", borderBottom: "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color="#1B1B1F" style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#1B1B1F" }}>Settings</span>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 16px 6px" }}>Profile</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", overflow: "hidden" }}>
        <SettingsRow icon={User} label="My Profile" onClick={() => setShowMyProfile(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Data</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 8px", overflow: "hidden" }}>
        <SettingsRow icon={Download} label="Export backup" onClick={onExport} />
        {/* ADDED 19 Aug 2026 — real ask: default export stays one tap
            (the row above, unchanged), this is the opt-in "choose what
            to include" path. */}
        <SettingsRow icon={Download} label="Selective export…" onClick={() => setShowSelectiveExport(true)} />
        <SettingsRow icon={Upload} label="Restore from backup" onClick={onImportClick} />
      </div>
      {status && (
        <div style={{ margin: "0 16px 20px", padding: "10px 14px", borderRadius: 12, background: "#FFF4CE", color: "#1B1B1F", fontSize: 12 }}>{status}</div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Advanced</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 8px", overflow: "hidden" }}>
        {/* CHANGED 19 Aug 2026 — Developer tools is now real (storage
            overview + reset), moved out of the "Not built yet" group
            below. */}
        <SettingsRow icon={Database} label="Developer tools" onClick={() => setShowDevTools(true)} />
        {/* ADDED 19 Aug 2026 — Registries, real per Kane's priority
            order. */}
        <SettingsRow icon={ListTree} label="Registries" onClick={() => setShowRegistries(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Not built yet</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", overflow: "hidden" }}>
        <SettingsRow icon={SettingsIcon} label="Preferences" disabled />
        <SettingsRow icon={SettingsIcon} label="Privacy" disabled />
        <SettingsRow icon={SettingsIcon} label="Appearance / theme" disabled />
      </div>

      {showMyProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 210 }}>
          <MyProfileModule onClose={() => setShowMyProfile(false)} />
        </div>
      )}
      {showSelectiveExport && (
        <SelectiveExportSheet onClose={() => setShowSelectiveExport(false)} />
      )}
      {showDevTools && (
        <DeveloperToolsScreen onClose={() => setShowDevTools(false)} />
      )}
      {showRegistries && (
        <RegistriesScreen onClose={() => setShowRegistries(false)} />
      )}
    </div>
  );
}

export default function App() {
  // CHANGED 19 Aug 2026 — default tab on opening is now Home, per
  // Kane's ask. Was defaulting to Contacts (a leftover from before
  // Home existed as a real screen).
  const [active, setActive] = useState("home");
  const [status, setStatus] = useState(null);
  // ADDED 19 Aug 2026 — Dashboard quick-add: set alongside switching
  // `active`, consumed (reset to false) by whichever module actually
  // mounts and uses it — see each module's own openAddOnMount effect.
  const [quickAdd, setQuickAdd] = useState(false);
  // ADDED 19 Aug 2026 — distinguishes which Healthcare sub-tab a
  // quick-add should land on (Testing vs. Clinic Visits) — undefined/
  // "testing" for every other tab's quick-add, which ignores this prop
  // entirely.
  const [quickAddTarget, setQuickAddTarget] = useState(null);
  // ADDED 19 Aug 2026 — real fix for "tapping a nav icon should return
  // to that module's default screen": switching `active` to a value
  // it's ALREADY at doesn't remount anything on its own (React sees no
  // state change), so re-tapping the tab you're already on used to do
  // nothing — you'd stay wherever you'd navigated to inside it.
  // Incrementing this on every single nav tap (even to the same tab)
  // and folding it into the module's `key` below forces a genuine
  // fresh mount every time, which is what actually resets each
  // module's own internal screen state back to its default.
  const [navResetCount, setNavResetCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const fileInputRef = useRef(null);
  const activeTab = TABS.find((t) => t.key === active);
  const ActiveModule = activeTab.component;

  const handleQuickAdd = (tabKey, target) => {
    setActive(tabKey);
    setQuickAddTarget(target || null);
    setQuickAdd(true);
  };

  // ADDED 19 Aug 2026 — Global Search's navigation handler. Deliberately
  // reuses the same active/quickAddTarget/navResetCount plumbing the nav
  // bar and quick-add already use, but with quickAdd left false — lands
  // on the right module (and right Healthcare sub-tab), doesn't open an
  // add flow. See GlobalSearchScreen's own comment for why this stops at
  // "right module" rather than a true deep-link to one record.
  const navigateTo = (tabKey, subTab) => {
    setActive(tabKey);
    setQuickAddTarget(subTab || null);
    setQuickAdd(false);
    setNavResetCount((c) => c + 1);
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importBackupFromFile(
      file,
      () => { setStatus("Backup restored — reload the page to see it everywhere."); window.location.reload(); },
      (err) => setStatus(`Import failed: ${err.message}`)
    );
    e.target.value = "";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F0F0F3", display: "flex", flexDirection: "column" }}>
      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChosen} style={{ display: "none" }} />

      <div style={{ flex: 1, paddingBottom: 76 }}>
        {active === "home" ? (
          <HomeScreen onQuickAdd={handleQuickAdd} onOpenSettings={() => setShowSettings(true)} onOpenSearch={() => setShowSearch(true)} />
        ) : ActiveModule ? (
          <ActiveModule key={`${active}-${navResetCount}`} openAddOnMount={quickAdd} onConsumedQuickAdd={() => { setQuickAdd(false); setQuickAddTarget(null); }} quickAddTarget={quickAddTarget} />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "#5B5B62", fontFamily: "sans-serif" }}>
            <activeTab.icon size={32} color="#9A9AA1" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{activeTab.label} isn't built yet</div>
            <div style={{ fontSize: 13 }}>Needs Testing, Vaccination, and Clinic Visits to exist first.</div>
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTop: "1px solid #DCDCE1", display: "flex", justifyContent: "space-around", alignItems: "flex-end", padding: "10px 0 14px", zIndex: 10, fontFamily: "'Public Sans', sans-serif" }}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const isBuilt = tab.component !== null || tab.key === "home";
          const Icon = tab.icon;
          // ADDED 19 Aug 2026 — Home gets a raised, circular, always-
          // filled treatment (Kane's ask: "circle/bump as centred"),
          // distinct from the other four flat tabs.
          if (tab.key === "home") {
            return (
              <div key={tab.key} onClick={() => { setActive(tab.key); setNavResetCount((c) => c + 1); }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", marginTop: -18 }}>
                <div style={{ width: 48, height: 48, borderRadius: 999, background: tab.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(0,0,0,.25)", border: "3px solid #FFFFFF" }}>
                  <Icon size={22} color="#FFFFFF" strokeWidth={2.5} />
                </div>
              </div>
            );
          }
          return (
            <div key={tab.key} onClick={() => { setActive(tab.key); setNavResetCount((c) => c + 1); }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", opacity: isBuilt ? 1 : 0.45 }}>
              <Icon size={22} color={isActive ? tab.accent : "#9A9AA1"} strokeWidth={isActive ? 2.5 : 2} />
              <span style={{ fontSize: 10, color: isActive ? tab.accent : "#9A9AA1", fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
            </div>
          );
        })}
      </div>

      {showSettings && (
        <SettingsScreen onClose={() => setShowSettings(false)} onExport={exportBackup} onImportClick={handleImportClick} status={status} />
      )}
      {showSearch && (
        <GlobalSearchScreen onClose={() => setShowSearch(false)} onNavigate={navigateTo} />
      )}
    </div>
  );
}
