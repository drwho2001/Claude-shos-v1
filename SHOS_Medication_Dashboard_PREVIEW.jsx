import React, { useState, useMemo, useRef } from "react";
import { Plus, AlertTriangle, Check, RefreshCcw, Pill, Search, Home, Users, Activity, HeartPulse, Settings as SettingsIcon, Settings2, X, Moon, Sun, Trash2, Flame, Send, Clock, MoreVertical, ListChecks, ArrowUp, ArrowDown, Archive, ArchiveRestore } from "lucide-react";

// ──────────────────────────────────────────────────────────────────
// PREVIEW BUNDLE — for Claude's in-chat preview only. Memory-only.
// Real source of truth: the separate modular files. Don't edit this
// bundle directly — edit the modular files and regenerate.
// ──────────────────────────────────────────────────────────────────

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

// PREVIEW NOTE: memory-only — Claude's preview can't use localStorage.


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
let medications = seedMedications;

// Every mutating method below calls this after changing `medications` —
// same explicit "change, then persist" pattern as ContactRepository.
function persist() {
  // no-op in Claude's preview
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

const MedicationRepository = {
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


// logRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This file is the ONLY place in the app that knows how individual
// medication log entries (a single "took a dose," "refilled," or
// "wasted/lost" event) are stored. Every screen that needs log history
// — the Medication Card, the Log tab, the Inventory tab, adherence
// calculations — asks THIS file for it.
//
// This file does NOT know anything about a medication's name, dosing
// pattern, or threshold — it only knows a log entry belongs to ONE
// medication, via that medication's id (`medicationId`). That's the
// whole point of splitting this out from medicationRepository.js: this
// file can be searched, filtered, and totalled up without ever touching
// medication metadata, and medicationRepository.js never has to think
// about history at all.
//
// Like medicationRepository.js, this is in-memory only for now — the
// shape is what matters at this step, not where it's physically saved.
//
// PERSISTENCE, added 17 Aug 2026: log entries now survive closing and
// reopening the app, via localStorageAdapter — same pattern as
// ContactRepository and MedicationRepository. One side effect worth
// knowing: the seed data's dates are computed relative to "now" only on
// a genuine first run. Once persisted, they become fixed history like
// any other saved entry — which is correct: a demo dose from "6 days
// ago" shouldn't silently drift to a different date every time the app
// reloads once it's real, saved data.

// PREVIEW NOTE: memory-only simplification, same as above.

// ---------------------------------------------------------------------
// Seed data — flattened from the existing prototype's nested
// `med.logs` arrays. Each entry now carries its own id and the id of
// the medication it belongs to.
//
// Dates are generated relative to "now" (same approach the prototype
// used with its own daysAgo helper) so the seed data always looks
// recent when this file is loaded, rather than hard-coding stale dates.
// ---------------------------------------------------------------------

function daysAgo(n, hour = 9, minute = 30) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

let seedLogs = [
  // PrEP (med_001)
  { id: "log_001", medicationId: "med_001", type: "refill", delta: 30, date: daysAgo(8, 9), voided: false },
  { id: "log_002", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(1, 8), voided: false },
  { id: "log_003", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(2, 8), voided: false },
  { id: "log_004", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(3, 8), voided: false },
  { id: "log_005", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(4, 8), voided: false },
  { id: "log_006", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(5, 8), voided: false },
  { id: "log_007", medicationId: "med_001", type: "dose", delta: -1, date: daysAgo(6, 8), voided: false },

  // DoxyPEP (med_002)
  { id: "log_008", medicationId: "med_002", type: "refill", delta: 16, date: daysAgo(20, 9), voided: false },
  { id: "log_009", medicationId: "med_002", type: "dose", delta: -6, date: daysAgo(5, 22), voided: false },

  // Vitamin D3 (med_003)
  { id: "log_010", medicationId: "med_003", type: "refill", delta: 90, date: daysAgo(60, 9), voided: false },
  { id: "log_011", medicationId: "med_003", type: "dose", delta: -30, date: daysAgo(30, 8), voided: false },
  { id: "log_012", medicationId: "med_003", type: "dose", delta: -14, date: daysAgo(1, 20), voided: false },

  // Antihistamine (med_004)
  { id: "log_013", medicationId: "med_004", type: "dose", delta: -1, date: daysAgo(2, 14), voided: false },

  // Amoxicillin, finished course (med_005)
  { id: "log_014", medicationId: "med_005", type: "dose", delta: -21, date: daysAgo(45, 9), voided: false },
];

// Real startup: load whatever's actually been saved before. On a
// genuinely first run, fall back to the seed data above.
let logs = seedLogs;

function persist() {
  // no-op in Claude's preview
}

// Derived from actual IDs present, not logs.length — same fix already
// applied to Medication and Contact IDs.
function computeNextLogNumber(existingLogs) {
  const numbers = existingLogs.map((l) => {
    const match = /^log_(\d+)$/.exec(l.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
let nextLogNumber = computeNextLogNumber(logs);

function generateLogId() {
  const id = `log_${String(nextLogNumber).padStart(3, "0")}`;
  nextLogNumber += 1;
  return id;
}

// ---------------------------------------------------------------------
// The repository itself.
// ---------------------------------------------------------------------

const LogRepository = {
  // All log entries for one medication — this is what a Medication Card
  // or its stock/adherence calculations would ask for. Includes voided
  // entries; callers that want to exclude them (e.g. stock math) filter
  // on `voided` themselves, same principle as isArchived above.
  getForMedication(medicationId) {
    return structuredClone(logs.filter((l) => l.medicationId === medicationId));
  },

  // Every log entry across every medication — what the cross-medication
  // Log tab feed needs. Returns copies, not the live stored array/objects
  // — same reasoning as every other repository's getAll().
  getAll() {
    return structuredClone(logs);
  },

  // Creates a new log entry (a Dose Taken, Refill, or Waste/Lost event).
  // Fills in id and voided automatically.
  create(data) {
    const newEntry = {
      id: generateLogId(),
      medicationId: data.medicationId,
      type: data.type, // "dose" | "refill" | "waste"
      delta: data.delta, // signed: negative for dose/waste, positive for refill
      date: data.date,
      voided: false,
    };
    logs = [...logs, newEntry];
    persist();
    return newEntry;
  },

  // Corrects an existing entry's amount, date, or type — this is the
  // "edit a mis-logged entry" path (Correction Sheet in the prototype).
  // There's deliberately no 4th "Correction" log type: this just changes
  // the fact that was recorded, and Current Stock re-derives itself
  // automatically next time it's calculated.
  update(id, changes) {
    let updatedEntry = null;
    logs = logs.map((l) => {
      if (l.id !== id) return l;
      updatedEntry = { ...l, ...changes };
      return updatedEntry;
    });
    persist();
    return updatedEntry;
  },

  // Marks an entry as voided rather than deleting it — the entry is kept
  // for history, but excluded from stock/adherence math going forward.
  void(id) {
    return this.update(id, { voided: true });
  },

  // Wholesale replace — used only by backup restore. See ContactRepository
  // for the same pattern and reasoning.
  replaceAll(newLogs) {
    logs = newLogs;
    nextLogNumber = computeNextLogNumber(logs);
    persist();
  },
};


// medicationCalculations.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This file has no memory of its own — it never stores or fetches
// anything. Every function here just takes numbers/data in and returns
// an answer out, the same way a calculator does. That's what makes it
// "pure": call it twice with the same input, get the same answer both
// times, with nothing else in the app affected either way.
//
// This is what Doc 5 means by "store facts, derive state" — Current
// Stock, Adherence, and Next Dose are never saved anywhere. They're
// worked out fresh from the log history every time they're needed.
// That's also why fixing a mis-logged entry (editing or voiding it in
// LogRepository) automatically makes every number here correct again,
// with no special-case "recalculate everything" step required anywhere.
//
// None of the logic below changed during this extraction — it's the
// exact same functions that used to live directly inside the dashboard
// component file, just moved here so they can be reused, tested, or
// reasoned about on their own.

// Days-remaining, dropping to hours/minutes under 1 day — so the display
// keeps counting down meaningfully right as stock actually runs low,
// instead of flooring to "0d remaining" and going silent.
function formatRemaining(daysExact) {
  if (daysExact >= 1) return `${Math.floor(daysExact)}d remaining`;
  const totalMinutes = Math.max(0, Math.round(daysExact * 24 * 60));
  if (totalMinutes >= 60) return `~${Math.round(totalMinutes / 60)}h remaining`;
  return `~${totalMinutes}m remaining`;
}

// Works out a medication's current stock and whether it needs a refill,
// from its log history alone. `med` here is expected to already have its
// `logs` array attached (see loadMedications() in the dashboard file) —
// this function doesn't know or care where those logs actually came from.
function computeStock(med) {
  if (!med.inventoryTracked) return { tracked: false };
  const currentStock = med.logs.filter((l) => !l.voided).reduce((sum, l) => sum + l.delta, 0);
  const needsAction = currentStock <= med.refillThreshold;
  let supplementary;
  if (med.usagePattern === "prn") {
    const dosesRemaining = med.unitsPerDose > 0 ? Math.floor(currentStock / med.unitsPerDose) : null;
    supplementary = `${dosesRemaining} doses left · ${Math.ceil(currentStock / med.unitsPerContainer)} containers`;
  } else {
    const dailyConsumption = med.unitsPerDose * med.dosesPerDay;
    const daysRemainingExact = dailyConsumption > 0 ? currentStock / dailyConsumption : null;
    supplementary = daysRemainingExact !== null ? formatRemaining(daysRemainingExact) : "—";
  }
  const range = med.defaultRefillQuantity || med.refillThreshold || 1;
  const barPct = Math.max(0, Math.min(100, ((currentStock - med.refillThreshold) / range) * 100));
  return { tracked: true, currentStock, needsAction, supplementary, barPct };
}

// Small helper used only by computeAdherence below — how many of the last
// N days had a logged dose.
function windowStats(doseDays, days, today) {
  let expected = 0, hit = 0;
  for (let i = 0; i < days; i++) {
    const day = new Date(today); day.setDate(day.getDate() - i);
    expected += 1;
    if (doseDays.has(day.getTime())) hit += 1;
  }
  return { hit, expected, pct: Math.round((hit / expected) * 100) };
}

// PRN never gets adherence — there's no schedule to measure against, so
// the concept doesn't apply. "Since refill" replaces a fixed 30-day
// window: measured from the most recent Refill log entry, a more
// meaningful baseline than an arbitrary calendar cut.
function computeAdherence(med) {
  if (med.usagePattern === "prn") return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const doseDays = new Set(med.logs.filter((l) => l.type === "dose" && !l.voided).map((l) => { const d = new Date(l.date); d.setHours(0, 0, 0, 0); return d.getTime(); }));

  let streak = 0;
  for (let i = 0; i < 365; i++) { const day = new Date(today); day.setDate(day.getDate() - i); if (doseDays.has(day.getTime())) streak += 1; else break; }

  const sevenDay = windowStats(doseDays, 7, today);

  const lastRefill = [...med.logs].filter((l) => l.type === "refill" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  let sinceRefill;
  if (lastRefill) {
    const refillDay = new Date(lastRefill.date); refillDay.setHours(0, 0, 0, 0);
    const daysSince = Math.max(1, Math.round((today.getTime() - refillDay.getTime()) / 86400000) + 1);
    sinceRefill = windowStats(doseDays, daysSince, today);
  } else {
    sinceRefill = sevenDay;
  }

  return { streak, sevenDay, sinceRefill };
}

// New 18 Aug 2026, per Kane's ask: prevents accidentally logging the
// same daily dose twice in one day. Locked out until 80% of the dosing
// interval has passed since the last dose — for a once-daily medication
// (24h interval), that's ~19.2h, meaning the button unlocks again only
// in roughly the last ~4.8h before the next dose is actually due ("~4h
// early at the earliest", per Kane's own rounding). PRN and Custom
// Schedule medications are never locked — there's no fixed interval to
// measure against for PRN, and Custom Schedule doesn't have a UI to
// build this against yet (Doc 5 §5 already flags Custom Schedule as
// editable-later, not editable-now).
function isDoseLockedOut(med, lastDoseDate) {
  if (!lastDoseDate || med.usagePattern !== "daily" || !med.dosesPerDay) return false;
  const intervalHours = 24 / med.dosesPerDay;
  const hoursSinceLastDose = (Date.now() - new Date(lastDoseDate).getTime()) / 3600000;
  return hoursSinceLastDose < intervalHours * 0.8;
}


// Estimated time until the next dose is due, from the last dose taken and
// the medication's dosing frequency. Returns null for PRN (no schedule)
// or when there's no last dose to count forward from yet.
function nextDoseEstimate(med, lastDoseDate) {
  if (!lastDoseDate || med.usagePattern === "prn" || !med.dosesPerDay) return null;
  const intervalHours = 24 / med.dosesPerDay;
  const next = new Date(new Date(lastDoseDate).getTime() + intervalHours * 3600000);
  const hoursLeft = Math.round((next.getTime() - Date.now()) / 3600000);
  if (hoursLeft <= 0) return "due now";
  if (hoursLeft < 24) return `~${hoursLeft}h`;
  return `~${Math.round(hoursLeft / 24)}d`;
}



// writes through these two repositories instead. Nothing about how the UI
// looks or behaves changes; this just moves WHERE the facts actually live.

const LIGHT = {
  // bg deepened from #FAFAFA — at that value it was nearly indistinguishable from surface (#FFFFFF),
  // so cards read as floating on the same white rather than visibly elevated. surfaceVariant
  // shifted slightly to stay a distinct third tone rather than collapsing into the new bg.
  bg: "#F0F0F3", surface: "#FFFFFF", surfaceVariant: "#E7E7EB", border: "#DCDCE1",
  textPrimary: "#1B1B1F", textSecondary: "#5B5B62", textDisabled: "#9A9AA1",
  medsBlue: "#3D63C9", actionRed: "#E5484D", actionGreen: "#1B9E77",
  // Doc 2's Platforms gold (#E8A400) is tuned as a chip *fill* with dark text — used directly as
  // *text* on a light background it fails contrast (~2.1:1, needs 4.5:1). This is a separate,
  // darker gold specifically for foreground/text use — see Doc 5 §5 note on the Inventory status line.
  goldText: "#8A6100",
  navActive: "#3D63C9", fabBg: "#1B1B1F", fabIcon: "#FFFFFF",
  // Streak badge background — deliberately NOT actionRed/actionGreen
  // (those carry "needs attention" / "just completed" meaning
  // elsewhere). A streak is neither — it's ongoing positive reinforcement,
  // so it gets its own warm amber, purely decorative.
  streakGlow: "#F59E0B26",
};
const DARK = {
  bg: "#121214", surface: "#1C1C1F", surfaceVariant: "#26262A", border: "#3A3A3F",
  textPrimary: "#F2F2F4", textSecondary: "#B8B8BE", textDisabled: "#6E6E74",
  medsBlue: "#5B85F5", actionRed: "#FF7A7E", actionGreen: "#5FD9A4", // was #A9C2FF, too pastel/washed out for button text — richer and still ~4.9:1 against dark surfaces
  goldText: "#FFD666", // dark mode's existing Platforms-gold dark accent already contrasts fine as text here
  navActive: "#A9C2FF", fabBg: "#F2F2F4", fabIcon: "#121214",
  // More saturated than light mode's version, per Kane's specific ask
  // ("dark mode streak... slightly more striking") — light mode wasn't
  // flagged as a problem, so it stays subtle; dark gets more pop.
  streakGlow: "#F59E0B40",
};
const radius = { sm: 8, md: 16, lg: 24, full: 999 };

// Days-remaining, dropping to hours/minutes under 1 day — same idea as the Next Dose estimate,
// applied here to remaining supply instead of dosing interval.
// Stock, adherence, and next-dose math now live in their own file
// (medicationCalculations.js) — this component no longer defines them
// itself, it just asks for the answer.

function formatLastDose(dateStr) {
  if (!dateStr) return "No doses logged";
  const d = new Date(dateStr);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const dayLabel = diffDays <= 0 ? "Today" : diffDays === 1 ? "Yesterday" : `${diffDays}d ago`;
  return `${dayLabel} at ${time}`;
}
function dayLabel(dateStr) {
  const d = new Date(dateStr); const today = new Date();
  const diffDays = Math.floor((today.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Date(dateStr).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
function timeLabel(dateStr) { return new Date(dateStr).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
function daysFromNow(dateStr) {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  return diffDays <= 0 ? "today" : diffDays === 1 ? "yesterday" : `${diffDays}d ago`;
}
// Builds the shape the UI has always expected — a medication with its own
// `logs` array attached — by combining the two repositories. This is now
// the ONLY place those two data sources get stitched together. Every other
// function below still just reads `med.logs` / `med.archived` exactly like
// before, so nothing else in this file had to change.
//
// (`isArchived` from the repository is mapped back to `archived` here,
// purely so none of the existing UI code below needs renaming.)
function loadMedications() {
  return MedicationRepository.getAll().map((med) => ({
    ...med,
    archived: med.isArchived,
    logs: LogRepository.getForMedication(med.id),
  }));
}

function HoldButton({ onStep, dir, children, style }) {
  const timeoutRef = useRef(null);
  const speedRef = useRef(350);
  const activeRef = useRef(false);
  const start = (e) => {
    e.preventDefault();
    if (activeRef.current) return;
    activeRef.current = true;
    onStep(dir);
    speedRef.current = 350;
    const tick = () => { onStep(dir); speedRef.current = Math.max(70, speedRef.current * 0.8); timeoutRef.current = setTimeout(tick, speedRef.current); };
    timeoutRef.current = setTimeout(tick, 550);
  };
  const stop = () => { activeRef.current = false; clearTimeout(timeoutRef.current); };
  return (
    <button onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} style={{ ...style, touchAction: "none" }}>
      {children}
    </button>
  );
}

function StatTile({ label, value, tint, subtitle, onClick, T }) {
  return (
    <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.md, padding: "14px 16px", minWidth: 150, flex: "0 0 auto", cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 600, color: tint || T.textPrimary }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{label}</div>
      {subtitle && <div style={{ fontSize: 11, color: tint || T.textSecondary, marginTop: 3, fontWeight: 600 }}>{subtitle}</div>}
    </div>
  );
}

// Redesigned for more contrast per Kane's ask: tinted background/border, fraction shown as the
// primary value with the percentage as a secondary line, per Kane's "give absolute value" request.
function AdherencePill({ label, hit, expected, T }) {
  const pct = Math.round((hit / expected) * 100);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: T.medsBlue }}>{hit}/{expected}</div>
      <div style={{ fontSize: 10, color: T.textSecondary, fontWeight: 600, marginTop: 1 }}>{label} · {pct}%</div>
    </div>
  );
}

function MedicationCard({ med, onLogDose, onLogRefill, onLogWaste, onMarkRequested, onOpenCorrection, onEditMedication, onMoveUp, onMoveDown, onArchive, isFirst, isLast, justCompleted, T, cardRef, highlighted, menuOpen, onToggleMenu, snoozedUntil }) {
  const stock = computeStock(med);
  const adherence = computeAdherence(med);
  const lastDose = [...med.logs].filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  const requested = !!med.refillRequestedAt;
  const nextDose = lastDose ? nextDoseEstimate(med, lastDose.date) : null;
  const doseLocked = lastDose ? isDoseLockedOut(med, lastDose.date) : false;

  return (
    <div ref={cardRef} style={{ position: "relative", background: T.surface, border: `1px solid ${highlighted ? T.actionRed : T.border}`, borderRadius: radius.md, padding: 16, boxShadow: highlighted ? `0 0 0 3px ${T.actionRed}33` : "0 1px 3px rgba(0,0,0,.06)", transition: "box-shadow 300ms ease, border-color 300ms ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: radius.full, background: T.medsBlue, display: "inline-block" }} />
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 600, fontSize: 15, color: T.textPrimary }}>{med.name}</span>
        </div>
        <MoreVertical size={18} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={() => onToggleMenu(med.id)} />
      </div>

      {menuOpen && (
        <>
          <div onClick={() => onToggleMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
          <div style={{ position: "absolute", top: 40, right: 14, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.sm, boxShadow: "0 4px 16px rgba(0,0,0,.15)", zIndex: 40, minWidth: 190, overflow: "hidden" }}>
            <div onClick={() => { onEditMedication(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Settings2 size={14} color={T.textSecondary} /> Edit medication
            </div>
            {stock.tracked && !requested && (
              <div onClick={() => { onMarkRequested(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                <Send size={14} color={T.textSecondary} /> Request refill early
              </div>
            )}
            {stock.tracked && (
              <div onClick={() => { onLogWaste(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                <Trash2 size={14} color={T.textSecondary} /> Log waste/lost
              </div>
            )}
            <div onClick={() => { onArchive(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
              <Archive size={14} color={T.textSecondary} /> Archive medication
            </div>
            {!isFirst && (
              <div onClick={() => { onMoveUp(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                <ArrowUp size={14} color={T.textSecondary} /> Move up
              </div>
            )}
            {!isLast && (
              <div onClick={() => { onMoveDown(med.id); onToggleMenu(null); }} style={{ padding: "10px 14px", fontSize: 13, color: T.textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${T.border}` }}>
                <ArrowDown size={14} color={T.textSecondary} /> Move down
              </div>
            )}
          </div>
        </>
      )}

      {stock.tracked ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600, color: stock.needsAction && !requested ? T.actionRed : T.textPrimary }}>{stock.currentStock}</span>
            <span style={{ fontSize: 12, color: T.textSecondary }}>{med.unit}s left</span>
          </div>
          <div style={{ height: 4, background: T.surfaceVariant, borderRadius: radius.full, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${stock.barPct}%`, background: stock.needsAction && !requested ? T.actionRed : T.medsBlue, borderRadius: radius.full, transition: "width 200ms ease" }} />
          </div>

          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            {justCompleted === "logged" ? (
              <><Check size={14} color={T.actionGreen} /><span style={{ color: T.actionGreen, fontWeight: 600 }}>Logged</span></>
            ) : justCompleted === "requested" ? (
              <><Check size={14} color={T.medsBlue} /><span style={{ color: T.medsBlue, fontWeight: 600 }}>Marked as requested</span></>
            ) : requested ? (
              <><Clock size={14} color={T.textSecondary} /><span style={{ color: T.textSecondary, fontWeight: 600 }}>Requested {daysFromNow(med.refillRequestedAt)} — awaiting refill</span></>
            ) : stock.needsAction ? (
              <><AlertTriangle size={14} color={T.actionRed} /><span style={{ color: T.actionRed, fontWeight: 600 }}>{stock.currentStock <= 0 ? "Out of stock" : `Refill needed — ≤ ${med.refillThreshold} left`}</span></>
            ) : (
              <span style={{ color: T.textSecondary }}>{stock.supplementary}</span>
            )}
          </div>

          {stock.needsAction && !requested && (
            <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 3 }}>
              {med.usualSupplier && <>Usually filled at: {med.usualSupplier} · </>}
              <span onClick={() => onMarkRequested(med.id)} style={{ color: T.medsBlue, fontWeight: 600, cursor: "pointer" }}>Mark as requested</span>
            </div>
          )}

          <div onClick={() => lastDose && onOpenCorrection(med.id, lastDose)} style={{ fontSize: 12, color: T.textSecondary, marginTop: 6, cursor: lastDose ? "pointer" : "default", width: "fit-content" }}>
            <span style={{ textDecoration: lastDose ? "underline dotted" : "none", textUnderlineOffset: 3 }}>Last dose: {formatLastDose(lastDose?.date)}</span>
            {nextDose && <span> · Next dose {nextDose}</span>}
          </div>
          {snoozedUntil && new Date(snoozedUntil) > new Date() && (
            <div style={{ fontSize: 11, color: T.medsBlue, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><Clock size={11} /> Snoozed until {new Date(snoozedUntil).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
          )}

          {adherence && (
            <div style={{ display: "flex", justifyContent: "space-around", background: `${T.medsBlue}15`, border: `1px solid ${T.medsBlue}40`, borderRadius: radius.sm, padding: "9px 4px", marginTop: 10 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ background: T.streakGlow, borderRadius: radius.full, padding: "3px 10px", display: "inline-flex" }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: T.medsBlue, display: "flex", alignItems: "center", gap: 3, justifyContent: "center" }}><Flame size={13} color={T.actionRed} />{adherence.streak}d</div>
                </div>
                <div style={{ fontSize: 10, color: T.textSecondary, fontWeight: 600, marginTop: 1 }}>streak</div>
              </div>
              <AdherencePill T={T} label="7-day" hit={adherence.sevenDay.hit} expected={adherence.sevenDay.expected} />
              <AdherencePill T={T} label="this refill" hit={adherence.sinceRefill.hit} expected={adherence.sinceRefill.expected} />
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: T.textSecondary }}>
          <span onClick={() => lastDose && onOpenCorrection(med.id, lastDose)} style={{ cursor: lastDose ? "pointer" : "default", textDecoration: lastDose ? "underline dotted" : "none", textUnderlineOffset: 3 }}>
            Last dose: {formatLastDose(lastDose?.date)}
          </span>
          {nextDose && <span> · Next dose {nextDose}</span>}
          <div style={{ fontSize: 11, color: T.textDisabled, fontStyle: "italic", marginTop: 2 }}>Not inventory-tracked</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => !doseLocked && onLogDose(med.id)} disabled={doseLocked}
          style={{ ...btnStyle(T.medsBlue, "outline"), opacity: doseLocked ? 0.5 : 1, cursor: doseLocked ? "default" : "pointer" }}
          title={doseLocked ? "Too early to log again — already logged recently" : undefined}>
          <Pill size={14} /> {doseLocked ? "Already logged" : "Log dose"}
        </button>
        {stock.tracked && <button onClick={() => onLogRefill(med.id)} style={btnStyle(T.medsBlue, "filled")}><RefreshCcw size={14} /> Log refill</button>}
      </div>
    </div>
  );
}

function btnStyle(color, variant) {
  return { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: radius.full, fontFamily: "'Public Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", border: variant === "outline" ? `1px solid ${color}` : "none", background: variant === "filled" ? color : "transparent", color: variant === "filled" ? "#FFFFFF" : color };
}

function QuantitySheet({ med, mode, onConfirm, onClose, T }) {
  const isRefill = mode === "refill";
  const [unitMode, setUnitMode] = useState(med.unitsPerContainer ? "container" : "unit");
  const [amount, setAmount] = useState(1);
  const finalUnits = isRefill && unitMode === "container" ? amount * med.unitsPerContainer : amount;
  const step = (dir) => setAmount((a) => Math.max(1, a + dir));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={onClose}>
      <div style={{ background: T.surface, width: "100%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>{isRefill ? "Log refill" : "Log waste/lost"} — {med.name}</span>
          <X size={18} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        {/* Duplicated from the Registry card, not moved — useful right at the point of logging too */}
        {isRefill && med.usualSupplier && <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 14 }}>Usually filled at: {med.usualSupplier}</div>}
        {isRefill && med.unitsPerContainer && (
          <div style={{ display: "flex", background: T.surfaceVariant, borderRadius: radius.full, padding: 3, marginBottom: 18 }}>
            {["container", "unit"].map((m) => (
              <div key={m} onClick={() => { setUnitMode(m); setAmount(1); }} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: radius.full, cursor: "pointer", fontSize: 13, fontWeight: 600, background: unitMode === m ? T.surface : "transparent", color: unitMode === m ? T.medsBlue : T.textSecondary }}>
                {m === "container" ? "Containers" : "Units"}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 8 }}>
          {amount > 1 ? <HoldButton onStep={step} dir={-1} style={stepperBtn(T)}>−</HoldButton> : <div style={{ width: 44, height: 44 }} />}
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 600, width: 70, textAlign: "center", color: T.textPrimary, border: `1px solid ${T.border}`, borderRadius: radius.sm, background: T.surfaceVariant, padding: "4px 2px" }} />
          <HoldButton onStep={step} dir={1} style={stepperBtn(T)}>+</HoldButton>
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: T.textSecondary, marginBottom: 18 }}>
          {isRefill && unitMode === "container" ? `= ${finalUnits} ${med.unit}s` : "Type a number, or hold either button to speed up"}
        </div>
        <button onClick={() => onConfirm(finalUnits)} style={{ ...btnStyle(isRefill ? T.medsBlue : T.actionRed, "filled"), width: "100%", padding: 12 }}>
          {isRefill ? "Confirm refill" : "Confirm waste/lost"}
        </button>
      </div>
    </div>
  );
}

const stepperBtn = (T) => ({ width: 44, height: 44, borderRadius: radius.full, border: `1px solid ${T.border}`, background: T.surface, fontSize: 20, cursor: "pointer", color: T.medsBlue, userSelect: "none" });

function CorrectionSheet({ med, entry, onSave, onVoid, onClose, T }) {
  const [amount, setAmount] = useState(Math.abs(entry.delta));
  const [confirmVoid, setConfirmVoid] = useState(false);
  const step = (dir) => setAmount((a) => Math.max(1, a + dir));
  const typeLabel = entry.type === "dose" ? "Dose taken" : entry.type === "refill" ? "Refill" : "Waste/lost";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={onClose}>
      <div style={{ background: T.surface, width: "100%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>Edit entry — {med.name}</span>
          <X size={18} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 16 }}>{typeLabel} · {formatLastDose(entry.date)}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 18 }}>
          {amount > 1 ? <HoldButton onStep={step} dir={-1} style={stepperBtn(T)}>−</HoldButton> : <div style={{ width: 44, height: 44 }} />}
          <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 600, width: 70, textAlign: "center", color: T.textPrimary, border: `1px solid ${T.border}`, borderRadius: radius.sm, background: T.surfaceVariant, padding: "4px 2px" }} />
          <HoldButton onStep={step} dir={1} style={stepperBtn(T)}>+</HoldButton>
        </div>
        <button onClick={() => onSave(amount)} style={{ ...btnStyle(T.medsBlue, "filled"), width: "100%", padding: 12, marginBottom: 10 }}>Save correction</button>
        {!confirmVoid ? (
          <div onClick={() => setConfirmVoid(true)} style={{ textAlign: "center", fontSize: 13, color: T.actionRed, fontWeight: 600, cursor: "pointer", padding: 6 }}>This entry was a mistake — void it</div>
        ) : (
          <div style={{ textAlign: "center", padding: 6 }}>
            <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 8 }}>Voided entries are kept, not deleted — same as anywhere else in SHOS.</div>
            <button onClick={onVoid} style={{ ...btnStyle(T.actionRed, "filled"), padding: "8px 20px" }}>Confirm void</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Log tab: grouped by day, and by exact timestamp within a day — entries logged together
// (e.g. via "Log all daily doses") collapse under one time subheading instead of repeating.
//
// CHANGED 18 Aug 2026 (Kane): voided entries used to be filtered out of
// this list entirely — you'd correct/void a mistake and it would just
// vanish, with no record it ever happened. Doc 5 §5 always said voided
// entries are "kept, not deleted", but the Log tab wasn't actually
// honoring that. Now they stay visible with a strikethrough, and a
// toggle lets you hide them if the list gets cluttered — defaults to
// showing them, since "kept" should mean visible by default, not just
// technically-not-deleted. ──
function LogTab({ meds, T, onOpenCorrection }) {
  const [showVoided, setShowVoided] = useState(true);
  const allEntries = meds.flatMap((m) => m.logs.map((l) => ({ ...l, med: m })));
  const anyVoided = allEntries.some((l) => l.voided);
  const rows = (showVoided ? allEntries : allEntries.filter((l) => !l.voided)).sort((a, b) => new Date(b.date) - new Date(a.date));
  // Waste keeps its own red — that's still meaningful for an active
  // entry. Once voided, the strikethrough + dimmed color carries the
  // "this was undone" meaning instead, so voided overrides type color
  // rather than competing with it.
  const typeColor = (r) => (r.voided ? T.textDisabled : r.type === "refill" ? T.medsBlue : r.type === "waste" ? T.actionRed : T.textPrimary);

  const byDay = [];
  rows.forEach((r) => {
    const key = dayLabel(r.date);
    let dayGroup = byDay.find((g) => g.key === key);
    if (!dayGroup) { dayGroup = { key, timeGroups: [] }; byDay.push(dayGroup); }
    let timeGroup = dayGroup.timeGroups.find((g) => g.time === r.date);
    if (!timeGroup) { timeGroup = { time: r.date, entries: [] }; dayGroup.timeGroups.push(timeGroup); }
    timeGroup.entries.push(r);
  });

  const GAP_HOURS = 4; // a bigger visual break for gaps larger than this, within the same day

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "0 16px 100px" }}>
      {anyVoided && (
        <div onClick={() => setShowVoided((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 0 4px", fontSize: 12, color: T.textSecondary, fontWeight: 600 }}>
          {showVoided ? "Hide voided entries" : "Show voided entries"}
        </div>
      )}
      {byDay.map((g, gi) => (
        <div key={g.key}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            marginTop: gi === 0 ? 4 : 24, marginBottom: 8,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.textPrimary, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{g.key}</span>
            <span style={{ flex: 1, height: 1, background: T.border }} />
          </div>
          {g.timeGroups.map((tg, ti) => {
            const prevTime = ti > 0 ? new Date(g.timeGroups[ti - 1].time) : null;
            const gapHours = prevTime ? (prevTime.getTime() - new Date(tg.time).getTime()) / 3600000 : 0;
            const bigGap = gapHours >= GAP_HOURS;
            return (
              <div key={tg.time} style={{ marginBottom: 4, marginTop: bigGap ? 14 : 0, paddingTop: bigGap ? 10 : 0, borderTop: bigGap ? `1px dashed ${T.border}` : "none" }}>
                {tg.entries.length > 1 && (
                  <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 8, marginBottom: 2 }}>{timeLabel(tg.time)} · logged together</div>
                )}
                {tg.entries.map((r, i) => (
                  <div key={i} onClick={() => onOpenCorrection(r.med.id, r)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer", opacity: r.voided ? 0.6 : 1 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: r.voided ? T.textDisabled : T.textPrimary, textDecoration: r.voided ? "line-through" : "none" }}>{r.med.name}</div>
                      {tg.entries.length === 1 && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2 }}>{timeLabel(r.date)}{r.voided ? " · voided" : ""}</div>}
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: typeColor(r), textDecoration: r.voided ? "line-through" : "none" }}>{r.delta > 0 ? "+" : ""}{r.delta}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Inventory tab: cross-medication rollup. "Usually filled at" duplicated here too — natural
// place for it alongside stock levels, without removing it from the Registry card. ──
// Edit affordance duplicated here per Kane's ask — stock/refill-related settings (threshold,
// container size, default refill qty) feel more at home being editable from Inventory too,
// not instead of the Registry card's overflow menu, alongside it.
function InventoryTab({ meds, T, onEditMedication }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "0 16px 100px" }}>
      {meds.map((m) => {
        const s = computeStock(m);
        const requested = !!m.refillRequestedAt;
        return (
          <div key={m.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: radius.full, background: T.medsBlue }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>{m.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, color: s.tracked && s.needsAction && !requested ? T.actionRed : T.textPrimary }}>
                  {s.tracked ? `${s.currentStock} ${m.unit}s` : "—"}
                </span>
                <Settings2 size={15} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={() => onEditMedication(m.id)} />
              </div>
            </div>

            {s.tracked && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, marginLeft: 16, fontSize: 11, fontWeight: 600 }}>
                {requested ? (
                  <><Clock size={11} color={T.goldText} /><span style={{ color: T.goldText }}>Refill requested {daysFromNow(m.refillRequestedAt)}</span></>
                ) : s.needsAction ? (
                  <><AlertTriangle size={11} color={T.actionRed} /><span style={{ color: T.actionRed }}>Refill needed, not yet requested</span></>
                ) : m.usagePattern !== "prn" && m.dosesPerDay > 0 ? (
                  <><Check size={11} color={T.actionGreen} /><span style={{ color: T.actionGreen }}>Refill expected in ~{Math.floor((s.currentStock - m.refillThreshold) / (m.unitsPerDose * m.dosesPerDay))}d</span></>
                ) : (
                  <><Check size={11} color={T.actionGreen} /><span style={{ color: T.actionGreen }}>Not needed yet</span></>
                )}
              </div>
            )}
            {m.usualSupplier && <div style={{ fontSize: 11, color: T.textSecondary, marginTop: 2, marginLeft: 16 }}>Usually filled at: {m.usualSupplier}</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Doc 4 §4b, built: editing the Medicines Registry entry itself — dosesPerDay, unitsPerDose,
// refillThreshold, usualSupplier. This is registry metadata, not a ledger fact — it doesn't
// create a log entry, it changes how future stock/adherence math is computed. ──
function NumberField({ label, value, onChange, min = 0, step = 1, T }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13, color: T.textPrimary }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <HoldButton onStep={(dir) => onChange(Math.max(min, +(value + dir * step).toFixed(2)))} dir={-1} style={{ ...stepperBtn(T), width: 32, height: 32, fontSize: 16 }}>−</HoldButton>
        <input
          type="number" inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value === "" ? 0 : Math.max(min, Number(e.target.value)))}
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 600, width: 44, textAlign: "center", color: T.textPrimary, border: `1px solid ${T.border}`, borderRadius: radius.sm, background: T.surfaceVariant, padding: "3px 2px" }}
        />
        <HoldButton onStep={(dir) => onChange(Math.max(min, +(value + dir * step).toFixed(2)))} dir={1} style={{ ...stepperBtn(T), width: 32, height: 32, fontSize: 16 }}>+</HoldButton>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange, T }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13, color: T.textPrimary }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{ width: 40, height: 24, borderRadius: radius.full, background: value ? T.medsBlue : T.surfaceVariant, position: "relative", cursor: "pointer", transition: "background 150ms ease" }}>
        <div style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 20, height: 20, borderRadius: radius.full, background: "#FFFFFF", transition: "left 150ms ease", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
      </div>
    </div>
  );
}

function MedicationEditSheet({ med, onSave, onClose, T }) {
  const [form, setForm] = useState({
    name: med.name, usagePattern: med.usagePattern,
    dosesPerDay: med.dosesPerDay || 1, unitsPerDose: med.unitsPerDose, refillThreshold: med.refillThreshold,
    unitsPerContainer: med.unitsPerContainer || 0,
    // Default refill qty is edited in containers, stored in units — Kane's ask, matches how
    // people actually think about a refill ("one box"), not a raw unit count.
    defaultRefillContainers: med.unitsPerContainer ? Math.round((med.defaultRefillQuantity || 0) / med.unitsPerContainer) : 1,
    inventoryTracked: med.inventoryTracked, usualSupplier: med.usualSupplier || "",
  });
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const save = () => {
    const { defaultRefillContainers, ...rest } = form;
    onSave({ ...rest, defaultRefillQuantity: defaultRefillContainers * (form.unitsPerContainer || 0) });
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={onClose}>
      <div style={{ background: T.surface, width: "100%", maxHeight: "85vh", overflowY: "auto", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>Edit medication</span>
          <X size={18} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12 }}>Changes how stock/adherence are calculated going forward — doesn't touch past log entries.</div>

        <div style={{ padding: "6px 0 10px" }}>
          <input value={form.name} onChange={(e) => set("name")(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, fontWeight: 600, boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", background: T.surfaceVariant, borderRadius: radius.full, padding: 3, marginBottom: 12 }}>
          {["daily", "prn"].map((p) => (
            <div key={p} onClick={() => set("usagePattern")(p)} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: radius.full, cursor: "pointer", fontSize: 13, fontWeight: 600, background: form.usagePattern === p ? T.surface : "transparent", color: form.usagePattern === p ? T.medsBlue : T.textSecondary }}>
              {p === "daily" ? "Daily" : "PRN"}
            </div>
          ))}
        </div>
        {med.usagePattern === "custom" && form.usagePattern !== "custom" && (
          <div style={{ fontSize: 11, color: T.textDisabled, marginBottom: 10, fontStyle: "italic" }}>Custom Schedule isn't editable here yet — no schedule-builder UI exists. Switching away from it is one-way for now.</div>
        )}

        <ToggleRow T={T} label="Inventory tracked" value={form.inventoryTracked} onChange={set("inventoryTracked")} />
        {form.usagePattern !== "prn" && <NumberField T={T} label="Doses per day" value={form.dosesPerDay} onChange={set("dosesPerDay")} min={1} />}
        <NumberField T={T} label={`Units per dose (${med.unit}s)`} value={form.unitsPerDose} onChange={set("unitsPerDose")} min={1} />
        {form.inventoryTracked && (
          <>
            <NumberField T={T} label={`Units per container (${med.unit}s)`} value={form.unitsPerContainer} onChange={set("unitsPerContainer")} min={0} />
            <NumberField T={T} label={`Refill threshold (${med.unit}s)`} value={form.refillThreshold} onChange={set("refillThreshold")} min={0} />
            <NumberField T={T} label="Default refill qty (containers)" value={form.defaultRefillContainers} onChange={set("defaultRefillContainers")} min={0} />
          </>
        )}

        <div style={{ padding: "10px 0" }}>
          <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>Usual supplier</div>
          <input value={form.usualSupplier} onChange={(e) => set("usualSupplier")(e.target.value)} placeholder="e.g. Boots Pharmacy"
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
        </div>

        <button onClick={save} style={{ ...btnStyle(T.medsBlue, "filled"), width: "100%", padding: 12, marginTop: 12 }}>Save changes</button>
      </div>
    </div>
  );
}

// ── New medication creation — this is what the FAB should have opened all along; it had no
// handler before. Daily/PRN only for now — Custom Schedule exists in the data model (Doc 5 §5)
// but there's no schedule-builder UI yet, so it's not offered here rather than half-supported. ──
function AddMedicationSheet({ onCreate, onClose, T }) {
  const [form, setForm] = useState({
    name: "", usagePattern: "daily", unitsPerDose: 1, dosesPerDay: 1,
    inventoryTracked: true, unitsPerContainer: 30, refillThreshold: 7, defaultRefillContainers: 1, usualSupplier: "",
  });
  const set = (key) => (v) => setForm((f) => ({ ...f, [key]: v }));
  const canCreate = form.name.trim().length > 0;
  const create = () => {
    const { defaultRefillContainers, ...rest } = form;
    onCreate({ ...rest, defaultRefillQuantity: defaultRefillContainers * (form.unitsPerContainer || 0) });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "flex-end", zIndex: 50 }} onClick={onClose}>
      <div style={{ background: T.surface, width: "100%", maxHeight: "85vh", overflowY: "auto", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 600, fontSize: 16, color: T.textPrimary }}>Add medication</span>
          <X size={18} color={T.textSecondary} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        <div style={{ padding: "6px 0 10px" }}>
          <input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Medication name" autoFocus
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        <div style={{ display: "flex", background: T.surfaceVariant, borderRadius: radius.full, padding: 3, marginBottom: 12 }}>
          {["daily", "prn"].map((p) => (
            <div key={p} onClick={() => set("usagePattern")(p)} style={{ flex: 1, textAlign: "center", padding: "6px 0", borderRadius: radius.full, cursor: "pointer", fontSize: 13, fontWeight: 600, background: form.usagePattern === p ? T.surface : "transparent", color: form.usagePattern === p ? T.medsBlue : T.textSecondary }}>
              {p === "daily" ? "Daily" : "PRN"}
            </div>
          ))}
        </div>

        <ToggleRow T={T} label="Inventory tracked" value={form.inventoryTracked} onChange={set("inventoryTracked")} />
        {form.usagePattern !== "prn" && <NumberField T={T} label="Doses per day" value={form.dosesPerDay} onChange={set("dosesPerDay")} min={1} />}
        <NumberField T={T} label="Units per dose" value={form.unitsPerDose} onChange={set("unitsPerDose")} min={1} />
        {form.inventoryTracked && (
          <>
            <NumberField T={T} label="Units per container" value={form.unitsPerContainer} onChange={set("unitsPerContainer")} min={0} />
            <NumberField T={T} label="Refill threshold" value={form.refillThreshold} onChange={set("refillThreshold")} min={0} />
            <NumberField T={T} label="Default refill qty (containers)" value={form.defaultRefillContainers} onChange={set("defaultRefillContainers")} min={0} />
          </>
        )}

        <div style={{ padding: "10px 0" }}>
          <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>Usual supplier</div>
          <input value={form.usualSupplier} onChange={(e) => set("usualSupplier")(e.target.value)} placeholder="e.g. Boots Pharmacy"
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
        </div>

        <button onClick={() => canCreate && create()} style={{ ...btnStyle(canCreate ? T.medsBlue : T.textDisabled, "filled"), width: "100%", padding: 12, marginTop: 8, cursor: canCreate ? "pointer" : "default" }}>
          Add medication
        </button>
      </div>
    </div>
  );
}

function DoseReminderBanner({ med, onTake, onSnooze, onSkip, T }) {
  return (
    <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", width: 358, background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.md, boxShadow: "0 8px 24px rgba(0,0,0,.18)", padding: 16, zIndex: 60 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Pill size={16} color={T.medsBlue} />
        <span style={{ fontFamily: "'Public Sans', sans-serif", fontWeight: 700, fontSize: 14, color: T.textPrimary }}>Time for {med.name}</span>
      </div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginBottom: 12 }}>Demo notification — real delivery needs native scheduling (Doc 5 §9)</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onTake} style={{ ...btnStyle(T.medsBlue, "filled"), padding: "8px 6px" }}>Take</button>
        <button onClick={onSnooze} style={{ ...btnStyle(T.medsBlue, "outline"), padding: "8px 6px" }}>Snooze 30m</button>
        <button onClick={onSkip} style={{ ...btnStyle(T.textSecondary, "outline"), padding: "8px 6px" }}>Skip</button>
      </div>
    </div>
  );
}

export default function MedicationDashboard() {
  const [meds, setMeds] = useState(() => loadMedications());
  // Called after every write to either repository — re-reads both and
  // rebuilds the merged view so the screen reflects what's now actually
  // stored, the same way setMeds always used to trigger a re-render.
  const refreshMeds = () => setMeds(loadMedications());
  const [sheet, setSheet] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [editingMed, setEditingMed] = useState(null);
  const [addingMed, setAddingMed] = useState(false);
  const [justCompleted, setJustCompleted] = useState(null);
  const [dueReminder, setDueReminder] = useState(null);
  const [snoozedUntil, setSnoozedUntil] = useState({});
  const [bulkFlash, setBulkFlash] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const [tab, setTab] = useState("Registry");
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const T = darkMode ? DARK : LIGHT;
  const cardRefs = useRef({});

  const flashComplete = (id, type = "logged") => { setJustCompleted({ id, type }); setTimeout(() => setJustCompleted(null), 2000); };
  const logDose = (id) => {
    const med = MedicationRepository.getById(id);
    if (!med) return;
    LogRepository.create({ medicationId: id, type: "dose", delta: -med.unitsPerDose, date: new Date().toISOString() });
    refreshMeds();
  };

  // Bulk-log — all Daily-pattern medications at once, sharing one timestamp so they group
  // together in the Log tab automatically.
  const logAllDaily = () => {
    const timestamp = new Date().toISOString();
    dueDailyMeds.forEach((m) => LogRepository.create({ medicationId: m.id, type: "dose", delta: -m.unitsPerDose, date: timestamp }));
    refreshMeds();
    setBulkFlash(true);
    setTimeout(() => setBulkFlash(false), 2000);
  };

  const logQuantity = (units) => {
    const isRefill = sheet.mode === "refill";
    const delta = isRefill ? units : -units;
    const type = isRefill ? "refill" : "waste";
    LogRepository.create({ medicationId: sheet.med.id, type, delta, date: new Date().toISOString() });
    // Logging a real refill clears any pending "requested" flag — matches
    // the original behavior, which only cleared it on the refill branch.
    if (isRefill) MedicationRepository.update(sheet.med.id, { refillRequestedAt: null });
    refreshMeds();
    flashComplete(sheet.med.id);
    setSheet(null);
  };
  const markRequested = (id) => {
    MedicationRepository.update(id, { refillRequestedAt: new Date().toISOString() });
    refreshMeds();
    flashComplete(id, "requested");
  };
  const saveCorrection = (newAmount) => {
    const sign = correction.entry.delta < 0 ? -1 : 1;
    LogRepository.update(correction.entry.id, { delta: sign * newAmount });
    refreshMeds();
    setCorrection(null);
  };
  const voidCorrection = () => {
    LogRepository.void(correction.entry.id);
    refreshMeds();
    setCorrection(null);
  };
  const saveMedication = (form) => {
    MedicationRepository.update(editingMed.id, form);
    refreshMeds();
    setEditingMed(null);
  };
  const createMedication = (form) => {
    // MedicationRepository.create assigns the real id (med_006, med_007, ...)
    // — no more `med_${Date.now()}`, matching the project's standing rule
    // that ids are opaque and sequential, never timestamp- or name-derived.
    const newMed = MedicationRepository.create({
      name: form.name.trim(), unit: "unit",
      usagePattern: form.usagePattern, unitsPerDose: form.unitsPerDose, dosesPerDay: form.dosesPerDay,
      unitsPerContainer: form.unitsPerContainer, refillThreshold: form.refillThreshold, defaultRefillQuantity: form.defaultRefillQuantity,
      inventoryTracked: form.inventoryTracked, usualSupplier: form.usualSupplier,
    });
    // Initial stock is just the first Refill-type log entry (Doc 5 §5) —
    // no separate Opening Stock field, same rule as everywhere else.
    if (form.inventoryTracked) {
      LogRepository.create({ medicationId: newMed.id, type: "refill", delta: form.defaultRefillQuantity || 0, date: new Date().toISOString() });
    }
    refreshMeds();
    setAddingMed(false);
  };

  // Manual reordering — a medication's position in Registry is its priority, user-controlled
  // rather than auto-sorted. Simple move up/down rather than full drag-and-drop, for reliability.
  // The active-only, archived-meds-don't-count logic now lives inside
  // MedicationRepository.reorder itself (it owns sortOrder), so this is
  // just a thin translation from the UI's -1/+1 direction to "up"/"down".
  const moveMedication = (id, dir) => {
    MedicationRepository.reorder(id, dir < 0 ? "up" : "down");
    refreshMeds();
  };

  // Archive/retire — for a finished acute course you might need again (Kane's example), not a
  // permanent delete. History (Log tab) stays visible regardless; only Registry/Inventory hide it.
  const archiveMedication = (id) => { MedicationRepository.archive(id); refreshMeds(); };
  const unarchiveMedication = (id) => { MedicationRepository.unarchive(id); refreshMeds(); };

  const takeReminder = () => { logDose(dueReminder.id); flashComplete(dueReminder.id, "logged"); setDueReminder(null); };
  const snoozeReminder = () => { setSnoozedUntil((prev) => ({ ...prev, [dueReminder.id]: new Date(Date.now() + 30 * 60000).toISOString() })); setDueReminder(null); };
  const skipReminder = () => setDueReminder(null);

  // BUG FIX (18 Aug 2026): this only filtered before, never sorted — so
  // MedicationRepository.reorder() was correctly swapping sortOrder
  // values the whole time, but nothing ever read that field to decide
  // display order. The list just showed creation order regardless of
  // how many times Move up/down was clicked. Sorting by sortOrder here
  // is the actual fix — reorder() itself was already correct.
  const activeMeds = useMemo(() => meds.filter((m) => !m.archived).sort((a, b) => a.sortOrder - b.sortOrder), [meds]);
  const archivedMeds = useMemo(() => meds.filter((m) => m.archived), [meds]);
  const needsActionMeds = useMemo(() => activeMeds.filter((m) => { const s = computeStock(m); return s.tracked && s.needsAction && !m.refillRequestedAt; }), [activeMeds]);

  // Which daily meds are actually due right now (i.e. not locked out) —
  // "Log all daily meds" only touches these, and the transparency line
  // (Doc 4 §4a) reflects exactly this set, not every daily medication
  // that exists. If everything's already logged, the button disappears
  // entirely rather than sitting there enabled with nothing to do.
  const dueDailyMeds = useMemo(() => activeMeds.filter((m) => {
    if (m.usagePattern !== "daily") return false;
    const lastDose = [...m.logs].filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return !lastDose || !isDoseLockedOut(m, lastDose.date);
  }), [activeMeds]);

  const scrollToProblem = () => {
    if (tab !== "Registry") setTab("Registry");
    if (needsActionMeds.length === 0) return;
    const target = needsActionMeds[0];
    setTimeout(() => {
      cardRefs.current[target.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(target.id);
      setTimeout(() => setHighlightedId(null), 1600);
    }, 50);
  };

  return (
    <div style={{ fontFamily: "'Public Sans', sans-serif", background: T.bg, minHeight: "100vh", display: "flex", justifyContent: "center", transition: "background 200ms ease" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');`}</style>
      <div style={{ width: 390, background: T.bg, minHeight: "100vh", display: "flex", flexDirection: "column", borderLeft: `1px solid ${T.border}`, borderRight: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 16px 12px" }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary }}>Medication</span>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div onClick={() => setDarkMode((d) => !d)} style={{ cursor: "pointer" }}>{darkMode ? <Sun size={20} color={T.textSecondary} /> : <Moon size={20} color={T.textSecondary} />}</div>
            <Search size={20} color={T.textSecondary} />
            {/* Settings moved here per Kane's ask — canonical home is Home's top bar (shown here too since
                that's the only screen built). Same honesty note as Search: no handler yet, visual only. */}
            <SettingsIcon size={20} color={T.textSecondary} />
          </div>
        </div>

        <div onClick={() => setDueReminder(meds.find((m) => m.usagePattern !== "prn"))} style={{ margin: "0 16px 12px", fontSize: 11, color: T.textDisabled, cursor: "pointer", textAlign: "center", border: `1px dashed ${T.border}`, borderRadius: radius.sm, padding: 6 }}>
          Demo: simulate a due-dose notification
        </div>

        <div style={{ display: "flex", gap: 10, padding: "0 16px 16px", overflowX: "auto" }}>
          <StatTile T={T} label="Active medications" value={activeMeds.length} tint={T.medsBlue} />
          <StatTile T={T} label="Needs action" value={needsActionMeds.length} tint={needsActionMeds.length > 0 ? T.actionRed : T.textPrimary}
            subtitle={needsActionMeds.length > 0 ? needsActionMeds.map((m) => m.name.split(" (")[0]).join(", ") : null}
            onClick={needsActionMeds.length > 0 ? scrollToProblem : undefined} />
        </div>

        <div style={{ display: "flex", gap: 20, padding: "0 16px", borderBottom: `1px solid ${T.border}`, marginBottom: 16 }}>
          {["Registry", "Log", "Inventory"].map((t) => (
            <div key={t} onClick={() => setTab(t)} style={{ paddingBottom: 10, fontSize: 14, fontWeight: 600, color: tab === t ? T.medsBlue : T.textSecondary, borderBottom: tab === t ? `2px solid ${T.medsBlue}` : "2px solid transparent", cursor: "pointer" }}>{t}</div>
          ))}
        </div>

        {tab === "Registry" && (
          <>
            {dueDailyMeds.length > 0 && (
              <div style={{ padding: "0 16px 12px" }}>
                <button onClick={logAllDaily} style={{ ...btnStyle(T.medsBlue, "outline"), width: "100%", padding: 10 }}>
                  {bulkFlash ? <><Check size={14} /> Logged all daily meds</> : <><ListChecks size={14} /> Log all daily meds</>}
                </button>
                <div style={{ fontSize: 11, color: T.textDisabled, textAlign: "center", marginTop: 4 }}>
                  Includes: {dueDailyMeds.map((m) => m.name.split(" (")[0]).join(", ")}
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px 100px" }}>
              {activeMeds.map((med, idx) => (
                <MedicationCard key={med.id} med={med} T={T} justCompleted={justCompleted?.id === med.id ? justCompleted.type : null} highlighted={highlightedId === med.id}
                  cardRef={(el) => (cardRefs.current[med.id] = el)}
                  menuOpen={menuOpenId === med.id}
                  snoozedUntil={snoozedUntil[med.id]}
                  isFirst={idx === 0}
                  isLast={idx === activeMeds.length - 1}
                  onMoveUp={(id) => moveMedication(id, -1)}
                  onMoveDown={(id) => moveMedication(id, 1)}
                  onArchive={archiveMedication}
                  onToggleMenu={(id) => setMenuOpenId((cur) => (cur === id ? null : id))}
                  onLogDose={logDose}
                  onLogRefill={(id) => setSheet({ med: meds.find((m) => m.id === id), mode: "refill" })}
                  onLogWaste={(id) => setSheet({ med: meds.find((m) => m.id === id), mode: "waste" })}
                  onMarkRequested={markRequested}
                  onOpenCorrection={(id, entry) => setCorrection({ med: meds.find((m) => m.id === id), entry })}
                  onEditMedication={(id) => setEditingMed(meds.find((m) => m.id === id))}
                />
              ))}

              {archivedMeds.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div onClick={() => setShowArchived((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "8px 0", fontSize: 13, color: T.textSecondary, fontWeight: 600 }}>
                    <Archive size={14} /> {showArchived ? "Hide" : "Show"} archived ({archivedMeds.length})
                  </div>
                  {showArchived && archivedMeds.map((med) => (
                    <div key={med.id} style={{ background: T.surfaceVariant, border: `1px solid ${T.border}`, borderRadius: radius.md, padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.textSecondary }}>{med.name}</div>
                        <div style={{ fontSize: 11, color: T.textDisabled, marginTop: 2 }}>Archived — history kept in Log tab</div>
                      </div>
                      <div onClick={() => unarchiveMedication(med.id)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: T.medsBlue, cursor: "pointer" }}>
                        <ArchiveRestore size={14} /> Restore
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {tab === "Log" && <LogTab meds={meds} T={T} onOpenCorrection={(id, entry) => setCorrection({ med: meds.find((m) => m.id === id), entry })} />}
        {tab === "Inventory" && <InventoryTab meds={activeMeds} T={T} onEditMedication={(id) => setEditingMed(meds.find((m) => m.id === id))} />}

        {sheet && <QuantitySheet med={sheet.med} mode={sheet.mode} onConfirm={logQuantity} onClose={() => setSheet(null)} T={T} />}
        {correction && <CorrectionSheet med={correction.med} entry={correction.entry} onSave={saveCorrection} onVoid={voidCorrection} onClose={() => setCorrection(null)} T={T} />}
        {editingMed && <MedicationEditSheet med={editingMed} onSave={saveMedication} onClose={() => setEditingMed(null)} T={T} />}
        {addingMed && <AddMedicationSheet onCreate={createMedication} onClose={() => setAddingMed(false)} T={T} />}
        {dueReminder && <DoseReminderBanner med={dueReminder} onTake={takeReminder} onSnooze={snoozeReminder} onSkip={skipReminder} T={T} />}

        <div style={{ position: "fixed", bottom: 76, width: 390, display: "flex", justifyContent: "flex-end", padding: "0 20px", pointerEvents: "none" }}>
          <div onClick={() => setAddingMed(true)} style={{ width: 56, height: 56, borderRadius: radius.full, background: T.fabBg, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "auto", boxShadow: "0 2px 8px rgba(0,0,0,.25)", cursor: "pointer" }}><Plus size={24} color={T.fabIcon} /></div>
        </div>

        <div style={{ position: "fixed", bottom: 0, width: 390, background: T.surface, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-around", padding: "10px 0 14px" }}>
          {[{ icon: Home, label: "Home" }, { icon: Users, label: "Contacts" }, { icon: Activity, label: "Activity" }, { icon: Pill, label: "Medication", active: true }, { icon: HeartPulse, label: "Healthcare" }].map(({ icon: Icon, label, active }) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <Icon size={22} color={active ? T.navActive : T.textDisabled} strokeWidth={active ? 2.5 : 2} />
              <span style={{ fontSize: 10, color: active ? T.navActive : T.textDisabled, fontWeight: active ? 600 : 400 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
