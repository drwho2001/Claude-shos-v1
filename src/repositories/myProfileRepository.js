// myProfileRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// Stores Kane's OWN shareable profile — the data behind "My Profile /
// Shareable Contact Card". This is NOT a Contact and is NOT stored in
// ContactRepository. It's a singleton (one record, not a list), and it
// deliberately only ever holds fields that are safe to share — there's
// no relationship-specific data (How did we meet, Meet again, Notes)
// to accidentally leak, because this shape never had those fields to
// begin with. That's a deliberate design choice, not an oversight: by
// keeping the profile's OWN storage shape restricted to "about me"
// fields, there's no filtering step at share-time that could be
// forgotten or get out of sync later — the shape itself is the
// guarantee.
//
// Field list resolved 18 Aug 2026 (Development page, Ideas/Future):
// body attributes ARE included; relationship-specific fields are NOT.
// Contact-handle fields (phone/Snapchat/Fabguys/Fabswingers) ARE
// included, same-day follow-up from Kane: "if the platform is filled
// that will be the username/handle" — i.e. this repository holds
// Kane's OWN handles for platforms he chooses to share, same shape as
// the equivalent Contact fields, just about a different person.
//
// Same repository pattern as everywhere else: getProfile()/update()
// return structuredClone copies, storage goes through the shared
// storageAdapter, not localStorage directly.

import { localStorageAdapter as storage } from "../storage/storageAdapter.js";

const STORAGE_KEY = "shos_my_profile";

// Single source of truth for "what does an empty profile look like" —
// mirrors the equivalent subset of DEFAULT_CONTACT field-for-field so
// the two shapes stay easy to eyeball against each other, but this is
// its OWN object, not imported from contactRepository.js. Deliberate:
// importing DEFAULT_CONTACT here would silently pull in every future
// relationship-specific field Contacts ever gains, defeating the whole
// point of this file being a restricted shape.
export const DEFAULT_PROFILE = {
  // Identity — becomes the created Contact's name/nickname on import.
  displayName: "",
  nickname: "",

  // Basics
  age: null,
  ageIsApprox: false,
  city: "",

  // Find me on — matches Contact's own fields field-for-field. Kane's
  // 18 Aug clarification: a filled platform field IS the handle to
  // share (no separate "handle" vs "platform name" split).
  phone: "",
  snapchat: "",
  fabguys: "",
  fabswingers: "",
  contactableVia: [],

  // Hosting / travel
  hosts: "",
  travels: "",

  // Availability
  availability: [],
  nonAvailabilityRules: [],
  readilyAvailable: "",

  // Into / limits / chems
  statedKinks: [],
  limits: [],
  knownChems: [],
  bdsmRole: [],
  sexualPosition: [],

  // Physical
  length: "",
  thickness: "",
  foreskin: "",
  chastityStatus: "",
  cummer: [],

  // Sexual health status — "the actual point of this page" per the
  // existing static Notion template. Manually curated by Kane here,
  // same as the Notion template already was — this repository doesn't
  // pull live from Testing/Medication Log, and nothing about adding
  // this repository changes that; it's just where the manual entry
  // now lives instead of a Notion page.
  knownPrepDoxy: [],
  lastTestedDate: "",

  // Freeform "about me" note — distinct from a Contact's relationship
  // Notes field. This is Kane's own about-me blurb, not a note about
  // someone else.
  aboutMeNotes: "",

  updatedAt: null,
};

let profile = storage.load(STORAGE_KEY, { ...DEFAULT_PROFILE });

function persist() {
  storage.save(STORAGE_KEY, profile);
}

export const MyProfileRepository = {
  // Singleton read — always returns a full shape (missing fields fall
  // back to DEFAULT_PROFILE), so callers never have to null-check.
  getProfile() {
    return structuredClone({ ...DEFAULT_PROFILE, ...profile });
  },

  update(changes) {
    profile = { ...DEFAULT_PROFILE, ...profile, ...changes, updatedAt: new Date().toISOString() };
    persist();
    return structuredClone(profile);
  },

  // Wholesale replace — used only by backup restore (if/when the
  // profile is added to backupService.js — not done yet, see note in
  // profileShareService.js on why it's being kept separate for now).
  replaceAll(newProfile) {
    profile = { ...DEFAULT_PROFILE, ...newProfile };
    persist();
  },
};
