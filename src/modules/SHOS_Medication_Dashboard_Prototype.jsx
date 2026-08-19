import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, AlertTriangle, Check, RefreshCcw, Pill, Search, Settings as SettingsIcon, Settings2, X, Moon, Sun, Trash2, Flame, Send, Clock, MoreVertical, ListChecks, ArrowUp, ArrowDown, Archive, ArchiveRestore } from "lucide-react";
// The dashboard no longer owns its own medication/log data — it reads and
// writes through these two repositories instead. Nothing about how the UI
// looks or behaves changes; this just moves WHERE the facts actually live.
import { MedicationRepository, ROUTE_OPTIONS } from "../repositories/medicationRepository";
import { LogRepository } from "../repositories/logRepository";
import { computeStock, computeAdherence, nextDoseEstimate, isDoseLockedOut, lockoutEndsEstimate } from "../calculations/medicationCalculations";

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
    <div onClick={onClick} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: radius.md, padding: "14px 16px", flex: "1 1 0", minWidth: 0, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 600, color: tint || T.textPrimary }}>{value}</div>
      <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>{label}</div>
      {subtitle && <div style={{ fontSize: 11, color: tint || T.textSecondary, marginTop: 3, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>}
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
  // ADDED 18 Aug 2026 — real feedback: a native `disabled` button blocks
  // the click entirely, so the `title` tooltip explaining the lockout
  // was the ONLY feedback — and title tooltips need hover, which
  // doesn't exist on a touchscreen. Kane's ask: keep it tappable while
  // locked, show a brief message instead of nothing, no confirmation
  // needed. This local flash state does exactly that.
  const [lockFlash, setLockFlash] = useState(false);
  const handleLogTap = () => {
    if (doseLocked) {
      setLockFlash(true);
      setTimeout(() => setLockFlash(false), 1800);
      return;
    }
    onLogDose(med.id);
  };

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

      <div style={{ display: "flex", gap: 8, marginTop: 12, position: "relative" }}>
        <button onClick={handleLogTap}
          style={{ ...btnStyle(T.medsBlue, "outline"), opacity: doseLocked ? 0.5 : 1 }}>
          <Pill size={14} /> {doseLocked ? "Already logged" : "Log dose"}
        </button>
        {stock.tracked && <button onClick={() => onLogRefill(med.id)} style={btnStyle(T.medsBlue, "filled")}><RefreshCcw size={14} /> Log refill</button>}
        {lockFlash && (
          <div style={{ position: "absolute", bottom: "100%", left: 0, right: 0, marginBottom: 6, padding: "6px 10px", background: T.textPrimary, color: T.bg, fontSize: 11, fontWeight: 600, borderRadius: radius.sm, textAlign: "center" }}>
            Locked until {lockoutEndsEstimate(med, lastDose?.date)}
          </div>
        )}
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
          {!confirmVoid && amount > 1 ? <HoldButton onStep={step} dir={-1} style={stepperBtn(T)}>−</HoldButton> : <div style={{ width: 44, height: 44 }} />}
          {/* CHANGED 18 Aug 2026 — real bug Kane flagged: this stayed
              showing the original amount (e.g. "1") even after clicking
              "void it", which doesn't reflect what voiding actually does
              — the entry's effect goes to zero. Now shows 0, disabled,
              struck through, once in confirm-void mode. */}
          <input type="number" inputMode="decimal" value={confirmVoid ? 0 : amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))}
            disabled={confirmVoid}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 600, width: 70, textAlign: "center", color: confirmVoid ? T.actionRed : T.textPrimary, textDecoration: confirmVoid ? "line-through" : "none", border: `1px solid ${T.border}`, borderRadius: radius.sm, background: T.surfaceVariant, padding: "4px 2px" }} />
          {!confirmVoid && <HoldButton onStep={step} dir={1} style={stepperBtn(T)}>+</HoldButton>}
        </div>
        {!confirmVoid && (
          <button onClick={() => onSave(amount)} style={{ ...btnStyle(T.medsBlue, "filled"), width: "100%", padding: 12, marginBottom: 10 }}>Save correction</button>
        )}
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

