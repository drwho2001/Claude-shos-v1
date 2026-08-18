// medicationRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This file is the ONLY place in the app that knows how a Medication
// (a Medicines Registry entry — e.g. "PrEP", "Vitamin D3") is stored.
// Every screen that needs medication data asks THIS file for it, instead
// of reading/writing some shared array directly. That's what makes it a
// "repository" — it's the filing cabinet; everything else just asks it
// for what it needs and hands back what it wants filed.
//
// This file does NOT know about dose/refill/waste history — that's
// logRepository.js's job. A Medication here is just the registry card
// itself: name, dosing pattern, thresholds, supplier. See Doc 5 §2 for
// why these stay separate ("Registries" vs "Records" in the SHOS model).
//
// This is an in-memory store (a plain JavaScript array) — nothing is
// saved to disk yet. That's intentional: this step is about getting the
// SHAPE of the storage right. A real database swaps in underneath this
// same interface later, without any screen needing to change.
//
// PERSISTENCE, added 17 Aug 2026: medications now survive closing and
// reopening the app, via localStorageAdapter (see storageAdapter.js) —
// the same pattern already proven on ContactRepository. This repository
// still doesn't know or care that it's specifically localStorage
// underneath — it only knows the load(key, fallback) / save(key, value)
// shape. Kept synchronous on purpose, same reasoning as Contacts: no
// async conversion until a genuinely async backend is real, not
// hypothetical.

import { localStorageAdapter as storage } from "./storageAdapter.js";

const STORAGE_KEY = "shos_medications";


// ---------------------------------------------------------------------
// Seed data — the same five medications from the existing prototype's
// `initialMeds`, but with the `logs` array removed (that history now
// lives in logRepository.js instead, linked by medicationId).
// ---------------------------------------------------------------------

let seedMedications = [
  {
    id: "med_001",
    name: "PrEP (Descovy)",
    unit: "tablet",
    usagePattern: "daily",
    dosesPerDay: 1,
    unitsPerDose: 1,
    inventoryTracked: true,
    unitsPerContainer: 30,
    refillThreshold: 7,
    defaultRefillQuantity: 30,
    usualSupplier: "Sexual Health Clinic",
    refillRequestedAt: null,
    isArchived: false,
    sortOrder: 0,
  },
  {
    id: "med_002",
    name: "DoxyPEP (Doxycycline)",
    unit: "capsule",
    usagePattern: "prn",
    dosesPerDay: null,
    unitsPerDose: 2,
    inventoryTracked: true,
    unitsPerContainer: 8,
    refillThreshold: 8,
    defaultRefillQuantity: 8,
    usualSupplier: "Sexual Health Clinic",
    refillRequestedAt: null,
    isArchived: false,
    sortOrder: 1,
  },
  {
    id: "med_003",
    name: "Vitamin D3",
    unit: "tablet",
    usagePattern: "daily",
    dosesPerDay: 1,
    unitsPerDose: 1,
    inventoryTracked: true,
    unitsPerContainer: 90,
    refillThreshold: 10,
    defaultRefillQuantity: 90,
    usualSupplier: "Boots Pharmacy",
    refillRequestedAt: null,
    isArchived: false,
    sortOrder: 2,
  },
  {
    id: "med_004",
    name: "Antihistamine (PRN)",
    unit: "tablet",
    usagePattern: "prn",
    dosesPerDay: null,
    unitsPerDose: 1,
    inventoryTracked: false,
    unitsPerContainer: 20,
    refillThreshold: 5,
    defaultRefillQuantity: 20,
    usualSupplier: "Boots Pharmacy",
    refillRequestedAt: null,
    isArchived: false,
    sortOrder: 3,
  },
  {
    id: "med_005",
    name: "Amoxicillin (course, finished)",
    unit: "capsule",
    usagePattern: "custom",
    dosesPerDay: 3,
    unitsPerDose: 1,
    inventoryTracked: false,
    unitsPerContainer: 21,
    refillThreshold: 0,
    defaultRefillQuantity: 21,
    usualSupplier: "GP Surgery",
    refillRequestedAt: null,
    isArchived: true,
    sortOrder: 4,
  },
];

// Real startup: load whatever's actually been saved before. On a
// genuinely first run (nothing in storage yet), fall back to the seed
// data above so the app isn't empty on day one.
let medications = storage.load(STORAGE_KEY, seedMedications);

