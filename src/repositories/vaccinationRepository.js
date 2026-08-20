// vaccinationRepository.js
//
// Real live Notion schema, fetched fresh this session — 11 fields:
// Vaccination Title, vaccination_id, Vaccine (Hepatitis A/B, HPV, Mpox,
// Gonorrhoea, Other), Reason (Routine/Occupational/High-risk status/
// Booster, multi-select), Dose Number, Date, Provider, Next Due,
// Injection Site (Deltoid/Gluteal/Other), Symptom (relation →
// Symptoms Registry), Clinic Visits (relation). Same defensive-default
// pattern as every repository this session, applied from creation.
//
// RELATIONSHIPS — both real and wired from creation, per Kane's
// standing instruction ("wire every relationship that can now exist").
// Symptom reuses the Symptoms Registry vocabulary exactly as Doc 1
// specifies ("symptom relation reused from Symptoms Registry"), same
// pattern as Encounters/Clinic Visits' own symptom fields. Clinic
// Visits is a real, built module — wired as a genuine relation, stored
// as an array matching Notion's own relation shape.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_vaccinations";

export const VACCINE_OPTIONS = ["Hepatitis A", "Hepatitis B", "HPV", "Mpox", "Gonorrhoea", "Other"];
export const REASON_OPTIONS = ["Routine", "Occupational", "High-risk status", "Booster"];
export const INJECTION_SITE_OPTIONS = ["Deltoid", "Gluteal", "Other"];

export const DEFAULT_VACCINATION = {
  title: "",
  vaccine: "",
  reason: [],
  doseNumber: null,
  date: null,
  provider: "",
  nextDue: null,
  injectionSite: "",
  notes: "",
  symptomIds: [],      // → SymptomsRegistry, real and wired
  clinicVisitIds: [],  // → ClinicVisitsRepository, real and wired
  isArchived: false,
};

let vaccinations = storage.load(STORAGE_KEY, []);
let nextNumber = computeNextNumber(vaccinations);

function computeNextNumber(existing) {
  const numbers = existing.map((v) => {
    const match = /^vaccination_(\d+)$/.exec(v.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateId() {
  const id = `vaccination_${String(nextNumber).padStart(3, "0")}`;
  nextNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, vaccinations);
}

export const VaccinationRepository = {
  getAll() {
    return structuredClone(vaccinations.map((v) => ({ ...DEFAULT_VACCINATION, ...v })));
  },

  getById(id) {
    const found = vaccinations.find((v) => v.id === id);
    return found ? structuredClone({ ...DEFAULT_VACCINATION, ...found }) : null;
  },

  // Real convenience read — same "compute the derived state, don't
  // store it" principle as Testing's investigation-status logic
  // (Follow-up Actioned Date empty = Open). Overdue = Next Due set and
  // in the past.
  getOverdue() {
    const today = new Date().toISOString().slice(0, 10);
    return this.getAll().filter((v) => !v.isArchived && v.nextDue && v.nextDue < today);
  },

  create(data) {
    const newVaccination = {
      ...DEFAULT_VACCINATION,
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    vaccinations = [...vaccinations, newVaccination];
    persist();
    return newVaccination;
  },

  update(id, changes) {
    let updated = null;
    vaccinations = vaccinations.map((v) => {
      if (v.id !== id) return v;
      updated = { ...v, ...changes };
      return updated;
    });
    persist();
    return updated ? structuredClone({ ...DEFAULT_VACCINATION, ...updated }) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  replaceAll(newVaccinations) {
    vaccinations = newVaccinations;
    nextNumber = computeNextNumber(vaccinations);
    persist();
  },
};
