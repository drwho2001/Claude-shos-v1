// encounterRepository.js
//
// PLAIN-LANGUAGE PURPOSE
// -----------------------
// This is the Encounters module's repository — same shape as
// ContactRepository and MedicationRepository (getAll/getById/create/
// update/archive, opaque human-readable IDs, structuredClone on every
// read so nothing outside this file can mutate stored data directly).
//
// BUILT FROM A FRESH LIVE NOTION FETCH, 18 Aug 2026 — not from any
// cached summary. The live Encounters data source has 21 properties.
//
// RELATION FIELDS — six of them, split into two real groups:
//
// 1. Attendees → Contacts. Contacts module is already built, so this is
//    a REAL link: `attendeeIds` is the one stored fact (an array of
//    contact_XXX ids). Everything Contacts already shows as a Notion
//    rollup — Encounter Count, Average/Highest Enjoyment, Last
//    Interaction — is NOT duplicated onto the contact record. It's
//    computed on read from Encounters, in encounterCalculations.js,
//    the same "store facts, derive state" pattern already used for
//    Medication stock. Contact<->Encounter linking is one-directional
//    in storage (Encounter holds attendeeIds) and two-directional in
//    the UI (both screens can show the relationship).
//
// 2. Location, Kinks Involved, Protection Used, Chems/Alcohol used,
//    Symptoms noted → all point to Notion registries that don't exist
//    as app modules yet. Inlined here as plain text/array fields,
//    exactly the precedent set by the Contacts module (Stated Kinks,
//    Limits, etc. before a Kink Registry module exists).
//
//    "Doxy doses" (→ the real, already-built Medications Log) is
//    DELIBERATELY NOT a field here at all, per Kane's 18 Aug 2026
//    reasoning: DoxyPEP is event-triggered in principle, but in
//    practice it only gets acknowledged/logged alongside his other
//    daily medications — not from within an Encounter record. So this
//    isn't a "not built yet" stub like the others above, it's a "this
//    link isn't the right model" call. `myDoxyPepStatus` (his DoxyPEP
//    coverage/status AT the time of the encounter, a real Notion
//    select field with genuine data) is kept — that's a different,
//    still-relevant fact from the doses-taken relation.
//
// `Time of Day` is a Notion FORMULA (derived from Date) — not a stored
// field here either. See encounterCalculations.js: timeOfDay(date).

import { localStorageAdapter as storage } from "./storageAdapter.js";

const STORAGE_KEY = "shos_encounters";

// ---------------------------------------------------------------------
// Known option sets — copied verbatim from the live Notion select/
// multi-select option lists fetched this session. Not reordered or
// edited; SPAG cleanup, if wanted, is a separate Notion-side pass per
// the project's own standing rule (fix schema issues during a database
// pass, not silently while porting).
// ---------------------------------------------------------------------

export const ENCOUNTER_TYPE_OPTIONS = ["Hookup", "Group", "Date/Chill", "Sauna", "Event", "Other"];

export const MY_POSITION_OPTIONS = [
  "Fingering - giving", "Fingering - receiving", "Oral - giving", "Oral - receiving",
  "Rimming - giving", "Rimming - receiving", "Anal – top", "Anal - bottom",
  "Kissing", "Cuddling", "Groping", "Mutual masturbation", "Kink", "Toys",
];

export const CUM_LOCATION_OPTIONS = [
  "Internal - Mouth", "Internal - Ass", "Internal - Vagina",
  "External - Body/Face", "External - Hand", "Didn't happen",
];

export const MY_ROLE_OPTIONS = ["Vanilla / N/A", "Sub", "Switch", "Dom", "Neither", "Dom, Switch", "N/A"];

export const PREP_COVERAGE_OPTIONS = [
  "Adequate - daily (≥4/week)", "Adequate - Event-based (2-1-1)",
  "Missed dose", "Inadequate/recently started", "Not on PrEP",
];

export const DOXYPEP_STATUS_OPTIONS = [
  "Not indicated", "Indicated - taken", "Indicated - not yet taken",
  "Indicated - missed window", "N/A",
];

export const WOULD_MEET_AGAIN_OPTIONS = ["Fuck YES 💖", "Yes", "If he makes effort", "Maybe", "No"];

// ---------------------------------------------------------------------
// Default shape — single source of truth for "what does an empty
// encounter look like", same role DEFAULT_CONTACT plays for Contacts.
// ---------------------------------------------------------------------