// Every mutating method below calls this after changing `medications` —
// same explicit "change, then persist" pattern as ContactRepository.
function persist() {
  storage.save(STORAGE_KEY, medications);
}

// Derived from the actual IDs present, not from medications.length — a
// mixed-up array (e.g. after a manual edit or future import) can't
// produce a duplicate ID. Same fix already applied to ContactRepository.
function computeNextMedicationNumber(existingMedications) {
  const numbers = existingMedications.map((m) => {
    const match = /^med_(\d+)$/.exec(m.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
let nextMedicationNumber = computeNextMedicationNumber(medications);

function generateMedicationId() {
  const id = `med_${String(nextMedicationNumber).padStart(3, "0")}`;
  nextMedicationNumber += 1;
  return id;
}

// ---------------------------------------------------------------------
// The repository itself — this is what the rest of the app talks to.
// ---------------------------------------------------------------------

export const MedicationRepository = {
  // Every medication, active and archived alike. Screens that only want
  // active ones (e.g. the Registry tab) filter on isArchived themselves —
  // the repository just hands back the facts, it doesn't decide what a
  // screen should show.
  getAll() {
    return structuredClone(medications);
  },

  // A single medication by its id, or null if it doesn't exist. Returns
  // a copy, not the live stored object — same reasoning as getAll().
  getById(id) {
    const found = medications.find((m) => m.id === id);
    return found ? structuredClone(found) : null;
  },

  // Creates a new medication. Fills in the id, isArchived, and sortOrder
  // automatically — the caller only supplies the fields a person actually
  // types in on the Add Medication screen.
  create(data) {
    const newMedication = {
      id: generateMedicationId(),
      name: data.name,
      unit: data.unit,
      usagePattern: data.usagePattern,
      dosesPerDay: data.dosesPerDay ?? null,
      unitsPerDose: data.unitsPerDose,
      inventoryTracked: data.inventoryTracked,
      unitsPerContainer: data.unitsPerContainer ?? 0,
      refillThreshold: data.refillThreshold ?? 0,
      defaultRefillQuantity: data.defaultRefillQuantity ?? 0,
      usualSupplier: data.usualSupplier ?? "",
      refillRequestedAt: null,
      isArchived: false,
      sortOrder: medications.length,
    };
    medications = [...medications, newMedication];
    persist();
    return newMedication;
  },

  // Updates any subset of a medication's own fields (registry metadata —
  // name, dosing pattern, thresholds, etc.). Does NOT touch log history;
  // that's a different repository entirely.
  update(id, changes) {
    let updatedMedication = null;
    medications = medications.map((m) => {
      if (m.id !== id) return m;
      updatedMedication = { ...m, ...changes };
      return updatedMedication;
    });
    persist();
    return updatedMedication;
  },

  // Archiving/unarchiving never deletes anything — matches the project's
  // standing "stage, don't auto-delete" rule. Archived medications drop
  // out of Registry/Inventory views but their log history stays intact.
  archive(id) {
    return this.update(id, { isArchived: true });
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  // Moves a medication up or down among ACTIVE medications only —
  // archived ones don't count towards position, matching the existing
  // prototype behavior. direction is the string "up" or "down".
  reorder(id, direction) {
    const step = direction === "up" ? -1 : 1;
    const active = medications
      .filter((m) => !m.isArchived)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const currentIndex = active.findIndex((m) => m.id === id);
    const neighborIndex = currentIndex + step;

    // Nothing to do if the medication isn't found, or it's already at
    // the top/bottom of the active list.
    if (currentIndex === -1 || neighborIndex < 0 || neighborIndex >= active.length) {
      return;
    }

    const current = active[currentIndex];
    const neighbor = active[neighborIndex];
    const currentOrder = current.sortOrder;
    const neighborOrder = neighbor.sortOrder;

    medications = medications.map((m) => {
      if (m.id === current.id) return { ...m, sortOrder: neighborOrder };
      if (m.id === neighbor.id) return { ...m, sortOrder: currentOrder };
      return m;
    });
    persist();
  },

  // Wholesale replace — used only by backup restore. See ContactRepository
  // for the same pattern and reasoning.
  replaceAll(newMedications) {
    medications = newMedications;
    nextMedicationNumber = computeNextMedicationNumber(medications);
    persist();
  },
};
