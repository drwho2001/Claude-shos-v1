import React, { useState, useRef, useEffect } from "react";
import ContactsModule from "./modules/SHOS_Contacts_Prototype";
import MedicationDashboard from "./modules/SHOS_Medication_Dashboard_Prototype";
import EncountersModule from "./modules/SHOS_Encounters_Prototype";
import TestingModule from "./modules/SHOS_Testing_Prototype";
import ClinicVisitsModule from "./modules/SHOS_ClinicVisits_Prototype";
import { exportBackup, importBackupFromFile } from "./storage/backupService";
import { ContactRepository } from "./repositories/contactRepository";
import { EncounterRepository } from "./repositories/encounterRepository";
import { MedicationRepository } from "./repositories/medicationRepository";
import { LogRepository } from "./repositories/logRepository";
import { TestingRepository } from "./repositories/testingRepository";
import { ResultsRegistry } from "./registries/resultsRegistry";
import { formatRelativeDate } from "./calculations/encounterCalculations";
import { Home, Users, Activity, Pill, HeartPulse, Download, Upload, ChevronRight, Settings as SettingsIcon, ChevronLeft, User } from "lucide-react";
import MyProfileModule from "./modules/SHOS_MyProfile_Prototype";

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
  const [subTab, setSubTab] = useState(quickAddTarget === "clinicVisits" ? "clinicVisits" : "testing");
  const T = { healthcareBlue: "#4A80F0", border: "#DCDCE1", textSecondary: "#5B5B62", surface: "#FFFFFF" };

  return (
    <div>
      <div style={{ display: "flex", gap: 6, padding: "14px 16px 0", background: "#F0F0F3" }}>
        {[{ key: "testing", label: "Testing" }, { key: "clinicVisits", label: "Clinic Visits" }].map((t) => (
          <div key={t.key} onClick={() => setSubTab(t.key)}
            style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer", background: subTab === t.key ? T.healthcareBlue : T.surface, color: subTab === t.key ? "#FFFFFF" : T.textSecondary, border: `1px solid ${subTab === t.key ? T.healthcareBlue : T.border}` }}>
            {t.label}
          </div>
        ))}
      </div>
      {subTab === "testing" ? (
        <TestingModule openAddOnMount={openAddOnMount && quickAddTarget !== "clinicVisits"} onConsumedQuickAdd={onConsumedQuickAdd} />
      ) : (
        <ClinicVisitsModule openAddOnMount={openAddOnMount && quickAddTarget === "clinicVisits"} onConsumedQuickAdd={onConsumedQuickAdd} onOpenTest={() => setSubTab("testing")} />
      )}
    </div>
  );
}

const TABS = [
  { key: "home", label: "Home", icon: Home, component: null },
  { key: "contacts", label: "Contacts", icon: Users, component: ContactsModule },
  { key: "activity", label: "Activity", icon: Activity, component: EncountersModule },
  { key: "medication", label: "Medication", icon: Pill, component: MedicationDashboard },
  { key: "healthcare", label: "Healthcare", icon: HeartPulse, component: HealthcareScreen },
];

