import React, { useMemo, useState } from "react";
import { ChevronLeft, Pill, HeartPulse, Users, AlertTriangle } from "lucide-react";
import { MedicationRepository } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { TestingRepository } from "../repositories/testingRepository";
import { OrganismRegistry } from "../registries/organismRegistry";
import { ResultsRegistry } from "../registries/resultsRegistry";
import { EncounterRepository } from "../repositories/encounterRepository";
import { SymptomsRegistry } from "../registries/symptomsRegistry";
import { computeStock } from "../calculations/medicationCalculations";
import { formatRelativeDate, sortByDateDesc } from "../calculations/encounterCalculations";
import { MyProfileRepository } from "../repositories/myProfileRepository";
import { SymptomLogRepository } from "../repositories/symptomLogRepository";
import { VaccinationRepository } from "../repositories/vaccinationRepository";
// CHANGED 20 Aug 2026 — real design-unification pass: values read
// from the shared designTokens.js source of truth instead of being
// retyped here. See designTokens.js.
import { NEUTRAL, ACCENTS, ACTION } from "../calculations/designTokens";

const T = {
  ...NEUTRAL,
  healthcareBlue: ACCENTS.healthcare, actionRed: ACTION.red,
};

// ADDED 19 Aug 2026 — Clinic Card, per Kane's priority order. Built
// STRICTLY to Doc 1/Doc 4's already-confirmed spec rather than the
// looser section list floated back on 18 Aug before those docs were
// checked — Doc 4 §10 names exactly 8 sections: Current medications,
// Allergies, Vaccinations, Recent STI testing, Current treatment,
// Active symptoms, Recent partners, Emergency information.
//
// Two of those — Allergies and Emergency information — genuinely don't
// exist as data ANYWHERE in this project: not in live Notion, not in
// any repository built so far, not even a stray unused field. Building
// them here would mean inventing a new field and a new place to enter
// it (Contacts? My Profile? somewhere new?) — a real data-modeling
// decision, not a display task, so they're honestly stubbed with a
// note explaining why, same as every other "real gap, not guessed at"
// flag throughout this project. Vaccinations stays stubbed for the
// existing, already-logged reason: Vaccination Record doesn't exist as
// an app module yet.
//
// "Recent partners" showing descriptive Encounter titles + date is a
// DELIBERATE, Kane-confirmed exception to the rest of the app's
// privacy-by-minimalism default (Doc 1, 4 Aug 2026 decision) — not an
// oversight or a place to quietly apply the stricter rule used
// elsewhere.
//
// Read-only by design (Doc 4: "no back-swipe-to-edit... no FAB, no
// creation actions") — every section here is DERIVED from real
// repositories, nothing is editable from this screen, matching the
// clinician-facing framing directly.
function loadMedicationsWithLogs() {
  return MedicationRepository.getAll()
    .filter((m) => !m.isArchived)
    .map((m) => ({ ...m, logs: LogRepository.getForMedication(m.id) }));
}

function SectionHeader({ children }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: T.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, padding: "16px 16px 6px" }}>{children}</div>;
}

function SectionCard({ children }) {
  return <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, margin: "0 16px", overflow: "hidden" }}>{children}</div>;
}

function Row({ dot, title, subtitle, alert, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ width: 9, height: 9, borderRadius: 999, background: alert ? T.actionRed : (color || T.healthcareBlue), flexShrink: 0 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: alert ? T.actionRed : T.textPrimary }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function EmptyRow({ children }) {
  return <div style={{ padding: "14px", fontSize: 13, color: T.textDisabled }}>{children}</div>;
}

function StubRow({ children }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "14px", alignItems: "flex-start" }}>
      <AlertTriangle size={14} color={T.textDisabled} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ fontSize: 12, color: T.textDisabled, lineHeight: 1.4 }}>{children}</span>
    </div>
  );
}