// ADDED 19 Aug 2026 — for Route, a real gap found in the Notion-vs-app
// audit. No select component existed in this file yet (NumberField/
// ToggleRow cover number/boolean fields only) — this is the plain
// text-field pattern used elsewhere in this sheet, adapted to a
// <select>, same visual language.
function SelectRow({ label, value, onChange, options, T }) {
  return (
    <div style={{ padding: "8px 0" }}>
      <div style={{ fontSize: 13, color: T.textPrimary, marginBottom: 6 }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }}>
        <option value="">—</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function MedicationEditSheet({ med, onSave, onClose, T }) {
  const [form, setForm] = useState({
    name: med.name, dosePerUnit: med.dosePerUnit || "", route: med.route || "",
    usagePattern: med.usagePattern,
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

        {/* REORDERED 19 Aug 2026 — same reasoning as Add medication:
            identity facts before dosing mechanics. */}
        <div style={{ padding: "6px 0 10px" }}>
          <input value={form.dosePerUnit} onChange={(e) => set("dosePerUnit")(e.target.value)} placeholder="Dose per unit, e.g. 245mg"
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <SelectRow T={T} label="Route" value={form.route} onChange={set("route")} options={ROUTE_OPTIONS} />

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
    name: "", dosePerUnit: "", route: "",
    usagePattern: "daily", unitsPerDose: 1, dosesPerDay: 1,
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

        {/* REORDERED 19 Aug 2026 — Dose per unit/Route moved up here,
            right after the name: they're identity facts about WHAT the
            medication is and HOW it's taken, which reads more naturally
            before the dosing-pattern/inventory mechanics below, not
            buried after them. */}
        <div style={{ padding: "6px 0 10px" }}>
          <input value={form.dosePerUnit} onChange={(e) => set("dosePerUnit")(e.target.value)} placeholder="Dose per unit, e.g. 245mg"
            style={{ width: "100%", padding: "10px 12px", borderRadius: radius.sm, border: `1px solid ${T.border}`, background: T.surfaceVariant, color: T.textPrimary, fontFamily: "'Public Sans', sans-serif", fontSize: 13, boxSizing: "border-box" }} />
        </div>
        <SelectRow T={T} label="Route" value={form.route} onChange={set("route")} options={ROUTE_OPTIONS} />

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

export default function MedicationDashboard({ openAddOnMount = false, onConsumedQuickAdd } = {}) {
  const [meds, setMeds] = useState(() => loadMedications());
  // Called after every write to either repository — re-reads both and
  // rebuilds the merged view so the screen reflects what's now actually
  // stored, the same way setMeds always used to trigger a re-render.
  const refreshMeds = () => setMeds(loadMedications());
  const [sheet, setSheet] = useState(null);
  const [correction, setCorrection] = useState(null);
  const [editingMed, setEditingMed] = useState(null);
  const [addingMed, setAddingMed] = useState(false);
  // ADDED 19 Aug 2026 — same Dashboard quick-add pattern as Contacts/
  // Encounters; see SHOS_Contacts_Prototype.jsx for the fuller reasoning.
  useEffect(() => {
    if (openAddOnMount) {
      setAddingMed(true);
      onConsumedQuickAdd?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [justCompleted, setJustCompleted] = useState(null);
  const [dueReminder, setDueReminder] = useState(null);
  const [snoozedUntil, setSnoozedUntil] = useState({});
  const [bulkFlash, setBulkFlash] = useState(false);
  // ADDED 18 Aug 2026 — same "keep it visible, flash instead of nothing"
  // fix as the individual card, applied to the bulk button.
  const [bulkLockFlash, setBulkLockFlash] = useState(false);
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
    if (dueDailyMeds.length === 0) {
      setBulkLockFlash(true);
      setTimeout(() => setBulkLockFlash(false), 1800);
      return;
    }
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

  // CHANGED 18 Aug 2026 — real feedback: the button used to disappear
  // entirely once everything was logged, which is the same "silently
  // vanish instead of showing feedback" pattern flagged for the
  // individual card's own button. Now it stays visible whenever any
  // daily med exists at all (`allDailyMeds`), and `dueDailyMeds` (still
  // computed exactly as before) is what decides whether tapping it logs
  // doses or shows a "locked" flash instead — see logAllDaily() above.
  const allDailyMeds = useMemo(() => activeMeds.filter((m) => m.usagePattern === "daily"), [activeMeds]);
  const dueDailyMeds = useMemo(() => activeMeds.filter((m) => {
    if (m.usagePattern !== "daily") return false;
    const lastDose = [...m.logs].filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return !lastDose || !isDoseLockedOut(m, lastDose.date);
  }), [activeMeds]);

  // For the bulk lock flash message — the earliest unlock time across
  // whichever daily meds are currently locked, so the message is
  // meaningful even when several meds are on different schedules.
  const earliestBulkUnlock = useMemo(() => {
    const locked = allDailyMeds.filter((m) => !dueDailyMeds.includes(m));
    if (locked.length === 0) return null;
    const estimates = locked.map((m) => {
      const lastDose = [...m.logs].filter((l) => l.type === "dose" && !l.voided).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      return lastDose ? lockoutEndsEstimate(m, lastDose.date) : null;
    }).filter(Boolean);
    return estimates[0] || null;
  }, [allDailyMeds, dueDailyMeds]);

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

        <div style={{ display: "flex", gap: 10, padding: "0 16px 16px" }}>
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
            {allDailyMeds.length > 0 && (
              <div style={{ padding: "0 16px 12px", position: "relative" }}>
                <button onClick={logAllDaily} style={{ ...btnStyle(T.medsBlue, "outline"), width: "100%", padding: 10, opacity: dueDailyMeds.length === 0 ? 0.5 : 1 }}>
                  {bulkFlash ? <><Check size={14} /> Logged all daily meds</> : <><ListChecks size={14} /> {dueDailyMeds.length === 0 ? "All daily meds logged" : "Log all daily meds"}</>}
                </button>
                <div style={{ fontSize: 11, color: T.textDisabled, textAlign: "center", marginTop: 4 }}>
                  {dueDailyMeds.length > 0 ? `Includes: ${dueDailyMeds.map((m) => m.name.split(" (")[0]).join(", ")}` : "Nothing due right now"}
                </div>
                {bulkLockFlash && (
                  <div style={{ position: "absolute", bottom: "100%", left: 16, right: 16, marginBottom: 6, padding: "6px 10px", background: T.textPrimary, color: T.bg, fontSize: 11, fontWeight: 600, borderRadius: radius.sm, textAlign: "center" }}>
                    Locked{earliestBulkUnlock ? ` until ${earliestBulkUnlock}` : ""}
                  </div>
                )}
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

        {/* CHANGED 18 Aug 2026 — removed this module's own static, non-
            functional bottom bar (it only ever showed "Medication" as
            active, regardless of which module was actually on screen —
            the exact inconsistency Kane flagged: this bar existed here
            but not on Contacts/Activity, so it never persisted across
            switching). The real persistent nav now lives once, in
            App.jsx, shared across every module — its visual design
            (Home/Contacts/Activity/Medication/Healthcare) is exactly
            what this mockup already showed, just made functional. */}
      </div>
    </div>
  );
}