// ADDED 19 Aug 2026 — real Home screen: a genuine summary of recent
// activity across the three built modules, plus quick-add buttons that
// actually jump straight into each module's real add flow (not just
// switch tabs and leave you to find the button yourself — see
// onQuickAdd below and the matching openAddOnMount prop each module
// now accepts). Reads directly from each repository on mount; this is
// a summary screen, not something that needs to stay live-reactive to
// changes happening on OTHER tabs while you're looking at Home.
function HomeScreen({ onQuickAdd, onOpenSettings }) {
  const [lastContact, setLastContact] = useState(null);
  const [lastEncounter, setLastEncounter] = useState(null);
  const [lastDose, setLastDose] = useState(null);
  const [lastTest, setLastTest] = useState(null);

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
  }, []);

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
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1B1B1F", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        Home
        {/* ADDED 19 Aug 2026 — canonical Settings location per Doc 1:
            "gear icon in the Top App Bar, canonically on Home." */}
        <SettingsIcon size={20} color="#5B5B62" style={{ cursor: "pointer" }} onClick={onOpenSettings} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#5B5B62", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Recent activity</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, padding: "0 14px", marginBottom: 24 }}>
        <SummaryRow label="Last contact added" value={lastContact ? `${lastContact.nickname || lastContact.name} · ${formatRelativeDate(lastContact.createdAt)}` : "None yet"} />
        <SummaryRow label="Last encounter" value={lastEncounter ? `${lastEncounter.title || lastEncounter.encounterType || "Encounter"} · ${formatRelativeDate(lastEncounter.date)}` : "None yet"} />
        <SummaryRow label="Last medication dose" value={lastDose ? `${lastDose.name} · ${formatRelativeDate(lastDose.date)}` : "None yet"} />
        <SummaryRow label="Last test" value={lastTest ? `${lastTest.title || lastTest.testingFor.join("/") || "Test"} · ${formatRelativeDate(lastTest.date)}` : "None yet"} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#5B5B62", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Quick add</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <QuickAddButton icon={Users} label="New contact" color="#14B8A6" onClick={() => onQuickAdd("contacts")} />
        <QuickAddButton icon={Activity} label="New encounter" color="#E24E9C" onClick={() => onQuickAdd("activity")} />
        <QuickAddButton icon={Pill} label="Log medication" color="#3B82F6" onClick={() => onQuickAdd("medication")} />
        <QuickAddButton icon={HeartPulse} label="Log test" color="#4A80F0" onClick={() => onQuickAdd("healthcare", "testing")} />
        <QuickAddButton icon={HeartPulse} label="New clinic visit" color="#4A80F0" onClick={() => onQuickAdd("healthcare", "clinicVisits")} />
      </div>

      <div style={{ fontSize: 11, color: "#9A9AA1", textAlign: "center", marginTop: 24 }}>
        24h summary and upcoming events will live here once Clinic Card exists.
      </div>
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
    <div style={{ position: "fixed", inset: 0, background: "#F0F0F3", zIndex: 60, overflowY: "auto", fontFamily: "'Public Sans', sans-serif" }}>
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
        <SettingsRow icon={Upload} label="Restore from backup" onClick={onImportClick} />
      </div>
      {status && (
        <div style={{ margin: "0 16px 20px", padding: "10px 14px", borderRadius: 12, background: "#FFF4CE", color: "#1B1B1F", fontSize: 12 }}>{status}</div>
      )}

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Not built yet</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", overflow: "hidden" }}>
        <SettingsRow icon={SettingsIcon} label="Preferences" disabled />
        <SettingsRow icon={SettingsIcon} label="Privacy" disabled />
        <SettingsRow icon={SettingsIcon} label="Appearance / theme" disabled />
        <SettingsRow icon={SettingsIcon} label="Developer tools" disabled />
      </div>

      {showMyProfile && (
        <div style={{ position: "fixed", inset: 0, zIndex: 70 }}>
          <MyProfileModule onClose={() => setShowMyProfile(false)} />
        </div>
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
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef(null);
  const activeTab = TABS.find((t) => t.key === active);
  const ActiveModule = activeTab.component;

  const handleQuickAdd = (tabKey, target) => {
    setActive(tabKey);
    setQuickAddTarget(target || null);
    setQuickAdd(true);
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
          <HomeScreen onQuickAdd={handleQuickAdd} onOpenSettings={() => setShowSettings(true)} />
        ) : ActiveModule ? (
          <ActiveModule openAddOnMount={quickAdd} onConsumedQuickAdd={() => { setQuickAdd(false); setQuickAddTarget(null); }} quickAddTarget={quickAddTarget} />
        ) : (
          <div style={{ padding: 40, textAlign: "center", color: "#5B5B62", fontFamily: "sans-serif" }}>
            <activeTab.icon size={32} color="#9A9AA1" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{activeTab.label} isn't built yet</div>
            <div style={{ fontSize: 13 }}>Needs Testing, Vaccination, and Clinic Visits to exist first.</div>
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FFFFFF", borderTop: "1px solid #DCDCE1", display: "flex", justifyContent: "space-around", padding: "10px 0 14px", zIndex: 100 }}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const isBuilt = tab.component !== null || tab.key === "home";
          const Icon = tab.icon;
          return (
            <div key={tab.key} onClick={() => setActive(tab.key)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", opacity: isBuilt ? 1 : 0.45 }}>
              <Icon size={22} color={isActive ? "#1B1B1F" : "#9A9AA1"} strokeWidth={isActive ? 2.5 : 2} />
              <span style={{ fontSize: 10, color: isActive ? "#1B1B1F" : "#9A9AA1", fontWeight: isActive ? 600 : 400 }}>{tab.label}</span>
            </div>
          );
        })}
      </div>

      {showSettings && (
        <SettingsScreen onClose={() => setShowSettings(false)} onExport={exportBackup} onImportClick={handleImportClick} status={status} />
      )}
    </div>
  );
}
