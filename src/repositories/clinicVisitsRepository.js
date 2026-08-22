// clinicVisitsRepository.js
//
// Real Notion schema (Clinic Visits database, fetched live 19 Aug 2026
// — confirmed 🟢 Fixed as of the 31 Jul 2026 Backend Verification
// Report). Same defensive-default pattern as every repository this
// session, applied from creation.
//
// RELATIONSHIPS — Kane's own instruction applied consistently: "add
// relationships if the module is largely complete and appropriate to
// do so." Testing, Medicines Registry, Symptoms Registry, and Results
// Registry all exist as real modules now, so those four relations are
// REAL and wired here — not stubbed.
//
// CHANGED 19 Aug 2026, real feedback-batch pass — two fields that were
// stubbed pending modules that didn't exist yet are now real, because
// those modules got built earlier THIS SAME SESSION:
// - symptomsDiscussedIds → SymptomLogRepository (dated occurrences,
//   not the Symptoms Registry vocabulary — genuinely different from
//   symptomTypeIds below, see the field's own comment).
// - vaccinationsGivenIds → VaccinationRepository.
// The original backlog note said "fold Vaccination into Medications
// given until Vaccinations exists as its own module" — that
// conditional is now moot, Vaccinations IS its own real module, so
// this wires the real thing instead of the workaround that was only
// ever meant to be temporary.
//
// REMOVED, per Kane's own explicit conclusion during the feedback
// batch: a standalone `resultIds` field, previously a real relation to
// Results Registry. Kane's reasoning, verbatim in spirit: "Results
// should NOT be re-entered here at all — that's a duplicate, belongs
// in Testing only, should link/embed instead." A Clinic Visit's own
// "result" IS whatever its linked Test's real result already is — the
// UI now reads that live through `linkedTestIds` instead of storing a
// second, independently-editable copy that could drift out of sync.
// Flagged OBSOLETE below rather than silently deleted, same standing
// pattern as every other retired field this project (e.g. Medication
// Log's old Next refill date) — old visits that still have this data
// keep it, nothing is lost, it's just no longer read or written by
// the UI.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_clinic_visits";

export const CLINICIAN_OPTIONS = ["Lucy", "Jonathan", "Black doctor male", "Hayley", "Gavin"];
// CHANGED 19 Aug 2026 — REASON_FOR_VISIT_OPTIONS/FOLLOW_UP_TYPE_OPTIONS
// moved into customOptionListsRepository.js (real in-app editable, per
// Kane's ask). Removed here to avoid two sources of truth.
// ADDED 19 Aug 2026 — real feedback batch: an explicit "arrange
// follow-up" concept, distinct from nextReviewDate (which is just a
// date with no stated purpose). This says WHAT KIND of follow-up, the
// date field next to it says WHEN.
// (FOLLOW_UP_TYPE_OPTIONS also moved — see comment above.)

