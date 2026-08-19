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
// REAL and wired here — not stubbed. Symptoms Tracker and Vaccinations
// still don't exist as app modules, so "Symptoms discussed" and
// "Vaccinations given" stay reserved-but-unwired, same reasoning as
// Testing's own stub fields.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_clinic_visits";

export const CLINICIAN_OPTIONS = ["Lucy", "Jonathan", "Black doctor male", "Hayley", "Gavin"];
export const REASON_FOR_VISIT_OPTIONS = ["Symptoms", "Doxy refill", "Routine screening", "PrEP review", "Vaccination", "Treatment", "Other"];

export const DEFAULT_CLINIC_VISIT = {
  title: "",
  date: null,
  clinician: "",
  reasonForVisit: [],
  clinicalNotes: "",
  isFutureAppointment: false,
  nextReviewDate: null,
  linkedTestIds: [],       // → TestingRepository, real and wired (two-way — see testingRepository.js)
  medicationsGivenIds: [], // → MedicationRepository, real and wired
  symptomTypeIds: [],      // → SymptomsRegistry, real and wired
  resultIds: [],           // → ResultsRegistry, real and wired
  attachments: [],         // real, wired — same shape/pattern as Testing's
  // STUBBED — reserved shape only, no UI yet. Symptoms Tracker and
  // Vaccinations don't exist as app modules.
  symptomsDiscussedIds: [],
  vaccinationsGivenIds: [],
  isArchived: false,
};

function generateAttachmentId() {
  return `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

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