export default function ClinicCardScreen({ onClose }) {
  const meds = useMemo(() => loadMedicationsWithLogs(), []);
  const tests = useMemo(() => sortByDateDesc(TestingRepository.getAll().filter((t) => !t.isArchived)), []);
  const encounters = useMemo(() => sortByDateDesc(EncounterRepository.getAll()), []);
  const [profile, setProfile] = useState(() => MyProfileRepository.getProfile());

  const nameFrom = (registry, id) => registry.getById(id)?.name || "—";

  const [editingIdentity, setEditingIdentity] = useState(false);
  const [identityDraft, setIdentityDraft] = useState(null);

  const openIdentityEdit = () => {
    setIdentityDraft({ dateOfBirth: profile.dateOfBirth, clinicNumber: profile.clinicNumber, address: profile.address, nhsNumber: profile.nhsNumber });
    setEditingIdentity(true);
  };
  const saveIdentity = () => {
    setProfile(MyProfileRepository.update(identityDraft));
    setEditingIdentity(false);
  };

  const recentTests = tests.slice(0, 5).map((t) => {
    const resultNames = (t.resultIds || []).map((id) => nameFrom(ResultsRegistry, id));
    const isPositive = resultNames.some((r) => r.toLowerCase() === "positive");
    const testingFor = (t.testingFor || []).join(", ") || t.title || "Test";
    return { id: t.id, title: testingFor, subtitle: `${formatRelativeDate(t.date)} · ${resultNames.join(", ") || "No result logged"}`, alert: isPositive };
  });

  // Current treatment: a positive result with no follow-up action date
  // logged yet — the same "open" signal Testing's own module already
  // uses (Follow-up Actioned Date empty), not a new concept invented
  // for this screen.
  const currentTreatment = tests.filter((t) => {
    const resultNames = (t.resultIds || []).map((id) => nameFrom(ResultsRegistry, id));
    const isPositive = resultNames.some((r) => r.toLowerCase() === "positive");
    return isPositive && !t.followUpActionedDate;
  }).map((t) => ({
    id: t.id,
    title: (t.testingFor || []).join(", ") || t.title || "Positive result",
    subtitle: `${formatRelativeDate(t.date)} · awaiting follow-up`,
  }));

  // CHANGED 19 Aug 2026 — replaced the 30-day-Encounters-tag proxy with
  // the real thing, now that Symptom Log exists: "active" is Symptom
  // Log's own real Date Resolved field being empty, not a guessed time
  // window. Severe entries flagged red, same Action State pattern as
  // the rest of this screen.
  const activeSymptoms = SymptomLogRepository.getActive();

  // CHANGED 19 Aug 2026 — real data, Vaccination Record now exists.
  // Shows recent vaccinations plus any overdue boosters/next-dues in
  // red — same Action State convention as the rest of this screen.
  const vaccinations = sortByDateDesc(VaccinationRepository.getAll().filter((v) => !v.isArchived));
  const overdueVaccinations = VaccinationRepository.getOverdue();

  const recentPartners = encounters.slice(0, 8).map((e) => ({
    id: e.id,
    title: e.title || e.encounterType || "Encounter",
    subtitle: e.date ? formatRelativeDate(e.date) : "",
  }));

  return (
    <div style={{ position: "fixed", inset: 0, background: T.bg, zIndex: 200, overflowY: "auto", fontFamily: "'Public Sans', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, position: "sticky", top: 0, background: T.bg, borderBottom: `1px solid ${T.border}` }}>
        <ChevronLeft size={22} color={T.textPrimary} style={{ cursor: "pointer" }} onClick={onClose} />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>{profile.nickname ? `${profile.nickname}'s clinic card` : "Clinic Card"}</span>
      </div>
      <div style={{ padding: "10px 16px 0", fontSize: 12, color: T.textSecondary }}>
        A read-only summary — nothing here is editable from this screen, except the identity details directly below. Tap the relevant module to make other changes.
      </div>

      {/* ADDED — real, explicitly scoped ask: DOB/clinic number/
          address/NHS number, editable ONLY here on Clinic Card — never
          on My Profile's own edit screen, and never included in a
          shared-profile export (see profileShareService.js's own
          explicit exclusion list). The one deliberate exception to
          this screen's "read-only" rule, since there's genuinely
          nowhere else these belong. */}
      <SectionHeader>Identity</SectionHeader>
      <SectionCard>
        {editingIdentity ? (
          <div style={{ padding: 14 }}>
            {[["dateOfBirth", "Date of birth"], ["clinicNumber", "Clinic number"], ["address", "Address"], ["nhsNumber", "NHS number"]].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 4 }}>{label}</div>
                <input value={identityDraft[key] ?? ""} onChange={(e) => setIdentityDraft({ ...identityDraft, [key]: e.target.value })}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditingIdentity(false)} style={{ flex: 1, padding: 10, borderRadius: 999, border: `1px solid ${T.border}`, background: "transparent", color: T.textSecondary, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              <button onClick={saveIdentity} style={{ flex: 1, padding: 10, borderRadius: 999, border: "none", background: T.healthcareBlue, color: "#FFFFFF", fontWeight: 700, cursor: "pointer" }}>Save</button>
            </div>
          </div>
        ) : (
          <div onClick={openIdentityEdit} style={{ cursor: "pointer" }}>
            {profile.dateOfBirth || profile.clinicNumber || profile.address || profile.nhsNumber ? (
              <>
                {profile.dateOfBirth && <Row title="Date of birth" subtitle={profile.dateOfBirth} />}
                {profile.clinicNumber && <Row title="Clinic number" subtitle={profile.clinicNumber} />}
                {profile.address && <Row title="Address" subtitle={profile.address} />}
                {profile.nhsNumber && <Row title="NHS number" subtitle={profile.nhsNumber} />}
              </>
            ) : (
              <EmptyRow>Tap to add date of birth, clinic number, address, or NHS number.</EmptyRow>
            )}
          </div>
        )}
      </SectionCard>

      <SectionHeader>Current medications</SectionHeader>
      <SectionCard>
        {meds.length === 0 ? <EmptyRow>No active medications logged.</EmptyRow> : meds.map((m) => {
          const stock = computeStock(m);
          return <Row key={m.id} title={m.name} subtitle={[m.medicationType, m.route].filter(Boolean).join(" · ")} alert={stock.tracked && stock.needsAction} color={ACCENTS.medication} />;
        })}
      </SectionCard>

      <SectionHeader>Allergies</SectionHeader>
      <SectionCard>
        {profile.allergies.length === 0 ? (
          <EmptyRow>None recorded. Add these under My Profile → Clinical & emergency info.</EmptyRow>
        ) : (
          <div style={{ padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
            {profile.allergies.map((a) => (
              <span key={a} style={{ fontSize: 12, fontWeight: 700, color: T.actionRed, background: `${T.actionRed}1A`, padding: "4px 10px", borderRadius: 999 }}>{a}</span>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionHeader>Vaccinations</SectionHeader>
      <SectionCard>
        {vaccinations.length === 0 ? (
          <EmptyRow>None recorded yet.</EmptyRow>
        ) : vaccinations.slice(0, 6).map((v) => {
          const overdue = overdueVaccinations.some((o) => o.id === v.id);
          return <Row key={v.id} title={v.title || v.vaccine} subtitle={`${v.vaccine || ""}${v.nextDue ? ` · ${overdue ? "overdue since" : "next due"} ${formatRelativeDate(v.nextDue)}` : ""}`} alert={overdue} />;
        })}
      </SectionCard>

      <SectionHeader>Recent STI testing</SectionHeader>
      <SectionCard>
        {recentTests.length === 0 ? <EmptyRow>No tests logged yet.</EmptyRow> : recentTests.map((t) => (
          <Row key={t.id} title={t.title} subtitle={t.subtitle} alert={t.alert} />
        ))}
      </SectionCard>

      <SectionHeader>Current treatment</SectionHeader>
      <SectionCard>
        {currentTreatment.length === 0 ? <EmptyRow>Nothing currently awaiting follow-up.</EmptyRow> : currentTreatment.map((t) => (
          <Row key={t.id} title={t.title} subtitle={t.subtitle} alert />
        ))}
      </SectionCard>

      <SectionHeader>Active symptoms</SectionHeader>
      <SectionCard>
        {activeSymptoms.length === 0 ? (
          <EmptyRow>Nothing active right now.</EmptyRow>
        ) : activeSymptoms.map((s) => (
          <Row key={s.id} title={s.title} subtitle={[nameFrom(SymptomsRegistry, s.symptomId), s.severity, formatRelativeDate(s.dateStarted), s.dateResolved ? `resolved ${formatRelativeDate(s.dateResolved)}` : null].filter(Boolean).join(" · ")} alert={s.severity === "Severe"} />
        ))}
      </SectionCard>

      <SectionHeader>Recent encounters</SectionHeader>
      <SectionCard>
        {recentPartners.length === 0 ? <EmptyRow>No encounters logged yet.</EmptyRow> : recentPartners.map((p) => (
          <Row key={p.id} title={p.title} subtitle={p.subtitle} color={ACCENTS.encounters} />
        ))}
      </SectionCard>

      <SectionHeader>Emergency information</SectionHeader>
      <SectionCard>
        {!profile.emergencyContactName && !profile.emergencyContactPhone && !profile.emergencyNotes ? (
          <EmptyRow>None recorded. Add these under My Profile → Clinical & emergency info.</EmptyRow>
        ) : (
          <>
            {(profile.emergencyContactName || profile.emergencyContactPhone) && (
              <Row title={profile.emergencyContactName || "Emergency contact"} subtitle={profile.emergencyContactPhone} />
            )}
            {profile.emergencyNotes && <Row title={profile.emergencyNotes} />}
          </>
        )}
      </SectionCard>

      <div style={{ height: 24 }} />
    </div>
  );
}