export const DEFAULT_CLINIC_VISIT = {
  title: "",
  date: null,
  location: "",
  // CHANGED 19 Aug 2026 — real feedback batch: "Clinician should be
  // free text, not a fixed list, and not mandatory." Stays a plain
  // string (it already was one) — only the UI changes, from a
  // constrained <select> to a free-text field with suggestion chips
  // drawn from CLINICIAN_OPTIONS plus whatever's actually been typed
  // before. No data-shape change needed here.
  clinician: "",
  reasonForVisit: [],
  // CHANGED 19 Aug 2026 — real feedback batch: rephrased in the UI as
  // an explicit yes/no question rather than a plain toggle with a
  // one-word label — the underlying boolean is unchanged.
  isFutureAppointment: false,
  nextReviewDate: null,
  // ADDED 19 Aug 2026 — pairs with nextReviewDate above: WHAT KIND of
  // follow-up is arranged, not just when. See FOLLOW_UP_TYPE_OPTIONS.
  followUpType: "",
  clinicalNotes: "",
  linkedTestIds: [],       // → TestingRepository, real and wired (two-way — see testingRepository.js)
  medicationsGivenIds: [], // → MedicationRepository, real and wired — meds Kane already tracks (e.g. DoxyPEP given here)
  // ADDED 19 Aug 2026 — real feedback batch: medications given in-clinic
  // that AREN'T in Kane's personal Medication tracker (e.g. a one-off
  // IM antibiotic like Ceftriaxone) — genuinely different from
  // medicationsGivenIds above, which only covers meds Kane already
  // tracks as his own. Each entry: { id, name, notes }. Deliberately
  // NOT forced into MedicationRepository — that repository represents
  // Kane's own ongoing self-administered medications, not incidental
  // clinic-administered treatment.
  adHocMedicationsGiven: [],
  symptomTypeIds: [],      // → SymptomsRegistry (vocabulary tags — "what kinds of symptoms came up"), real and wired
  // CHANGED 19 Aug 2026 — now real, see file header. Genuinely
  // different from symptomTypeIds above: this points at actual dated
  // Symptom Log occurrences ("which specific symptom entries did we
  // discuss"), not the tag vocabulary.
  symptomsDiscussedIds: [],
  // ADDED 19 Aug 2026 — real feedback batch: "flagging this symptom is
  // why I'm here" — which ONE of symptomsDiscussedIds (if any) was the
  // actual reason for the visit, distinct from symptoms merely
  // mentioned/discussed along the way.
  primaryReasonSymptomLogId: "",
  // OBSOLETE 19 Aug 2026 — see file header for the full reasoning.
  // Old visits keep whatever's here; the UI no longer reads or writes
  // it. A linked Test's own real result is what the UI shows instead.
  resultIds: [],
  attachments: [],         // real, wired — same shape/pattern as Testing's
  // CHANGED 19 Aug 2026 — now real, see file header.
  vaccinationsGivenIds: [],
  isArchived: false,
};

function generateAttachmentId() {
  return `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateAdHocMedId() {
  return `adhocmed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
// Exported so the UI can generate a consistent ID when adding an
// ad-hoc medication entry, same pattern already used for attachments.
export { generateAdHocMedId };

let visits = storage.load(STORAGE_KEY, []);
let nextVisitNumber = computeNextVisitNumber(visits);

function computeNextVisitNumber(existing) {
  const numbers = existing.map((v) => {
    const match = /^visit_(\d+)$/.exec(v.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateVisitId() {
  const id = `visit_${String(nextVisitNumber).padStart(3, "0")}`;
  nextVisitNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, visits);
}

export const ClinicVisitsRepository = {
  getAll() {
    return structuredClone(visits.map((v) => ({ ...DEFAULT_CLINIC_VISIT, ...v })));
  },

  getById(id) {
    const found = visits.find((v) => v.id === id);
    return found ? structuredClone({ ...DEFAULT_CLINIC_VISIT, ...found }) : null;
  },

  // Every visit that references a given test — the read side of the
  // two-way Testing↔Clinic Visits link (see testingRepository.js's own
  // getByClinicVisit-equivalent usage in the Testing module's detail
  // view).
  getByLinkedTest(testId) {
    return structuredClone(
      visits.filter((v) => (v.linkedTestIds || []).includes(testId)).map((v) => ({ ...DEFAULT_CLINIC_VISIT, ...v }))
    );
  },

  create(data) {
    const newVisit = {
      ...DEFAULT_CLINIC_VISIT,
      ...data,
      id: generateVisitId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    visits = [...visits, newVisit];
    persist();
    return newVisit;
  },

  update(id, changes) {
    let updated = null;
    visits = visits.map((v) => {
      if (v.id !== id) return v;
      updated = { ...v, ...changes };
      return updated;
    });
    persist();
    return updated ? structuredClone({ ...DEFAULT_CLINIC_VISIT, ...updated }) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  addAttachment(visitId, { title, type, fileDataUrl }) {
    const attachment = {
      id: generateAttachmentId(),
      title: title || "Untitled",
      type: type || "Other",
      date: new Date().toISOString(),
      fileDataUrl: fileDataUrl || "",
    };
    return this.update(visitId, {
      attachments: [...(this.getById(visitId)?.attachments || []), attachment],
    });
  },

  removeAttachment(visitId, attachmentId) {
    const visit = this.getById(visitId);
    if (!visit) return null;
    return this.update(visitId, {
      attachments: visit.attachments.filter((a) => a.id !== attachmentId),
    });
  },

  replaceAll(newVisits) {
    visits = newVisits;
    persist();
  },
};
