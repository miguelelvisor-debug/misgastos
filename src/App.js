import { useState, useEffect, useCallback } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
} from "firebase/auth";
import {
  collection, doc, setDoc, addDoc, getDocs, onSnapshot,
  query, where, updateDoc, arrayUnion, serverTimestamp, orderBy, deleteDoc
} from "firebase/firestore";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const CATS = [
  { id: "super", label: "Super",       icon: "🛒" },
  { id: "casa",  label: "Casa",        icon: "🏠" },
  { id: "ocio",  label: "Ocio",        icon: "🎬" },
  { id: "trans", label: "Transporte",  icon: "🚗" },
  { id: "salud", label: "Salud",       icon: "💊" },
  { id: "ropa",  label: "Ropa",        icon: "👕" },
  { id: "rest",  label: "Restaurante", icon: "🍽️" },
  { id: "otro",  label: "Otro",        icon: "📦" },
];

const C = {
  bg:     "#f9f9f7",
  white:  "#ffffff",
  black:  "#111111",
  muted:  "#999999",
  border: "#e8e8e4",
  accent: "#111111",
  green:  "#16a34a",
  red:    "#dc2626",
  tag:    "#f0f0ec",
};

function uid8() { return Math.random().toString(36).slice(2, 10).toUpperCase(); }
function fmt(n) { return Number(n).toFixed(2).replace(".", ",") + " €"; }
function monthLabel(d) { return new Date(d).toLocaleDateString("es-ES", { month: "long", year: "numeric" }); }
function isBlocked(e) {
  return e?.message?.includes("ERR_BLOCKED") || e?.message?.includes("Failed to fetch") ||
    e?.code === "unavailable" || e?.message?.toLowerCase().includes("blocked");
}

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const S = {
  page:    { minHeight: "100dvh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif", color: C.black },
  center:  { minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px" },
  wrap:    { maxWidth: "440px", margin: "0 auto", padding: "0 20px 120px" },
  header:  { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "max(env(safe-area-inset-top),24px)", paddingBottom: "20px" },

  label:   { fontSize: "11px", fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: "6px" },
  input:   { width: "100%", padding: "13px 14px", borderRadius: "10px", border: `1.5px solid ${C.border}`, background: C.white, color: C.black, fontFamily: "inherit", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "12px", transition: "border-color 0.15s" },
  btn:     { width: "100%", padding: "14px", borderRadius: "10px", border: "none", background: C.black, color: C.white, fontFamily: "inherit", fontWeight: 600, fontSize: "15px", cursor: "pointer", marginTop: "8px" },
  btnSm:   { padding: "9px 16px", borderRadius: "8px", border: `1.5px solid ${C.border}`, background: "transparent", color: C.black, fontFamily: "inherit", fontWeight: 500, fontSize: "13px", cursor: "pointer" },
  btnGhost:{ padding: "9px 16px", borderRadius: "8px", border: "none", background: C.tag, color: C.black, fontFamily: "inherit", fontWeight: 500, fontSize: "13px", cursor: "pointer" },
  err:     { color: C.red, fontSize: "13px", marginBottom: "10px", fontWeight: 500 },

  card:    { background: C.white, borderRadius: "14px", border: `1px solid ${C.border}`, padding: "16px 18px", marginBottom: "10px", cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 20, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(2px)" },
  sheet:   { background: C.white, borderRadius: "20px 20px 0 0", width: "100%", maxWidth: "440px", padding: "20px 20px", paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))", maxHeight: "90dvh", overflowY: "auto" },
  handle:  { width: "32px", height: "3px", borderRadius: "3px", background: C.border, margin: "0 auto 20px" },
  divider: { height: "1px", background: C.border, margin: "16px 0" },
  fab:     { position: "fixed", bottom: "max(28px, env(safe-area-inset-bottom, 28px))", right: "20px", width: "52px", height: "52px", borderRadius: "50%", background: C.black, border: "none", color: C.white, fontSize: "24px", cursor: "pointer", zIndex: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center" },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function Input({ label, ...p }) {
  return <div><label style={S.label}>{label}</label><input style={S.input} {...p} /></div>;
}

function Pill({ children, active, onClick }) {
  return (
    <span onClick={onClick} style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${active ? C.black : C.border}`, background: active ? C.black : "transparent", color: active ? C.white : C.muted, marginRight: "6px", marginBottom: "6px" }}>
      {children}
    </span>
  );
}

function Spinner() {
  return <div style={{ ...S.center, background: C.bg }}><div style={{ width: "24px", height: "24px", borderRadius: "50%", border: `2px solid ${C.border}`, borderTopColor: C.black, animation: "spin 0.7s linear infinite" }} /></div>;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  // Convert username → internal fake email (never shown to user)
  const toEmail = (u) => `${u.trim().toLowerCase().replace(/[^a-z0-9_]/g, "")}@misgastos.app`;

  const submit = async () => {
    setErr(""); 
    const uTrim = username.trim();
    if (!uTrim) { setErr("Escribe un nombre de usuario"); return; }
    if (uTrim.length < 3) { setErr("Mínimo 3 caracteres"); return; }
    if (pass.length < 6) { setErr("La contraseña necesita al menos 6 caracteres"); return; }
    setLoading(true);
    const fakeEmail = toEmail(uTrim);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
        await updateProfile(cred.user, { displayName: uTrim });
        await setDoc(doc(db, "users", cred.user.uid), { name: uTrim, username: uTrim, uid: cred.user.uid, createdAt: serverTimestamp() });
      } else {
        await signInWithEmailAndPassword(auth, fakeEmail, pass);
      }
    } catch (e) {
      if (isBlocked(e)) { setErr("Adblock detectado — desactívalo para este sitio y recarga."); }
      else {
        const m = {
          "auth/email-already-in-use": "Ese usuario ya existe",
          "auth/wrong-password": "Contraseña incorrecta",
          "auth/user-not-found": "Usuario no encontrado",
          "auth/invalid-credential": "Usuario o contraseña incorrectos",
          "auth/weak-password": "Mínimo 6 caracteres",
        };
        setErr(m[e.code] || "Error al conectar");
      }
    }
    setLoading(false);
  };

  return (
    <div style={S.page}>
      <div style={S.center}>
        <div style={{ width: "100%", maxWidth: "360px" }}>
          <div style={{ marginBottom: "32px", display: "flex", alignItems: "center", gap: "14px" }}>
            {/* Logo D — dos monedas superpuestas */}
            <div style={{ position: "relative", width: "52px", height: "52px", flexShrink: 0 }}>
              <div style={{ position: "absolute", left: 0, top: 0, width: "38px", height: "38px", borderRadius: "50%", background: C.black, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: C.white, fontWeight: 700, fontSize: "16px", fontFamily: "inherit" }}>€</span>
              </div>
              <div style={{ position: "absolute", left: "14px", top: "14px", width: "38px", height: "38px", borderRadius: "50%", background: C.tag, border: `2px solid ${C.white}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: C.muted, fontWeight: 700, fontSize: "14px", fontFamily: "inherit" }}>€</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px" }}>MisGastos</div>
              <div style={{ color: C.muted, fontSize: "13px", marginTop: "2px" }}>Gastos compartidos en tiempo real</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "6px", marginBottom: "24px" }}>
            {["login", "register"].map(m => (
              <button key={m} style={{ ...S.btnSm, flex: 1, background: mode === m ? C.black : "transparent", color: mode === m ? C.white : C.muted, borderColor: mode === m ? C.black : C.border }}
                onClick={() => { setMode(m); setErr(""); }}>
                {m === "login" ? "Entrar" : "Registrarse"}
              </button>
            ))}
          </div>

          <Input label="Usuario" placeholder="ej: miguel" value={username}
            onChange={e => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off" />
          <Input label="Contraseña" type="password" placeholder="••••••••" value={pass}
            onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
          {err && <p style={S.err}>{err}</p>}
          <button style={S.btn} onClick={submit} disabled={loading}>{loading ? "…" : mode === "login" ? "Entrar" : "Crear cuenta"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── GROUPS ──────────────────────────────────────────────────────────────────
function GroupScreen({ user, onGroup }) {
  const [groups, setGroups] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(collection(db, "groups"), where("members", "array-contains", user.uid)),
      snap => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  const createGroup = async () => {
    if (!groupName.trim()) return;
    setLoading(true);
    try {
      const inviteCode = uid8().slice(0, 6);
      const ref = await addDoc(collection(db, "groups"), {
        name: groupName.trim(), inviteCode, members: [user.uid],
        memberNames: { [user.uid]: user.displayName || "Yo" },
        createdBy: user.uid, createdAt: serverTimestamp(),
      });
      setShowCreate(false); setGroupName("");
      onGroup({ id: ref.id, name: groupName.trim(), inviteCode, members: [user.uid], memberNames: { [user.uid]: user.displayName || "Yo" } });
    } catch (e) { setErr("Error al crear el grupo"); }
    setLoading(false);
  };

  const joinGroup = async () => {
    setErr("");
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    try {
      // Query groups by invite code - requires 'allow read: if request.auth != null' in Firestore rules
      const snap = await getDocs(query(collection(db, "groups"), where("inviteCode", "==", trimmed)));
      if (snap.empty) { setErr("Código no encontrado"); setLoading(false); return; }

      const gDoc = snap.docs[0];
      const gData = gDoc.data();

      // If already a member, just navigate
      if (gData.members?.includes(user.uid)) {
        onGroup({ id: gDoc.id, ...gData });
        setShowJoin(false); setCode("");
        setLoading(false); return;
      }

      // Add self to group - requires 'allow update: if request.auth != null' in Firestore rules
      await updateDoc(doc(db, "groups", gDoc.id), {
        members: arrayUnion(user.uid),
        [`memberNames.${user.uid}`]: user.displayName || "Nuevo miembro",
      });

      const updated = {
        id: gDoc.id, ...gData,
        members: [...(gData.members || []), user.uid],
        memberNames: { ...(gData.memberNames || {}), [user.uid]: user.displayName || "Nuevo miembro" }
      };
      setShowJoin(false); setCode("");
      onGroup(updated);
    } catch (e) {
      console.error("joinGroup error:", e);
      if (isBlocked(e)) setErr("Adblock bloqueando Firebase — desactívalo y recarga.");
      else if (e.code === "permission-denied") setErr("Sin permisos. Actualiza las reglas de Firestore (ver README).");
      else setErr(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.header}>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 700 }}>{user.displayName?.split(" ")[0] || "Hola"}</div>
            <div style={{ color: C.muted, fontSize: "13px" }}>{groups.length} grupo{groups.length !== 1 ? "s" : ""}</div>
          </div>
          <button style={S.btnSm} onClick={() => signOut(auth)}>Salir</button>
        </div>

        {groups.length === 0 && (
          <div style={{ textAlign: "center", padding: "64px 0 32px", color: C.muted }}>
            <div style={{ fontSize: "13px" }}>Crea un grupo o únete con un código</div>
          </div>
        )}

        {groups.map(g => (
          <div key={g.id} style={S.card} onClick={() => onGroup(g)}>
            <div style={{ fontWeight: 600, fontSize: "15px" }}>{g.name}</div>
            <div style={{ color: C.muted, fontSize: "12px", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span>{Object.keys(g.memberNames || {}).length} miembro{Object.keys(g.memberNames || {}).length !== 1 ? "s" : ""}</span>
              <span style={{ fontFamily: "monospace", letterSpacing: "2px", color: C.black, fontWeight: 700 }}>{g.inviteCode}</span>
            </div>
          </div>
        ))}

        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
          <button style={{ ...S.btn, flex: 1, marginTop: 0 }} onClick={() => setShowCreate(true)}>Crear grupo</button>
          <button style={{ ...S.btnGhost, flex: 1 }} onClick={() => setShowJoin(true)}>Unirse</button>
        </div>
      </div>

      {showCreate && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={S.sheet}>
            <div style={S.handle} />
            <div style={{ fontWeight: 700, fontSize: "17px", marginBottom: "20px" }}>Nuevo grupo</div>
            <Input label="Nombre" placeholder="Casa, Pareja, Viaje..." value={groupName} onChange={e => setGroupName(e.target.value)} />
            {err && <p style={S.err}>{err}</p>}
            <button style={S.btn} onClick={createGroup} disabled={loading || !groupName.trim()}>{loading ? "…" : "Crear"}</button>
          </div>
        </div>
      )}

      {showJoin && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowJoin(false)}>
          <div style={S.sheet}>
            <div style={S.handle} />
            <div style={{ fontWeight: 700, fontSize: "17px", marginBottom: "20px" }}>Unirse a un grupo</div>
            <Input label="Código de invitación" placeholder="ABC123" value={code}
              onChange={e => setCode(e.target.value)} autoCapitalize="characters"
              onKeyDown={e => e.key === "Enter" && joinGroup()} />
            {err && <p style={S.err}>{err}</p>}
            <button style={S.btn} onClick={joinGroup} disabled={loading || !code.trim()}>{loading ? "Buscando…" : "Unirse"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ user, groupInit, onBack }) {
  const [group, setGroup] = useState(groupInit);
  const [tab, setTab] = useState("gastos");
  const [expenses, setExpenses] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("super");
  const [paidBy, setPaidBy] = useState(user.uid);
  const [saving, setSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [splitWith, setSplitWith] = useState([]);
  const [editingExpense, setEditingExpense] = useState(null);
  const [settlements, setSettlements] = useState([]);

  // ── Live listener on group document (members, names, etc.) ──
  useEffect(() => {
    return onSnapshot(doc(db, "groups", groupInit.id), snap => {
      if (snap.exists()) setGroup({ id: snap.id, ...snap.data() });
    });
  }, [groupInit.id]);

  const leaveGroup = async () => {
    try {
      const members = (group.members || []).filter(m => m !== user.uid);
      const memberNames = { ...(group.memberNames || {}) };
      delete memberNames[user.uid];
      await updateDoc(doc(db, "groups", group.id), { members, memberNames });
    } catch (e) { console.error(e); }
    onBack();
  };

  // ── Live listener on expenses ──
  useEffect(() => {
    return onSnapshot(
      query(collection(db, "groups", groupInit.id, "expenses"), orderBy("createdAt", "desc")),
      snap => { setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoadingData(false); }
    );
  }, [groupInit.id]);

  const addExpense = async () => {
    if (!desc.trim() || !amount) return;
    setSaving(true);
    const allMembers = Object.keys(group.memberNames || {});
    const members = splitWith.length > 0 ? splitWith : allMembers;
    const share = parseFloat(amount) / (members.length || 1);
    await addDoc(collection(db, "groups", group.id, "expenses"), {
      desc: desc.trim(), amount: parseFloat(amount), cat, paidBy,
      paidByName: group.memberNames[paidBy] || "?",
      members, share, createdAt: serverTimestamp(), settled: false,
    });
    setDesc(""); setAmount(""); setCat("super"); setPaidBy(user.uid); setSplitWith([]);
    setShowAdd(false); setSaving(false);
  };

  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, "groups", group.id, "expenses", id));
    setShowDetail(null);
  };

  // Load settlements
  useEffect(() => {
    return onSnapshot(
      query(collection(db, "groups", groupInit.id, "settlements"), orderBy("createdAt", "desc")),
      snap => setSettlements(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
  }, [groupInit.id]);

  const editExpense = async () => {
    if (!desc.trim() || !amount || !editingExpense) return;
    setSaving(true);
    const allMembers = Object.keys(group.memberNames || {});
    const members = splitWith.length > 0 ? splitWith : allMembers;
    const share = parseFloat(amount) / (members.length || 1);
    await updateDoc(doc(db, "groups", group.id, "expenses", editingExpense.id), {
      desc: desc.trim(), amount: parseFloat(amount), cat, paidBy,
      paidByName: group.memberNames[paidBy] || "?",
      members, share,
    });
    setDesc(""); setAmount(""); setCat("super"); setPaidBy(user.uid);
    setEditingExpense(null); setShowAdd(false); setSaving(false);
  };

  const settleDebt = async (fromUid, toUid, amount) => {
    await addDoc(collection(db, "groups", group.id, "settlements"), {
      from: fromUid, to: toUid, amount,
      fromName: group.memberNames[fromUid] || "?",
      toName: group.memberNames[toUid] || "?",
      createdAt: serverTimestamp(),
    });
  };

  const undoSettlement = async (id) => {
    await deleteDoc(doc(db, "groups", group.id, "settlements", id));
  };

  const balances = useCallback(() => {
    const members = Object.keys(group.memberNames || {});
    const totals = Object.fromEntries(members.map(m => [m, 0]));
    expenses.forEach(e => {
      (e.members || []).forEach(m => { if (totals[m] !== undefined) totals[m] -= (e.share || 0); });
      if (totals[e.paidBy] !== undefined) totals[e.paidBy] += (e.amount || 0);
    });
    // Apply settlements
    settlements.forEach(s => {
      if (totals[s.from] !== undefined) totals[s.from] += s.amount;
      if (totals[s.to] !== undefined) totals[s.to] -= s.amount;
    });
    return totals;
  }, [expenses, settlements, group.memberNames]);

  const debts = useCallback(() => {
    const bal = { ...balances() };
    const result = [];
    const keys = Object.keys(bal);
    for (let i = 0; i < 30; i++) {
      const maxP = keys.reduce((a, b) => bal[a] > bal[b] ? a : b);
      const minP = keys.reduce((a, b) => bal[a] < bal[b] ? a : b);
      const amt = Math.min(bal[maxP], -bal[minP]);
      if (amt < 0.01) break;
      result.push({ from: minP, to: maxP, amount: amt });
      bal[maxP] -= amt; bal[minP] += amt;
    }
    return result;
  }, [balances]);

  const byMonth = useCallback(() => {
    const map = {};
    expenses.forEach(e => {
      if (!e.createdAt) return;
      const d = e.createdAt.toDate ? e.createdAt.toDate() : new Date();
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!map[key]) map[key] = { total: 0, items: [] };
      map[key].total += e.amount || 0;
      map[key].items.push(e);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  const catInfo = id => CATS.find(c => c.id === id) || CATS[7];
  const memberList = Object.entries(group.memberNames || {});
  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700 }}>{group.name}</div>
            <div style={{ color: C.muted, fontSize: "12px", marginTop: "2px" }}>
              código <span style={{ fontFamily: "monospace", letterSpacing: "2px", color: C.black, fontWeight: 700 }}>{group.inviteCode}</span>
            </div>
          </div>
          <div style={{ position: "relative" }}>
            <button style={S.btnSm} onClick={() => setShowMenu(v => !v)}>···</button>
            {showMenu && (
              <div style={{ position: "absolute", right: 0, top: "40px", background: "#fff", borderRadius: "12px", border: `1px solid ${C.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", minWidth: "160px", zIndex: 30, overflow: "hidden" }}>
                <div onClick={() => { setShowMenu(false); onBack(); }}
                  style={{ padding: "13px 16px", fontSize: "14px", cursor: "pointer", borderBottom: `1px solid ${C.border}` }}>
                  ← Volver a grupos
                </div>
                <div onClick={() => { setShowMenu(false); leaveGroup(); }}
                  style={{ padding: "13px 16px", fontSize: "14px", cursor: "pointer", color: C.red }}>
                  Salir del grupo
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Total card */}
        <div style={{ background: C.black, borderRadius: "14px", padding: "20px", marginBottom: "20px" }}>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px" }}>Total gastado</div>
          <div style={{ fontSize: "34px", fontWeight: 700, color: C.white, letterSpacing: "-1px", marginTop: "4px" }}>{fmt(totalSpent)}</div>
          <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
            {(() => {
              const d = debts();
              if (d.length === 0) return (
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>Estáis al día ✓</div>
              );
              return d.map((debt, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                  <span style={{ color: "#f87171", fontWeight: 700 }}>{(group.memberNames[debt.from] || "?").split(" ")[0]}</span>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>debe</span>
                  <span style={{ color: "#4ade80", fontWeight: 700 }}>{(group.memberNames[debt.to] || "?").split(" ")[0]}</span>
                  <span style={{ marginLeft: "auto", color: C.white, fontWeight: 700 }}>{fmt(debt.amount)}</span>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "16px", borderBottom: `1px solid ${C.border}`, paddingBottom: "0" }}>
          {[["gastos", "Gastos"], ["deudas", "Deudas"], ["resumen", "Resumen"]].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: "8px 14px", border: "none", background: "transparent", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: tab === t ? C.black : C.muted, borderBottom: `2px solid ${tab === t ? C.black : "transparent"}`, marginBottom: "-1px" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── GASTOS ── */}
        {tab === "gastos" && (
          <div>
            {loadingData && <div style={{ textAlign: "center", padding: "40px", color: C.muted, fontSize: "13px" }}>Cargando…</div>}
            {!loadingData && expenses.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: C.muted, fontSize: "13px" }}>Sin gastos aún. Pulsa + para añadir.</div>
            )}
            {expenses.map(e => {
              const c = catInfo(e.cat);
              const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date();
              return (
                <div key={e.id} style={S.card} onClick={() => setShowDetail(e)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "20px" }}>{c.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.desc}</div>
                      <div style={{ color: C.muted, fontSize: "12px", marginTop: "2px" }}>{e.paidByName} · {d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, fontSize: "15px" }}>{fmt(e.amount)}</div>
                      <div style={{ color: C.muted, fontSize: "11px" }}>c/u {fmt(e.share || 0)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── DEUDAS ── */}
        {tab === "deudas" && (
          <div>
            {debts().length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontWeight: 600, fontSize: "15px" }}>¡Estáis al día! 🎉</div>
                <div style={{ color: C.muted, fontSize: "13px", marginTop: "4px" }}>No hay deudas pendientes</div>
              </div>
            ) : (
              <>
                <div style={{ color: C.muted, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>Pendiente</div>
                {debts().map((d, i) => (
                  <div key={i} style={{ ...S.card, cursor: "default" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                      <span style={{ fontWeight: 600 }}>{group.memberNames[d.from]?.split(" ")[0]}</span>
                      <span style={{ color: C.muted }}>→</span>
                      <span style={{ fontWeight: 600 }}>{group.memberNames[d.to]?.split(" ")[0]}</span>
                      <span style={{ marginLeft: "auto", fontWeight: 700, fontSize: "16px", marginRight: "10px" }}>{fmt(d.amount)}</span>
                      <button
                        onClick={() => settleDebt(d.from, d.to, d.amount)}
                        style={{ padding: "6px 12px", borderRadius: "8px", border: `1.5px solid ${C.border}`, background: "transparent", fontFamily: "inherit", fontSize: "12px", fontWeight: 600, cursor: "pointer", color: C.green, whiteSpace: "nowrap" }}>
                        ✓ Saldar
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {settlements.length > 0 && (
              <>
                <div style={S.divider} />
                <div style={{ color: C.muted, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>Pagos realizados</div>
                {settlements.map(s => (
                  <div key={s.id} style={{ ...S.card, cursor: "default", opacity: 0.7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                      <span style={{ color: C.green, fontWeight: 700 }}>✓</span>
                      <span style={{ fontWeight: 600 }}>{s.fromName?.split(" ")[0]}</span>
                      <span style={{ color: C.muted }}>pagó a</span>
                      <span style={{ fontWeight: 600 }}>{s.toName?.split(" ")[0]}</span>
                      <span style={{ marginLeft: "auto", fontWeight: 600, marginRight: "8px" }}>{fmt(s.amount)}</span>
                      <button onClick={() => undoSettlement(s.id)}
                        style={{ background: "none", border: "none", color: C.muted, fontSize: "16px", cursor: "pointer", padding: "0 2px" }}>
                        ↩
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            <div style={S.divider} />
            <div style={{ color: C.muted, fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>Balance</div>
            {memberList.map(([uid, name]) => {
              const bal = balances()[uid] || 0;
              const pct = totalSpent > 0 ? Math.abs(bal) / totalSpent * 100 : 0;
              return (
                <div key={uid} style={{ ...S.card, cursor: "default" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "14px" }}>
                    <span style={{ fontWeight: 600 }}>{name}</span>
                    <span style={{ fontWeight: 700, color: bal >= 0 ? C.green : C.red }}>{bal >= 0 ? "+" : ""}{fmt(bal)}</span>
                  </div>
                  <div style={{ height: "4px", borderRadius: "2px", background: C.border }}>
                    <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: "2px", background: bal >= 0 ? C.green : C.red }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── RESUMEN ── */}
        {tab === "resumen" && (
          <div>
            {byMonth().length === 0 && <div style={{ textAlign: "center", padding: "48px 0", color: C.muted, fontSize: "13px" }}>Sin datos aún.</div>}
            {byMonth().map(([key, data]) => {
              const catTotals = {};
              data.items.forEach(e => { catTotals[e.cat] = (catTotals[e.cat] || 0) + e.amount; });
              return (
                <div key={key} style={{ marginBottom: "24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
                    <div style={{ fontWeight: 700, fontSize: "14px", textTransform: "capitalize" }}>{monthLabel(key + "-01")}</div>
                    <div style={{ fontWeight: 700, fontSize: "16px" }}>{fmt(data.total)}</div>
                  </div>
                  <div style={{ background: C.white, borderRadius: "14px", border: `1px solid ${C.border}`, overflow: "hidden" }}>
                    {Object.entries(catTotals).sort((a, b) => b[1] - a[1]).map(([cid, total], i, arr) => {
                      const c = catInfo(cid);
                      const pct = data.total > 0 ? total / data.total * 100 : 0;
                      return (
                        <div key={cid} style={{ padding: "12px 16px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                            <span>{c.icon} {c.label}</span>
                            <span style={{ fontWeight: 600 }}>{fmt(total)}</span>
                          </div>
                          <div style={{ height: "3px", borderRadius: "2px", background: C.border }}>
                            <div style={{ height: "100%", width: `${pct}%`, borderRadius: "2px", background: C.black }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button style={S.fab} onClick={() => setShowAdd(true)}>+</button>

      {/* ADD / EDIT EXPENSE */}
      {showAdd && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setEditingExpense(null); setDesc(""); setAmount(""); setCat("super"); setPaidBy(user.uid); setSplitWith([]); } }}>
          <div style={S.sheet}>
            <div style={S.handle} />
            <div style={{ fontWeight: 700, fontSize: "17px", marginBottom: "20px" }}>{editingExpense ? "Editar gasto" : "Nuevo gasto"}</div>

            <Input label="Descripción" placeholder="Mercadona, Netflix…" value={desc} onChange={e => setDesc(e.target.value)} />
            <Input label="Importe (€)" type="number" placeholder="0,00" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />

            <label style={S.label}>Categoría</label>
            <div style={{ marginBottom: "14px" }}>
              {CATS.map(c => <Pill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.icon} {c.label}</Pill>)}
            </div>

            <label style={S.label}>Pagado por</label>
            <div style={{ marginBottom: "16px" }}>
              {memberList.map(([uid, name]) => <Pill key={uid} active={paidBy === uid} onClick={() => setPaidBy(uid)}>{name.split(" ")[0]}</Pill>)}
            </div>

            <label style={S.label}>Dividir entre</label>
            <div style={{ marginBottom: "6px" }}>
              {memberList.map(([uid, name]) => {
                const allSelected = splitWith.length === 0;
                const isSelected = allSelected || splitWith.includes(uid);
                return (
                  <Pill key={uid} active={isSelected}
                    onClick={() => {
                      if (allSelected) {
                        setSplitWith(memberList.map(([id]) => id).filter(id => id !== uid));
                      } else if (isSelected) {
                        const next = splitWith.filter(id => id !== uid);
                        setSplitWith(next.length === memberList.length ? [] : next);
                      } else {
                        const next = [...splitWith, uid];
                        setSplitWith(next.length === memberList.length ? [] : next);
                      }
                    }}>
                    {name.split(" ")[0]}
                  </Pill>
                );
              })}
            </div>
            {amount && (
              <div style={{ fontSize: "12px", color: C.muted, marginBottom: "16px" }}>
                {(() => {
                  const sel = splitWith.length > 0 ? splitWith : memberList.map(([id]) => id);
                  const share = parseFloat(amount) / (sel.length || 1);
                  return `${fmt(parseFloat(amount))} ÷ ${sel.length} = ${fmt(share)} c/u`;
                })()}
              </div>
            )}

            <button style={S.btn} onClick={editingExpense ? editExpense : addExpense} disabled={saving || !desc.trim() || !amount}>
              {saving ? "Guardando…" : editingExpense ? "Guardar cambios" : "Añadir gasto"}
            </button>
          </div>
        </div>
      )}

      {/* DETAIL */}
      {showDetail && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowDetail(null)}>
          <div style={S.sheet}>
            <div style={S.handle} />
            <div style={{ fontSize: "13px", color: C.muted, marginBottom: "4px" }}>{catInfo(showDetail.cat).icon} {catInfo(showDetail.cat).label}</div>
            <div style={{ fontWeight: 700, fontSize: "20px", marginBottom: "4px" }}>{showDetail.desc}</div>
            <div style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-1px", marginBottom: "20px" }}>{fmt(showDetail.amount)}</div>
            <div style={{ background: C.bg, borderRadius: "12px", padding: "4px 0", marginBottom: "16px" }}>
              {[
                ["Pagado por", showDetail.paidByName],
                ["Corresponde a c/u", fmt(showDetail.share || 0)],
                ["Fecha", showDetail.createdAt?.toDate ? showDetail.createdAt.toDate().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.muted, fontSize: "13px" }}>{k}</span>
                  <span style={{ fontWeight: 600, fontSize: "13px" }}>{v}</span>
                </div>
              ))}
            </div>
            {(showDetail.paidBy === user.uid || group.createdBy === user.uid) && (
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={{ ...S.btn, marginTop: 0, flex: 1, background: C.tag, color: C.black }}
                  onClick={() => {
                    setDesc(showDetail.desc);
                    setAmount(String(showDetail.amount));
                    setCat(showDetail.cat);
                    setPaidBy(showDetail.paidBy);
                    setSplitWith(showDetail.members || []);
                    setEditingExpense(showDetail);
                    setShowDetail(null);
                    setShowAdd(true);
                  }}>
                  Editar
                </button>
                <button style={{ ...S.btn, marginTop: 0, flex: 1, background: C.red }} onClick={() => deleteExpense(showDetail.id)}>
                  Eliminar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined);
  const [group, setGroup] = useState(null);

  useEffect(() => { return onAuthStateChanged(auth, u => setUser(u || null)); }, []);

  if (user === undefined) return <Spinner />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        input:focus { border-color: #111 !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
      {!user && <AuthScreen />}
      {user && !group && <GroupScreen user={user} onGroup={setGroup} />}
      {user && group && <Dashboard user={user} groupInit={group} onBack={() => setGroup(null)} />}
    </>
  );
}
