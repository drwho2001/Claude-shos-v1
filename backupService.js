// backupService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This is the "download everything as a file" / "load a file back in"
// feature — Doc 5 §7 called this out from the start ("Backup/restore:
// versioned JSON snapshot of the full local dataset"). It doesn't store
// anything itself; it just asks every repository for a full copy of its
// data, bundles it into one file, and — for restore — hands a parsed
// file back to each repository to load in.
//
// This file is the ONLY place that needs to change if a new module
// (Encounters, Testing, etc.) gets added later — add one line to gather
// its data, one line to restore it. Nothing else in the app needs to
// know backup/restore exists.

import { ContactRepository } from "./contactRepository.js";
import { MedicationRepository } from "./medicationRepository.js";
import { LogRepository } from "./logRepository.js";
import { EncounterRepository } from "./encounterRepository.js";
import { KinkRegistry } from "./kinkRegistry.js";
import { ChemsRegistry } from "./chemsRegistry.js";
import { ProtectionRegistry } from "./protectionRegistry.js";
import { SymptomsRegistry } from "./symptomsRegistry.js";
import { LocationsRepository } from "./locationsRepository.js";

// Doc 5 §8: "Every export/backup file stamps: schema version, migration
// version, app version." Schema version bumps only when a backup file's
// own SHAPE changes in a way old code couldn't read (e.g. a field
// renamed) — not every time a new field is added.
const SCHEMA_VERSION = 1;
const APP_VERSION = "0.1.0-prototype";

// Pure data assembly — no browser APIs touched here, so this part is
// fully testable outside a real browser (and was).
export function buildBackup() {
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      contacts: ContactRepository.getAll(),
      medications: MedicationRepository.getAll(),
      logs: LogRepository.getAll(),
      encounters: EncounterRepository.getAll(),
      kinks: KinkRegistry.getAll(),
      chems: ChemsRegistry.getAll(),
      protection: ProtectionRegistry.getAll(),
      symptoms: SymptomsRegistry.getAll(),
      locations: LocationsRepository.getAll(),
    },
  };
}

// Parses and sanity-checks a backup file's text content. Throws a
// plain-language error if the file doesn't look right, rather than
// silently importing garbage or a cryptic JSON parse error.
export function parseBackupFile(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("That file isn't valid — it doesn't look like a SHOS backup.");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.data) {
    throw new Error("That file doesn't look like a SHOS backup file.");
  }
  if (typeof parsed.schemaVersion === "number" && parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error("This backup was made with a newer version of SHOS than this app understands. Update the app before restoring it.");
  }
  return parsed;
}

// Restores a parsed backup — replaces ALL current data with what's in
// the file. Deliberately all-or-nothing per module (no partial merge),
// since merging is a much harder problem (what happens when the same
// contact was edited in both places?) that isn't needed yet for a
// single-device, single-user app.
export function restoreBackup(parsedBackup) {
  const { contacts, medications, logs, encounters, kinks, chems, protection, symptoms, locations } = parsedBackup.data;
  if (Array.isArray(contacts)) ContactRepository.replaceAll(contacts);
  if (Array.isArray(medications)) MedicationRepository.replaceAll(medications);
  if (Array.isArray(logs)) LogRepository.replaceAll(logs);
  if (Array.isArray(encounters)) EncounterRepository.replaceAll(encounters);
  if (Array.isArray(kinks)) KinkRegistry.replaceAll(kinks);
  if (Array.isArray(chems)) ChemsRegistry.replaceAll(chems);
  if (Array.isArray(protection)) ProtectionRegistry.replaceAll(protection);
  if (Array.isArray(symptoms)) SymptomsRegistry.replaceAll(symptoms);
  if (Array.isArray(locations)) LocationsRepository.replaceAll(locations);
}

// ---------------------------------------------------------------------
// Browser-facing helpers — these DO touch browser-only APIs (Blob,
// document, FileReader), so they can't be exercised in a plain Node
// test the way the functions above were. Confirmed logically correct
// by testing buildBackup/parseBackupFile/restoreBackup directly; the
// actual "does a file download, does picking a file work" needs a real
// browser (StackBlitz) to confirm — flagging that plainly rather than
// claiming more than was actually checked.
// ---------------------------------------------------------------------

export function exportBackup() {
  const backup = buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shos-backup-${dateStamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Takes a File object (from an <input type="file"> picker), reads it,
// and restores it. onDone/onError are simple callbacks so the calling
// UI can show a success message or an error without this file needing
// to know anything about React.
export function importBackupFromFile(file, onDone, onError) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseBackupFile(reader.result);
      restoreBackup(parsed);
      onDone?.(parsed);
    } catch (err) {
      onError?.(err);
    }
  };
  reader.onerror = () => onError?.(new Error("Couldn't read that file."));
  reader.readAsText(file);
}
