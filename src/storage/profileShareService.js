// profileShareService.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Turns MyProfileRepository's data into a shareable JSON blob (a file,
// or text Kane can paste/AirDrop/message), and turns a received blob
// back into a brand-new Contact on the receiving person's own SHOS.
//
// Deliberately reuses the exact shape of backupService.js's pattern —
// same schema-version stamping, same "parse defensively, throw a
// plain-language error" approach, same browser-facing export/import
// helpers — but is its OWN file with its OWN type tag, not folded into
// buildBackup()/restoreBackup(). Reasoning: a profile share is ONE
// curated, intentionally-shared record, not a full-dataset snapshot of
// everything Kane has ever logged. Keeping it separate means a backup
// file and a profile-share file can never be confused for each other
// (parseProfileShare rejects anything that isn't specifically a
// profile share), and restoring a real backup can never accidentally
// also touch profile data via the wrong code path.
//
// NOT wired into backupService.js's buildBackup()/restoreBackup() —
// that's a genuine open question (should "restore my backup" also
// restore what MY shareable profile looked like at backup time?) that
// doesn't need answering to ship this feature. Flagging it here rather
// than guessing.

import { MyProfileRepository, DEFAULT_PROFILE } from "../repositories/myProfileRepository.js";
import { ContactRepository } from "../repositories/contactRepository.js";

const SCHEMA_VERSION = 1;
const SHARE_TYPE = "shos_profile_share";

// Pure data assembly — no browser APIs, fully testable in Node.
export function buildProfileShare() {
  const profile = MyProfileRepository.getProfile();
  // Strip updatedAt — it's local bookkeeping, not something meaningful
  // to hand to someone else's app.
  const { updatedAt, ...shareableData } = profile;
  return {
    type: SHARE_TYPE,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: shareableData,
  };
}

// Parses and sanity-checks a received profile-share blob. Throws a
// plain-language error rather than importing garbage.
export function parseProfileShare(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("That doesn't look like a valid SHOS shared profile.");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.data) {
    throw new Error("That doesn't look like a SHOS shared profile.");
  }
  if (parsed.type !== SHARE_TYPE) {
    // backupService.js files carry no `type` field at all but DO carry
    // a `data.contacts` array — that's the tell for "this is actually
    // a full backup, not a shared profile" even on older backup files
    // that predate this check.
    if (Array.isArray(parsed.data.contacts) || Array.isArray(parsed.data.medications)) {
      throw new Error("That file is a SHOS backup, not a shared profile — use Restore Backup instead.");
    }
    throw new Error("That doesn't look like a SHOS shared profile.");
  }
  if (typeof parsed.schemaVersion === "number" && parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error("This profile was shared from a newer version of SHOS than this app understands.");
  }
  return parsed;
}

// Maps a parsed profile share's data onto a Contact-shaped object.
// Deliberately does NOT touch ContactRepository directly here — kept
// as a pure mapping function so it can be tested without a repository
// side-effect, same separation backupService.js uses between
// buildBackup() (pure) and exportBackup() (browser side-effect).
export function mapShareToContactData(parsedShare) {
  const d = { ...DEFAULT_PROFILE, ...parsedShare.data };
  return {
    name: d.displayName || d.nickname || "Shared profile",
    nickname: d.nickname,
    age: d.age,
    ageIsApprox: d.ageIsApprox,
    city: d.city,
    phone: d.phone,
    snapchat: d.snapchat,
    fabguys: d.fabguys,
    fabswingers: d.fabswingers,
    contactableVia: d.contactableVia,
    hosts: d.hosts,
    travels: d.travels,
    availability: d.availability,
    nonAvailabilityRules: d.nonAvailabilityRules,
    readilyAvailable: d.readilyAvailable,
    statedKinks: d.statedKinks,
    limits: d.limits,
    knownChems: d.knownChems,
    bdsmRole: d.bdsmRole,
    sexualPosition: d.sexualPosition,
    length: d.length,
    thickness: d.thickness,
    foreskin: d.foreskin,
    chastityStatus: d.chastityStatus,
    cummer: d.cummer,
    knownPrepDoxy: d.knownPrepDoxy,
    lastTestedDate: d.lastTestedDate,
    // The profile's "about me" note becomes the new Contact's Notes —
    // reasonable default (it's the only note travelling with the
    // share), but it's worth being upfront this merges two conceptually
    // different note fields. Not a relationship note the receiver
    // wrote — it's the sender's own "about me" text landing as the
    // start of the receiver's notes about them.
    notes: d.aboutMeNotes,
    // Everything else (howDidWeMeet, meetAgain, dontMeetAgainReason,
    // relationshipType, linkedContactIds, etc.) is intentionally
    // omitted here — DEFAULT_CONTACT's own defaults fill those in via
    // ContactRepository.create(), exactly as if a human had left them
    // blank on a brand-new contact card.
  };
}

// Creates a real new Contact from a parsed share. This is the one
// function with a repository side-effect in this file.
export function importProfileAsContact(parsedShare) {
  const contactData = mapShareToContactData(parsedShare);
  return ContactRepository.create(contactData);
}

// ---------------------------------------------------------------------
// Browser-facing helpers — same caveat as backupService.js: these
// touch Blob/document/FileReader, so they're confirmed logically
// correct via the pure functions above, but the actual "does a file
// download, does picking a file work" needs a real browser to confirm.
// ---------------------------------------------------------------------

export function exportProfileShare() {
  const share = buildProfileShare();
  const json = JSON.stringify(share, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shos-shared-profile-${dateStamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Takes a File object (from an <input type="file"> picker), reads it,
// imports it as a new Contact. onDone(newContact)/onError(err) let the
// calling UI show a result without this file needing to know React.
export function importProfileShareFromFile(file, onDone, onError) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = parseProfileShare(reader.result);
      const newContact = importProfileAsContact(parsed);
      onDone?.(newContact);
    } catch (err) {
      onError?.(err);
    }
  };
  reader.onerror = () => onError?.(new Error("Couldn't read that file."));
  reader.readAsText(file);
}

// Text-paste variant (no file picker) — useful since the mechanism
// brief called out "some form of exportable file/blob", and a pasted
// JSON blob (from a message/AirDrop-opened text) is a valid form of
// that without requiring a file picker flow on every platform.
export function importProfileShareFromText(jsonText, onDone, onError) {
  try {
    const parsed = parseProfileShare(jsonText);
    const newContact = importProfileAsContact(parsed);
    onDone?.(newContact);
    return newContact;
  } catch (err) {
    onError?.(err);
    return null;
  }
}