export const DEFAULT_ENCOUNTER = {
  title: "",
  date: "", dateEnd: "", isDateTime: false,
  encounterType: "",
  attendeeIds: [],
  // CHANGED 18 Aug 2026 — Location, Kinks Involved, Protection Used,
  // Chems/Alcohol used, and Symptoms noted now hold REGISTRY IDs, not
  // free text. Locations, Kink Registry, Protection Registry, Chems
  // Registry, and Symptoms Registry are all real, built modules as of
  // this session. `locationId` is singular (was `location`, a string)
  // — Notion's Location relation technically allows several, but every
  // real Type option ("His House", "His Car") reads as inherently one
  // location per encounter; flagged as a deliberate simplification, not
  // an oversight, same as AttendeePicker's single-contact-per-Location
  // choice in locationsRepository.js.
  locationId: "",
  myPosition: [],
  kinksInvolved: [],
  myRole: "",
  whereICame: [],
  whereHeCame: [],
  myDoxyPepStatus: "",
  myPrepCoverage: "",
  chemsAlcoholUsed: [],
  wouldMeetAgain: "",
  protectionUsed: [],
  followUpNeeded: false,
  notes: "",
  enjoymentRating: null,
  symptomsNoted: [],
};

// ---------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------

let seedEncounters = [
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_001",
    title: "Alex — coffee then back to his",
    date: "2026-07-20T19:30:00.000Z",
    isDateTime: true,
    encounterType: "Date/Chill",
    attendeeIds: ["contact_001"],
    myRole: "Switch",
    enjoymentRating: 85,
    wouldMeetAgain: "Yes",
    notes: "Second time meeting up.",
    createdAt: "2026-07-20T21:00:00.000Z",
    isArchived: false,
  },
  {
    ...DEFAULT_ENCOUNTER,
    id: "encounter_002",
    title: "Sauna trip",
    date: "2026-08-02T15:00:00.000Z",
    isDateTime: true,
    encounterType: "Sauna",
    attendeeIds: ["contact_002", "contact_003"],
    myRole: "Dom, Switch",
    enjoymentRating: 70,
    followUpNeeded: false,
    createdAt: "2026-08-02T18:00:00.000Z",
    isArchived: false,
  },
];

// Real startup: load whatever's actually been saved before, same
// pattern as ContactRepository — fall back to seed data only on a
// genuinely first run.
let encounters = storage.load(STORAGE_KEY, seedEncounters);

function persist() {
  storage.save(STORAGE_KEY, encounters);
}

// Same ID-safety approach as ContactRepository: derived from the actual
// IDs present, not array length.
function computeNextEncounterNumber(existingEncounters) {
  const numbers = existingEncounters.map((e) => {
    const match = /^encounter_(\d+)$/.exec(e.id);
    return match ? parseInt(match[1], 10) : 0;
  });
  return (numbers.length ? Math.max(...numbers) : 0) + 1;
}
let nextEncounterNumber = computeNextEncounterNumber(encounters);

function generateEncounterId() {
  const id = `encounter_${String(nextEncounterNumber).padStart(3, "0")}`;
  nextEncounterNumber += 1;
  return id;
}

// ---------------------------------------------------------------------
// The repository itself.
// ---------------------------------------------------------------------

export const EncounterRepository = {
  getAll() {
    return structuredClone(encounters);
  },

  getById(id) {
    const found = encounters.find((e) => e.id === id);
    return found ? structuredClone(found) : null;
  },

  // Every encounter that lists this contact as an attendee — the read
  // side of the Attendees relation. Used by encounterCalculations.js
  // and by the Contact Profile Timeline.
  getByAttendee(contactId) {
    return structuredClone(encounters.filter((e) => e.attendeeIds.includes(contactId)));
  },

  create(data) {
    const newEncounter = {
      ...DEFAULT_ENCOUNTER,
      ...data,
      id: generateEncounterId(),
      createdAt: new Date().toISOString(),
      isArchived: false,
    };
    encounters = [...encounters, newEncounter];
    persist();
    return newEncounter;
  },

  update(id, changes) {
    let updatedEncounter = null;
    encounters = encounters.map((e) => {
      if (e.id !== id) return e;
      updatedEncounter = { ...e, ...changes };
      return updatedEncounter;
    });
    persist();
    return updatedEncounter;
  },

  archive(id) {
    return this.update(id, { isArchived: true });
  },

  unarchive(id) {
    return this.update(id, { isArchived: false });
  },

  // Wholesale replace — used only by backup restore, same contract as
  // ContactRepository.replaceAll.
  replaceAll(newEncounters) {
    encounters = newEncounters;
    nextEncounterNumber = computeNextEncounterNumber(encounters);
    persist();
  },
};
