// testingRepository.js
//
// Real Notion schema (Testing database, fetched live 19 Aug 2026 —
// confirmed 🟢 Fixed as of the 31 Jul 2026 Backend Verification Report,
// no outstanding known issues carried over). Same repository pattern
// as everywhere else this session: getAll()/getById() merge each
// stored record over DEFAULT_TEST before returning, so a field added
// tomorrow is automatically safe for every test logged today — this is
// now the STANDARD pattern from day one for a new module, not something
// bolted on after the fact, per Kane's explicit instruction this
// session ("ensure implemented from start in any new builds").
//
// DELIBERATE SCOPE CUT, per Kane's explicit instruction this session:
// "don't worry about live relationships — add those at the end."
// UPDATE 19 Aug 2026 — Clinic Visits now exists (clinicVisitsRepository.js),
// so clinicVisitIds is real and two-way-linked (see getByLinkedTest() in
// that file, and TestDetail's own display below). relatedSymptomIds
// stays stubbed — Symptoms Tracker still doesn't exist as a module.
import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_tests";

export const SETTING_OPTIONS = ["🏥😎 Clinic - Routine", "🏥🤢 Clinic - Symptomatic", "🏥➕ Clinic - Positive test", "🏠 Home"];
export const SAMPLE_TYPE_OPTIONS = ["Blood", "Urine", "Throat swab", "Rectal swab"];
export const TESTING_FOR_OPTIONS = ["Gonorrhoea", "HIV", "Syphilis", "Chlamydia", "Hepatitis A", "Hepatitis B", "Hepatitis C", "Mpox", "Other", "C&S (treatment)", "MGen"];

export const DEFAULT_TEST = {
  title: "",
  date: null,
  setting: "",
  sampleType: [],
  testingFor: [],
  organismIds: [],       // → OrganismRegistry, real and wired
  resultIds: [],         // → ResultsRegistry, real and wired
  mostRecent: false,
  followUpActionedDate: null,
  trackingInfo: "",
  attachments: [],        // real, wired — see attachment shape below
  // CHANGED 19 Aug 2026 — clinicVisitIds is now REAL, not stubbed.
  // Clinic Visits exists as a module now (see clinicVisitsRepository.js),
  // per Kane's own instruction applied consistently: wire a relationship
  // once both ends genuinely exist and it's appropriate to. relatedSymptomIds
  // stays stubbed — Symptoms Tracker still doesn't exist.
  clinicVisitIds: [],
  relatedSymptomIds: [],
  isArchived: false,
};

// Each attachment: { id, title, type, date, fileDataUrl, linkedItem }.
// Same data-URL approach as Contacts' Profile Picture — no backend
// exists, so this is the only way to keep a file genuinely
// self-contained. Same honest size caveat applies (see
// contactRepository.js's profilePicture comment) — worth knowing, not
// a blocker for the "not actually used to date" scope Kane described.
function generateAttachmentId() {
  return `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

let tests = storage.load(STORAGE_KEY, []);
let nextTestNumber = computeNextTestNumber(tests);

function computeNextTestNumber(existing) {
  const numbers = existing.map((t) => {
    const match = /^test_(\d+)$/.exec(t.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}

function generateTestId() {
  const id = `test_${String(nextTestNumber).padStart(3, "0")}`;
  nextTestNumber += 1;
  return id;
}

function persist() {
  storage.save(STORAGE_KEY, tests);
}

export const TestingRepository = {
  getAll() {
    return structuredClone(tests.map((t) => ({ ...DEFAULT_TEST, ...t })));
  },

  getById(id) {
    const found = tests.find((t) => t.id === id);
    return found ? structuredClone({ ...DEFAULT_TEST, ...found }) : null;
  },

  create(data) {
    const newTest = {
      ...DEFAULT_TEST,
      ...data,
      id: generateTestId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    tests = [...tests, newTest];
    persist();
    return newTest;
  },

  update(id, changes) {
    let updated = null;
    tests = tests.map((t) => {
      if (t.id !== id) return t;
      updated = { ...t, ...changes };
      return updated;
    });
    persist();
    return updated ? structuredClone({ ...DEFAULT_TEST, ...updated }) : null;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  // Attachment helpers — kept here rather than a separate repository
  // file: attachments in this app are always owned by exactly one test
  // (no cross-module Attachments feed exists, unlike Notion's real
  // Attachments database which can link to multiple record types) —
  // matches Kane's "not actually used to date" framing: this is the
  // minimal real version, not the fuller cross-linked one.
  addAttachment(testId, { title, type, fileDataUrl, linkedItem }) {
    const attachment = {
      id: generateAttachmentId(),
      title: title || "Untitled",
      type: type || "Other",
      date: new Date().toISOString(),
      fileDataUrl: fileDataUrl || "",
      linkedItem: linkedItem || "",
    };
    return this.update(testId, {
      attachments: [...(this.getById(testId)?.attachments || []), attachment],
    });
  },

  removeAttachment(testId, attachmentId) {
    const test = this.getById(testId);
    if (!test) return null;
    return this.update(testId, {
      attachments: test.attachments.filter((a) => a.id !== attachmentId),
    });
  },

  replaceAll(newTests) {
    tests = newTests;
    persist();
  },
};
