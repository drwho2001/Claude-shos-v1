import React, { useState, useRef, useEffect } from "react";
import ContactsModule from "./modules/SHOS_Contacts_Prototype";
import MedicationDashboard from "./modules/SHOS_Medication_Dashboard_Prototype";
import EncountersModule from "./modules/SHOS_Encounters_Prototype";
import TestingModule from "./modules/SHOS_Testing_Prototype";
import ClinicVisitsModule from "./modules/SHOS_ClinicVisits_Prototype";
import SymptomLogModule from "./modules/SHOS_SymptomLog_Prototype";
import VaccinationsModule from "./modules/SHOS_Vaccinations_Prototype";
import { exportBackup, importBackupFromFile, EXPORT_GROUPS, getLastBackupInfo } from "./storage/backupService";
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
import OptionListsScreen from "./modules/SHOS_OptionListEditor_Prototype";
import { PrivacySettingsRepository } from "./repositories/privacySettingsRepository";
import { AppPreferencesRepository } from "./repositories/appPreferencesRepository";
// ADDED — real ask: "standardise UI/appearance." Shared design tokens,
// the actual foundation — see designTokens.js for full reasoning and
// honest scope (this is a start, not a finished migration).
import { NEUTRAL, ACCENTS, FONT_FAMILY, RADIUS } from "./calculations/designTokens";
import { CustomOptionListsRepository } from "./repositories/customOptionListsRepository";
// ADDED — real ask: Home's title should read "[Name]'s dashboard".
import { MyProfileRepository } from "./repositories/myProfileRepository";
import { computeKinkUsage, computeChemsUsage, computeProtectionUsage, computeSymptomsUsage, computeOrganismUsage, computeResultsUsage } from "./calculations/registryUsage";
import { formatRelativeDate } from "./calculations/encounterCalculations";
import { Home, Users, Activity, Pill, HeartPulse, Download, Upload, ChevronRight, Settings as SettingsIcon, ChevronLeft, User, Search, Database, Trash2, AlertTriangle, Check, ClipboardList, ListTree, Paperclip, History, EyeOff, Eye, TestTube, Flame, Shield, Stethoscope, Microscope, ClipboardCheck, Syringe, Thermometer, Calendar, CreditCard } from "lucide-react";

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
  // CHANGED — real bugs found in Kane's own device testing: (1) this
  // whole screen had no fontFamily set anywhere at all, unlike every
  // other screen in the app, which wraps itself in Public Sans
  // explicitly — meaning it rendered in the browser's own default
  // font this whole time. (2) 4 sub-tab pills AND 3 icon-shortcuts
  // were fighting for space in ONE flex row with the icon group
  // pinned `flexShrink: 0`, forcing the pills to wrap awkwardly on a
  // real phone-width screen — "crammed... top left" was a real,
  // literal layout collision, not just visual taste. Both fixed here;
  // this is also the first real module migrated onto the shared
  // design tokens (designTokens.js) rather than its own hand-typed
  // hex values — the actual start of "standardise UI/appearance",
  // not a promise of it.
  const T = { healthcareBlue: ACCENTS.healthcare, border: NEUTRAL.border, textSecondary: NEUTRAL.textSecondary, surface: NEUTRAL.surface, bg: NEUTRAL.bg };

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      <div style={{ padding: "14px 16px 0", background: T.bg }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[{ key: "testing", label: "Testing" }, { key: "clinicVisits", label: "Clinic Visits" }, { key: "symptomLog", label: "Symptom Log" }, { key: "vaccinations", label: "Vaccinations" }].map((t) => (
            <div key={t.key} onClick={() => setSubTab(t.key)}
              style={{ padding: "6px 14px", borderRadius: RADIUS.full, fontSize: 12, fontWeight: 700, cursor: "pointer", background: subTab === t.key ? T.healthcareBlue : T.surface, color: subTab === t.key ? "#FFFFFF" : T.textSecondary, border: `1px solid ${subTab === t.key ? T.healthcareBlue : T.border}` }}>
              {t.label}
            </div>
          ))}
        </div>
        {/* CHANGED — real fix: moved to its own row below the sub-tab
            pills, instead of squeezed alongside them in one row —
            same entry points (Timeline/Attachments/Clinic Card),
            genuinely room to breathe now. */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, paddingBottom: 10, borderBottom: `1px solid ${T.border}` }}>
          <div onClick={() => setShowTimeline(true)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <Calendar size={15} color={T.healthcareBlue} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue }}>Timeline</span>
          </div>
          <div onClick={() => setShowAttachments(true)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <Paperclip size={15} color={T.healthcareBlue} />
            <span style={{ fontSize: 12, fontWeight: 700, color: T.healthcareBlue }}>Attachments</span>
          </div>
          <div onClick={() => setShowClinicCard(true)} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <CreditCard size={16} color={T.healthcareBlue} />
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
// CHANGED 20 Aug 2026 — real bug found in the design-unification pass:
// Medication's nav accent (#3B82F6) didn't actually match Medication
// Dashboard's own accent (medsBlue, #3D63C9/ACCENTS.medication) despite
// this comment block's own stated intent above — the nav tab and home
// quick-add button were a visibly different, lighter blue than the
// screen they represent. Now reads from ACCENTS directly (same as the
// other three domain tabs, already imported in this file) so this
// can't silently drift from the module's own color again.
const TABS = [
  { key: "contacts", label: "Contacts", icon: Users, component: ContactsModule, accent: ACCENTS.contacts },
  { key: "activity", label: "Activity", icon: Activity, component: EncountersModule, accent: ACCENTS.encounters },
  { key: "home", label: "Home", icon: Home, component: null, accent: NEUTRAL.textPrimary },
  { key: "medication", label: "Medication", icon: Pill, component: MedicationDashboard, accent: ACCENTS.medication },
  { key: "healthcare", label: "Healthcare", icon: HeartPulse, component: HealthcareScreen, accent: ACCENTS.healthcare },
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
  // ADDED — real ask: title reads "[Name]'s dashboard" instead of a
  // bare "Home". My Profile only has `nickname`, no separate name
  // field — falls back to a generic label if it's never been filled
  // in, rather than showing "'s dashboard" with a blank in front.
  const [profileName] = useState(() => MyProfileRepository.getProfile().nickname);
  const [lastContact, setLastContact] = useState(null);
  const [lastEncounter, setLastEncounter] = useState(null);
  const [lastDose, setLastDose] = useState(null);
  const [lastTest, setLastTest] = useState(null);
  const [showMyProfile, setShowMyProfile] = useState(false);
  const [showClinicCard, setShowClinicCard] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  // ADDED 19 Aug 2026 — next scheduled clinic visit, real data.
  const [nextVisit, setNextVisit] = useState(null);
  // ADDED 19 Aug 2026 — real ask: a backup reminder. Read once on
  // mount, same pattern as everything else on Home — see
  // backupService.js's getLastBackupInfo() for how "due" is computed.
  const [backupInfo] = useState(() => getLastBackupInfo());

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

    // CHANGED — real bug from Kane's own testing ("Next clinic visit
    // is displaying incorrect or incomplete data"): this used to filter
    // on `isFutureAppointment`, a manually-set toggle from when the
    // visit was created — nothing ever flips it back off once that
    // date actually passes, so a stale-flagged past visit could keep
    // showing as "next", while a genuinely future visit left un-toggled
    // wouldn't show at all. Derived from the real date instead — same
    // "store facts, derive state" principle already used for Contacts'
    // own inactive-flag logic, just not consistently applied here
    // before now.
    const today = new Date().toISOString().slice(0, 10);
    const visits = ClinicVisitsRepository.getAll().filter((v) => !v.isArchived && v.date && v.date.slice(0, 10) >= today);
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
        {profileName ? `${profileName}'s dashboard` : "Your dashboard"}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* ADDED 19 Aug 2026 — Global Search, canonical Home placement
              per Doc 1, same treatment as the Settings gear icon right
              next to it. */}
          <Search size={19} color="#5B5B62" style={{ cursor: "pointer" }} onClick={onOpenSearch} title="Search" />
          {/* ADDED 19 Aug 2026 — My Profile access on Home too, per
              Kane's ask, alongside the existing Contacts shortcut. */}
          <User size={19} color="#5B5B62" style={{ cursor: "pointer" }} onClick={() => setShowMyProfile(true)} title="My Profile" />
          {/* ADDED 19 Aug 2026 — canonical Settings location per Doc 1:
              "gear icon in the Top App Bar, canonically on Home." */}
          <SettingsIcon size={20} color="#5B5B62" style={{ cursor: "pointer" }} onClick={onOpenSettings} title="Settings" />
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

      {/* CHANGED — real ask: Clinic Card + Timeline moved above Quick
          Add, was below it before. */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {/* CHANGED — real ask: Clinic Card gets an ID-card icon, Timeline
            gets a calendar icon, instead of the generic clipboard/history
            icons before. */}
        <div onClick={() => setShowClinicCard(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 10px", borderRadius: 16, border: "1px solid #DCDCE1", background: "#FFFFFF", cursor: "pointer" }}>
          <CreditCard size={15} color="#4A80F0" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4A80F0" }}>Clinic Card</span>
        </div>
        <div onClick={() => setShowTimeline(true)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "12px 10px", borderRadius: 16, border: "1px solid #DCDCE1", background: "#FFFFFF", cursor: "pointer" }}>
          <Calendar size={15} color="#4A80F0" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#4A80F0" }}>Timeline</span>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#5B5B62", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Quick add</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Personal</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <QuickAddButton icon={Users} label="New contact" color={ACCENTS.contacts} onClick={() => onQuickAdd("contacts")} />
        {/* CHANGED — real ask: a distinct icon for Encounter rather
            than the generic Activity glyph. Lucide doesn't have a
            literal "lips" icon (checked before picking a substitute,
            not guessed at) — Flame is the closest thematically-honest
            match already established in this app (Kink Registry uses
            it the same way), kept in Encounters' own existing pink. */}
        <QuickAddButton icon={Flame} label="New encounter" color={ACCENTS.encounters} onClick={() => onQuickAdd("activity")} />
        {/* CHANGED 20 Aug 2026 — real bug found in the design-
            unification pass: this was #3B82F6, a different, lighter
            blue than Medication Dashboard's own accent (medsBlue,
            ACCENTS.medication). Now reads from the same shared token
            the module itself uses. */}
        <QuickAddButton icon={Pill} label="Log medication" color={ACCENTS.medication} onClick={() => onQuickAdd("medication")} />
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Healthcare</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <QuickAddButton icon={TestTube} label="Log test" color="#4A80F0" onClick={() => onQuickAdd("healthcare", "testing")} />
        {/* CHANGED — real ask: Clinic Visit gets Stethoscope, Symptom
            gets Thermometer ("Bandage" isn't an icon this lucide-react
            version exports — build-verified before picking a
            substitute, not guessed at), and Vaccination gets Syringe —
            was all four sharing the same generic HeartPulse before. */}
        <QuickAddButton icon={Stethoscope} label="New clinic visit" color="#4A80F0" onClick={() => onQuickAdd("healthcare", "clinicVisits")} />
        <QuickAddButton icon={Thermometer} label="Log symptom" color="#4A80F0" onClick={() => onQuickAdd("healthcare", "symptomLog")} />
        <QuickAddButton icon={Syringe} label="Log vaccination" color="#4A80F0" onClick={() => onQuickAdd("healthcare", "vaccinations")} />
      </div>

      {/* ADDED 19 Aug 2026 — real ask: a backup reminder. No cloud
          sync by design (everything stays on-device) means a real
          backup is the only actual safety net — this makes it visible
          rather than silently relying on Kane remembering. Tapping it
          opens Settings, same screen Export already lives in, rather
          than trying to export directly from Home. Kept as its own
          full-width row, deliberately NOT folded into the shortcuts
          row above — this is an alert, a different kind of thing from
          a navigation shortcut, and shouldn't visually blend in with
          them. */}
      {backupInfo.dueForReminder && (
        <div onClick={onOpenSettings} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, padding: "12px 16px", borderRadius: 16, border: "1px solid #F59E0B40", background: "#FFF7ED", cursor: "pointer" }}>
          <Database size={15} color="#B45309" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#B45309" }}>
            {backupInfo.lastAt ? `No backup in ${backupInfo.daysSince} days — export one` : "You've never exported a backup — do it now"}
          </span>
        </div>
      )}

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

      {/* ADDED — real ask: this never explained what it was actually
          counting. It's a real storage overview (every repository's
          live record count) plus a full reset below — not a
          timeframe-based count, that's a separate, still-outstanding
          Activity filter request. */}
      <div style={{ fontSize: 11, color: "#5B5B62", padding: "10px 16px 0" }}>
        Live record counts across every part of the app's local storage, mainly useful for confirming a backup/restore or migration went as expected.
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
// ADDED 19 Aug 2026 — real ask: "like in Notion, all options should
// have an emoji and colour theme... clean to infer from" — an icon +
// color per REGISTRY/CATEGORY (matching Notion's own per-database icon
// convention), not per individual entry within a registry (a bigger,
// separate ask — per-value icons for every single Kink/Chem/etc. entry
// would need real UI work letting Kane pick one per entry, not done
// here, flagged rather than silently attempted). Organism → Microscope
// is Kane's own named example, applied literally.
const REGISTRIES = [
  { key: "kink", label: "Kink Registry", registry: KinkRegistry, color: "#E5484D", icon: Flame, computeUsage: computeKinkUsage },
  { key: "protection", label: "Protection Registry", registry: ProtectionRegistry, color: "#E24E9C", icon: Shield, computeUsage: computeProtectionUsage },
  { key: "chems", label: "Chems Registry", registry: ChemsRegistry, color: "#5B5B62", icon: Pill, computeUsage: computeChemsUsage },
  { key: "symptoms", label: "Symptoms Registry", registry: SymptomsRegistry, color: "#4A80F0", icon: Stethoscope, computeUsage: computeSymptomsUsage },
  { key: "organism", label: "Organism Registry", registry: OrganismRegistry, color: "#4A80F0", icon: Microscope, computeUsage: computeOrganismUsage },
  { key: "results", label: "Results Registry", registry: ResultsRegistry, color: "#4A80F0", icon: ClipboardCheck, computeUsage: computeResultsUsage },
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
              {/* CHANGED 19 Aug 2026 — plain color dot replaced with a
                  real icon+color badge, matching every entry's own
                  logical icon rather than an undifferentiated dot. */}
              <div style={{ width: 28, height: 28, borderRadius: 999, background: `${r.color}1A`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <r.icon size={14} color={r.color} />
              </div>
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

// ADDED 19 Aug 2026 — Privacy screen: Anonymise mode. Real, scoped ask
// from Kane, not the earlier vague "what counts as identifiable"
// unknown — see privacySettingsRepository.js for the full reasoning
// and exact field-tier list.
function PrivacyScreen({ onClose }) {
  const [settings, setSettings] = useState(() => PrivacySettingsRepository.getSettings());
  const [pinEntry, setPinEntry] = useState("");
  const [pinError, setPinError] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  // ADDED — real ask: force reconfirmation before accepting a new PIN,
  // to catch typos (a wrong PIN saved silently would lock Kane out of
  // his own Anonymise-revert/App-Lock later, with no way back in).
  const [confirmPin, setConfirmPin] = useState("");
  // ADDED — real ask: eye-icon show/hide toggle on PIN entry, matching
  // the pattern used elsewhere on the web. Shared across every PIN
  // field on this screen.
  const [showPins, setShowPins] = useState(false);

  const refresh = () => setSettings(PrivacySettingsRepository.getSettings());

  const activate = () => { PrivacySettingsRepository.activate(); refresh(); };
  const attemptDeactivate = () => {
    const result = PrivacySettingsRepository.deactivate(pinEntry);
    if (result.ok) { setPinEntry(""); setPinError(""); refresh(); }
    else setPinError(result.error);
  };
  const savePin = () => {
    const trimmed = newPin.trim();
    if (trimmed.length < 4) { setPinError("PIN should be at least 4 digits."); return; }
    // CHANGED — real ask: force reconfirmation before accepting.
    if (trimmed !== confirmPin.trim()) { setPinError("PINs don't match — check both and try again."); return; }
    PrivacySettingsRepository.update({ anonymisePin: trimmed });
    setNewPin(""); setConfirmPin(""); setSettingPin(false); setPinError("");
    refresh();
  };

  // ADDED 19 Aug 2026 — App Lock toggle, real ask. Guarded: can't turn
  // on without a PIN already set, since App Lock with no PIN would
  // show a lock screen that anything (even leaving the field blank)
  // trivially bypasses — confusing, not actually locked. Turning OFF
  // never needs the PIN re-entered here; you're already inside
  // Settings, which the lock screen itself already gated.
  const toggleAppLock = () => {
    if (!settings.appLockEnabled && !settings.anonymisePin) {
      setPinError("Set a PIN below first, then App Lock can use it.");
      return;
    }
    PrivacySettingsRepository.update({ appLockEnabled: !settings.appLockEnabled });
    refresh();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: "#F0F0F3", borderBottom: "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color="#1B1B1F" style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#1B1B1F" }}>Privacy & Security</span>
      </div>

      <div style={{ padding: "16px" }}>
        {/* Big, clearly separated toggle button — never on by default,
            per Kane's explicit instruction, and always one tap to turn
            ON regardless of any PIN. */}
        <div onClick={settings.anonymiseModeActive ? undefined : activate}
          style={{ padding: 18, borderRadius: 16, background: settings.anonymiseModeActive ? "#1B1B1F" : "#FFFFFF", border: `1px solid ${settings.anonymiseModeActive ? "#1B1B1F" : "#DCDCE1"}`, cursor: settings.anonymiseModeActive ? "default" : "pointer", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {settings.anonymiseModeActive ? <EyeOff size={20} color="#FFFFFF" /> : <Eye size={20} color="#1B1B1F" />}
            <span style={{ fontSize: 15, fontWeight: 700, color: settings.anonymiseModeActive ? "#FFFFFF" : "#1B1B1F" }}>
              {settings.anonymiseModeActive ? "Anonymise mode is ON" : "Turn on Anonymise mode"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: settings.anonymiseModeActive ? "#DCDCE1" : "#5B5B62", marginTop: 6 }}>
            {settings.anonymiseModeActive
              ? "Names, photos, addresses, and car details are hidden across Contacts."
              : "Tap right before handing your phone over — hides names, photos, addresses, and car registration in Contacts. Never turns on by itself."}
          </div>
        </div>

        {settings.anonymiseModeActive && (
          <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1B1B1F", marginBottom: 8 }}>
              {settings.anonymisePin ? "Enter your PIN to turn it back off" : "Turn it back off"}
            </div>
            {settings.anonymisePin && (
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={pinEntry} onChange={(e) => { setPinEntry(e.target.value); setPinError(""); }} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="PIN"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color="#9A9AA1" style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color="#9A9AA1" style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
            )}
            {pinError && <div style={{ fontSize: 12, color: "#E5484D", marginBottom: 8 }}>{pinError}</div>}
            <button onClick={attemptDeactivate} style={{ width: "100%", padding: 12, borderRadius: 999, border: "none", background: "#4A80F0", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
              Turn off Anonymise mode
            </button>
          </div>
        )}

        {/* CHANGED — real ask: moved to sit immediately below the base
            Anonymise toggle (was further down, after App Lock) — also
            now genuinely disabled, not just visually de-emphasized,
            unless Anonymise mode is actually on. Toggling "further"
            hiding when the base tier isn't even active never made
            sense — there'd be nothing for it to add on top of. */}
        <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginBottom: 16, opacity: settings.anonymiseModeActive ? 1 : 0.5 }}>
          <div onClick={settings.anonymiseModeActive ? () => { PrivacySettingsRepository.update({ hideFurtherEnabled: !settings.hideFurtherEnabled }); refresh(); } : undefined}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: settings.anonymiseModeActive ? "pointer" : "default" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1B1B1F" }}>Also hide kinks & physical attributes</div>
              <div style={{ fontSize: 11, color: "#5B5B62", marginTop: 2 }}>
                {settings.anonymiseModeActive
                  ? "Stated kinks, limits, length/girth, and Cummer stats — hidden in addition to the base fields above, only while Anonymise mode is on."
                  : "Turn on Anonymise mode above first — this only ever applies on top of it."}
              </div>
            </div>
            <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.hideFurtherEnabled ? "#4A80F0" : "#DCDCE1", position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: settings.hideFurtherEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
            </div>
          </div>
        </div>

        {/* ADDED 19 Aug 2026 — App Lock, real ask, separate from
            Anonymise mode: gates opening the app at all, not just
            masking fields once it's open. Biometric (Face ID/
            fingerprint) isn't available here — needs the Capacitor
            native wrapper's own APIs, not buildable in a browser/PWA. */}
        <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div onClick={toggleAppLock} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#1B1B1F" }}>App Lock</div>
              <div style={{ fontSize: 11, color: "#5B5B62", marginTop: 2 }}>Require your PIN just to open the app at all. Uses the same PIN as the Revert PIN below. Biometric unlock isn't available yet — needs the native app version.</div>
            </div>
            <div style={{ width: 40, height: 24, borderRadius: 999, background: settings.appLockEnabled ? "#4A80F0" : "#DCDCE1", position: "relative", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: settings.appLockEnabled ? 18 : 2, width: 20, height: 20, borderRadius: 999, background: "#FFFFFF" }} />
            </div>
          </div>
          {/* ADDED 19 Aug 2026 — real fix while building this: without
              this, the "set a PIN first" guard message had nowhere to
              actually render when neither the deactivate flow nor the
              set-PIN flow was open — Kane would tap the toggle, nothing
              would visibly happen, and the guard would silently do
              nothing from his side. */}
          {pinError && !settings.anonymiseModeActive && !settingPin && (
            <div style={{ fontSize: 12, color: "#E5484D", marginTop: 8 }}>{pinError}</div>
          )}
        </div>

        {/* CHANGED — real ask: "App Lock and Revert PIN should be
            neighbours" — moved to sit directly below App Lock now,
            since they share the exact same PIN. */}
        <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1B1B1F", marginBottom: 4 }}>Revert PIN</div>
          <div style={{ fontSize: 11, color: "#5B5B62", marginBottom: 10 }}>
            {settings.anonymisePin ? "A PIN is set — used for both Anonymise mode's revert and App Lock above." : "No PIN set yet — anyone can turn Anonymise mode back off right now, and App Lock can't be turned on. Set one so both actually protect you."}
          </div>
          {settingPin ? (
            <>
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={newPin} onChange={(e) => setNewPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="New PIN (4+ digits)"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color="#9A9AA1" style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color="#9A9AA1" style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
              {/* ADDED — real ask: force reconfirmation before accepting,
                  to catch typos before they lock Kane out later. */}
              <div style={{ position: "relative", marginBottom: 8 }}>
                <input value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} type={showPins ? "text" : "password"} inputMode="numeric" placeholder="Confirm new PIN"
                  style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 8, border: "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
                {showPins ? <EyeOff size={17} color="#9A9AA1" style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(false)} />
                  : <Eye size={17} color="#9A9AA1" style={{ position: "absolute", right: 12, top: 12, cursor: "pointer" }} onClick={() => setShowPins(true)} />}
              </div>
              {pinError && <div style={{ fontSize: 12, color: "#E5484D", marginBottom: 8 }}>{pinError}</div>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setSettingPin(false); setNewPin(""); setConfirmPin(""); setPinError(""); }} style={{ flex: 1, padding: 10, borderRadius: 999, border: "1px solid #DCDCE1", background: "transparent", color: "#5B5B62", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={savePin} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: "#4A80F0", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Save PIN</button>
              </div>
            </>
          ) : (
            <button onClick={() => setSettingPin(true)} style={{ width: "100%", padding: 10, borderRadius: 999, border: "1px solid #4A80F0", background: "transparent", color: "#4A80F0", fontWeight: 700, cursor: "pointer" }}>
              {settings.anonymisePin ? "Change PIN" : "Set a PIN"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ADDED 19 Aug 2026 — Preferences, real now. Deliberately small — one
// real, concrete setting (Kane's own ask), not speculative toggles
// filling out a section just because it existed. More real
// Preferences items land here as they come up, same pattern as
// Privacy/Registries/Option lists getting built incrementally rather
// than all at once up front.
function PreferencesScreen({ onClose }) {
  const [prefs, setPrefs] = useState(() => AppPreferencesRepository.getPreferences());
  const [draftValue, setDraftValue] = useState(() => String(prefs.inactiveThresholdDays));

  const save = () => {
    const parsed = parseInt(draftValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    const updated = AppPreferencesRepository.update({ inactiveThresholdDays: parsed });
    setPrefs(updated);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#F0F0F3", zIndex: 220, overflowY: "auto", fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: "#F0F0F3", borderBottom: "1px solid #DCDCE1" }}>
        <ChevronLeft size={22} color="#1B1B1F" style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: "#1B1B1F" }}>Preferences</span>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1B1B1F", marginBottom: 4 }}>Inactive contact threshold</div>
          <div style={{ fontSize: 11, color: "#5B5B62", marginBottom: 12 }}>
            Days since a Contact's last Encounter before it shows the red "inactive" flag. Was fixed at 90 — now yours to set. A specific contact can also be excluded from this entirely (edit that contact → "One-off / never expect to recur").
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={draftValue} onChange={(e) => setDraftValue(e.target.value)} type="number" min="1"
              style={{ width: 90, padding: "10px 12px", borderRadius: 8, border: "1px solid #DCDCE1", fontSize: 14, boxSizing: "border-box" }} />
            <span style={{ fontSize: 13, color: "#5B5B62" }}>days</span>
            <button onClick={save} style={{ marginLeft: "auto", padding: "10px 18px", borderRadius: 999, border: "none", background: "#4A80F0", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
              Save
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#9A9AA1", marginTop: 10 }}>Currently: {prefs.inactiveThresholdDays} days.</div>
        </div>
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
  const [showSelectiveExport, setShowSelectiveExport] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [showRegistries, setShowRegistries] = useState(false);
  const [showOptionLists, setShowOptionLists] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

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
        {/* CHANGED — real bug found in Kane's own testing: passing
            `exportBackup` directly meant the DOM click's SyntheticEvent
            got passed as `includeKeys`, which buildBackup() then tried
            to iterate as a selective-key Set and threw. Selective
            export never hit this because its own button already
            wrapped the call in an arrow function that discards the
            event. Wrapping this one the same way. */}
        <SettingsRow icon={Download} label="Export backup" onClick={() => onExport()} />
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
        {/* ADDED 19 Aug 2026 — Option lists, the "idiot-proof editor"
            Kane asked for, for the simpler flat-string option lists. */}
        <SettingsRow icon={ListTree} label="Option lists" onClick={() => setShowOptionLists(true)} />
        {/* CHANGED 19 Aug 2026 — real fix: Privacy was already real
            (onClick worked), but had been left sitting visually under
            "Not built yet" below since that entry was first added —
            moved up to where it actually belongs. */}
        <SettingsRow icon={SettingsIcon} label="Privacy" onClick={() => setShowPrivacy(true)} />
        {/* ADDED 19 Aug 2026 — Preferences, real now: the configurable
            inactive-contact threshold, Kane's own first concrete ask
            for this previously fully-stubbed section. */}
        <SettingsRow icon={SettingsIcon} label="Preferences" onClick={() => setShowPreferences(true)} />
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "#9A9AA1", textTransform: "uppercase", letterSpacing: 0.5, padding: "0 16px 6px" }}>Not built yet</div>
      <div style={{ background: "#FFFFFF", border: "1px solid #DCDCE1", borderRadius: 16, margin: "0 16px 20px", overflow: "hidden" }}>
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
      {showOptionLists && (
        <OptionListsScreen onClose={() => setShowOptionLists(false)} />
      )}
      {showPrivacy && (
        <PrivacyScreen onClose={() => setShowPrivacy(false)} />
      )}
      {showPreferences && (
        <PreferencesScreen onClose={() => setShowPreferences(false)} />
      )}
    </div>
  );
}

// ADDED 19 Aug 2026 — App Lock's own lock screen, real ask. Shown
// instead of the normal app whenever appLockEnabled is on — gates
// opening the app itself, distinct from Anonymise mode (which stays
// active independently once you're past this). Never on by default;
// reuses the same PIN as Anonymise mode's revert, per
// privacySettingsRepository.js's own reasoning.
function AppLockScreen({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const attempt = () => {
    if (PrivacySettingsRepository.checkAppLockPin(pin)) {
      onUnlock();
    } else {
      setError("Incorrect PIN.");
      setPin("");
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#1B1B1F", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 999, fontFamily: "'Public Sans', sans-serif" }}>
      <Eye size={32} color="#FFFFFF" style={{ marginBottom: 16, opacity: 0.6 }} />
      <div style={{ fontSize: 16, fontWeight: 700, color: "#FFFFFF", marginBottom: 16 }}>Enter PIN to unlock</div>
      <input value={pin} onChange={(e) => { setPin(e.target.value); setError(""); }} type="password" inputMode="numeric" autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") attempt(); }}
        style={{ width: 200, padding: "12px 16px", borderRadius: 8, border: "none", fontSize: 16, textAlign: "center", marginBottom: 12, boxSizing: "border-box" }} />
      {error && <div style={{ fontSize: 12, color: "#E5484D", marginBottom: 12 }}>{error}</div>}
      <button onClick={attempt} style={{ padding: "10px 24px", borderRadius: 999, border: "none", background: "#4A80F0", color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>
        Unlock
      </button>
    </div>
  );
}

// ADDED 19 Aug 2026 — real ask: a setup prompt offering App Lock when
// it isn't already on, shown on launch and kept reappearing on future
// launches until "Don't ask again" is explicitly tapped — NOT the
// same as just closing it once (X/"Not now" only dismisses THIS
// instance, deliberately, so it can genuinely nudge again later
// rather than vanish for good the first time someone's in a hurry).
//
// CRITICAL, per Kane's own explicit worry: this must NEVER block
// access to the rest of the app. Every dismissal path (X, "Not now",
// "Don't ask again") gets you straight into the real app immediately
// — there's no path through this component that traps you. Tapping
// "Set up App Lock" takes you to Settings to actually configure it,
// rather than trying to build a PIN-setup flow inline here too.
function AppLockPrompt({ onDismiss, onDismissForever, onOpenSettings }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", zIndex: 998 }} onClick={onDismiss}>
      <div style={{ background: "#FFFFFF", width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, fontFamily: "'Public Sans', sans-serif" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Eye size={20} color="#4A80F0" />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#1B1B1F" }}>Want to lock the app with a PIN?</span>
        </div>
        <div style={{ fontSize: 12, color: "#5B5B62", marginBottom: 16, lineHeight: 1.5 }}>
          Optional, and off by default — this just means nobody can open the app on this device without your PIN. You can turn it on any time from Settings → Privacy instead, if you'd rather decide later.
        </div>
        <button onClick={onOpenSettings} style={{ width: "100%", padding: 14, borderRadius: 999, border: "none", background: "#4A80F0", color: "#FFFFFF", fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
          Set up App Lock
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onDismiss} style={{ flex: 1, padding: 12, borderRadius: 999, border: "1px solid #DCDCE1", background: "transparent", color: "#5B5B62", fontWeight: 600, cursor: "pointer" }}>
            Not now
          </button>
          <button onClick={onDismissForever} style={{ flex: 1, padding: 12, borderRadius: 999, border: "1px solid #DCDCE1", background: "transparent", color: "#9A9AA1", fontWeight: 600, cursor: "pointer" }}>
            Don't ask again
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  // ADDED 19 Aug 2026 — App Lock: checked once on load, held in state
  // for the session — matches how a lock screen actually behaves (you
  // don't want it demanding the PIN again every single re-render, only
  // on genuinely opening/reloading the app). Real ask, always optional
  // per Kane's instruction — `locked` starts false immediately if
  // appLockEnabled is off, so nothing changes for anyone not using it.
  const [locked, setLocked] = useState(() => PrivacySettingsRepository.getSettings().appLockEnabled);
  // ADDED 19 Aug 2026 — real ask: the setup prompt itself. Read once
  // on load, same pattern as `locked` above — shows whenever App Lock
  // isn't on AND the prompt hasn't been permanently dismissed.
  const [showAppLockPrompt, setShowAppLockPrompt] = useState(() => {
    const settings = PrivacySettingsRepository.getSettings();
    return !settings.appLockEnabled && !settings.appLockPromptDismissed;
  });
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

  // ADDED — real ask: "linked encounter should be actually linked",
  // "attendees should link through to contact card", both directions.
  // Same prop-threading pattern already used for openAddOnMount/
  // quickAddTarget above — ActiveModule already receives props
  // uniformly regardless of which module is currently active, so this
  // reuses that same plumbing rather than building new per-module
  // wiring.
  const [pendingOpenRecordId, setPendingOpenRecordId] = useState(null);
  const navigateToRecord = (tabKey, recordId) => {
    navigateTo(tabKey);
    setPendingOpenRecordId(recordId);
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

  // ADDED 19 Aug 2026 — App Lock gate: shown INSTEAD of everything
  // else while locked, real ask.
  if (locked) {
    return <AppLockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F0F0F3", display: "flex", flexDirection: "column" }}>
      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChosen} style={{ display: "none" }} />

      <div style={{ flex: 1, paddingBottom: 76 }}>
        {active === "home" ? (
          <HomeScreen onQuickAdd={handleQuickAdd} onOpenSettings={() => setShowSettings(true)} onOpenSearch={() => setShowSearch(true)} />
        ) : ActiveModule ? (
          <ActiveModule key={`${active}-${navResetCount}`} openAddOnMount={quickAdd} onConsumedQuickAdd={() => { setQuickAdd(false); setQuickAddTarget(null); }} quickAddTarget={quickAddTarget}
            openRecordId={pendingOpenRecordId} onConsumedRecordOpen={() => setPendingOpenRecordId(null)} onNavigateToRecord={navigateToRecord} />
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
      {/* ADDED 19 Aug 2026 — real ask: App Lock setup prompt. Renders
          as an overlay ON TOP of the real, already-interactive app
          underneath — never a full-screen replacement the way the
          actual lock gate above is. Every dismissal path leads
          straight back into the real app, immediately. */}
      {showAppLockPrompt && (
        <AppLockPrompt
          onDismiss={() => setShowAppLockPrompt(false)}
          onDismissForever={() => { PrivacySettingsRepository.update({ appLockPromptDismissed: true }); setShowAppLockPrompt(false); }}
          onOpenSettings={() => { setShowAppLockPrompt(false); setShowSettings(true); }}
        />
      )}
    </div>
  );
}
