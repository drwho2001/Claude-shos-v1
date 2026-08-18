import React, { useState, useRef } from "react";
import ContactsModule from "./modules/SHOS_Contacts_Prototype";
import MedicationDashboard from "./modules/SHOS_Medication_Dashboard_Prototype";
import EncountersModule from "./modules/SHOS_Encounters_Prototype";
import MyProfileModule from "./modules/SHOS_MyProfile_Prototype";
import { exportBackup, importBackupFromFile } from "./storage/backupService";

// A basic switcher so you can flip between modules while testing in
// StackBlitz. This isn't meant to be the app's real navigation — Doc 1's
// bottom nav bar is the actual target design — just a fast way to see
// each module working without hand-editing App.jsx every time.
//
// Export/Import backup buttons live here too for now, since there's no
// real Settings screen yet (Doc 5 §7 calls for them to live in Settings
// eventually) — this is a placeholder location, not the final design.
const MODULES = {
  contacts: { label: "Contacts", component: ContactsModule },
  medication: { label: "Medication", component: MedicationDashboard },
  activity: { label: "Activity", component: EncountersModule },
  myProfile: { label: "My Profile", component: MyProfileModule },
};

export default function App() {
  const [active, setActive] = useState("contacts");
  const [status, setStatus] = useState(null);
  const fileInputRef = useRef(null);
  const ActiveModule = MODULES[active].component;

  const handleImportClick = () => fileInputRef.current?.click();
  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importBackupFromFile(
      file,
      () => { setStatus("Backup restored — reload the page to see it everywhere."); window.location.reload(); },
      (err) => setStatus(`Import failed: ${err.message}`)
    );
    e.target.value = ""; // allow re-selecting the same file next time
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F0F0F3" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
        padding: "10px 14px", background: "#1B1B1F", position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(MODULES).map(([key, mod]) => (
            <button
              key={key}
              onClick={() => setActive(key)}
              style={{
                padding: "8px 18px", borderRadius: 999, border: "none", cursor: "pointer",
                fontFamily: "sans-serif", fontSize: 13, fontWeight: 600,
                background: active === key ? "#FFFFFF" : "transparent",
                color: active === key ? "#1B1B1F" : "#F2F2F4",
              }}
            >
              {mod.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={exportBackup}
            style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #3A3A3F", background: "transparent", color: "#F2F2F4", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Export backup
          </button>
          <button onClick={handleImportClick}
            style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #3A3A3F", background: "transparent", color: "#F2F2F4", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Import backup
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChosen} style={{ display: "none" }} />
        </div>
      </div>
      {status && (
        <div style={{ padding: "8px 14px", background: "#FFF4CE", color: "#1B1B1F", fontSize: 12, textAlign: "center" }}>
          {status}
        </div>
      )}
      <ActiveModule />
    </div>
  );
}
