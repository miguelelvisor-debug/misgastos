import { useState, useEffect, useCallback } from "react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  collection, doc, setDoc, getDoc, addDoc, onSnapshot,
  query, where, updateDoc, arrayUnion, serverTimestamp,
  orderBy, deleteDoc
} from "firebase/firestore";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "super", label: "Supermercado", icon: "🛒" },
  { id: "casa",  label: "Casa",         icon: "🏠" },
  { id: "ocio",  label: "Ocio",         icon: "🎬" },
  { id: "trans", label: "Transporte",   icon: "🚗" },
  { id: "salud", label: "Salud",        icon: "💊" },
  { id: "ropa",  label: "Ropa",         icon: "👕" },
  { id: "rest",  label: "Restaurante",  icon: "🍽️" },
  { id: "otro",  label: "Otro",         icon: "📦" },
];

const PALETTE = {
  bg:       "#0f0f1a",
  card:     "#1a1a2e",
  card2:    "#16213e",
  accent:   "#6c63ff",
  accent2:  "#ff6584",
  green:    "#43e97b",
  red:      "#ff6b6b",
  text:     "#f0f0ff",
  muted:    "#7070a0",
  border:   "#2a2a4a",
};

function nanoid(n = 8) {
  return Math.random().toString(36).slice(2, 2 + n).toUpperCase();
}

function fmt(n) {
  return Number(n).toFixed(2).replace(".", ",") + " €";
}

function monthLabel(d) {
  return new Date(d).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S = {
  app:       { minHeight: "100dvh", background: PALETTE.bg, fontFamily: "'DM Sans', sans-serif", color: PALETTE.text, position: "relative" },
  center:    { minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" },
  card:      { background: PALETTE.card, borderRadius: "24px", padding: "32px 28px", width: "100%", maxWidth: "400px", boxShadow: "0 24px 60px rgba(0,0,0,0.5)" },
  title:     { fontSize: "28px", fontWeight: 800, marginBottom: "4px", background: "linear-gradient(135deg, #6c63ff, #ff6584)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  sub:       { color: PALETTE.muted, fontSize: "13px", marginBottom: "28px" },
  label:     { fontSize: "11px", fontWeight: 700, color: PALETTE.muted, textTransform: "uppercase", letterSpacing: "0.8px", display: "block", marginBottom: "6px" },
  input:     { width: "100%", padding: "13px 16px", borderRadius: "14px", border: `1.5px solid ${PALETTE.border}`, background: PALETTE.card2, color: PALETTE.text, fontFamily: "inherit", fontSize: "15px", outline: "none", boxSizing: "border-box", marginBottom: "14px" },
  btn:       { width: "100%", padding: "15px", borderRadius: "16px", border: "none", background: "linear-gradient(135deg, #6c63ff, #8b5cf6)", color: "white", fontFamily: "inherit", fontWeight: 700, fontSize: "15px", cursor: "pointer", marginTop: "6px" },
  btnSm:     { padding: "10px 18px", borderRadius: "12px", border: "none", background: PALETTE.card2, color: PALETTE.text, fontFamily: "inherit", fontWeight: 600, fontSize: "13px", cursor: "pointer", border: `1px solid ${PALETTE.border}` },
  btnDanger: { padding: "10px 18px", borderRadius: "12px", border: "none", background: "#3a1a1a", color: PALETTE.red, fontFamily: "inherit", fontWeight: 600, fontSize: "13px", cursor: "pointer" },
  err:       { color: PALETTE.red, fontSize: "13px", marginTop: "-8px", marginBottom: "10px", fontWeight: 600 },
  wrap:      { maxWidth: "480px", margin: "0 auto", padding: "0 16px 100px" },
  header:    { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "max(env(safe-area-inset-top), 20px)", paddingBottom: "16px" },
  overlay:   { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 20, display: "flex", alignItems: "flex-end", justifyContent: "center" },
  sheet:     { background: PALETTE.card, borderRadius: "28px 28px 0 0", width: "100%", maxWidth: "480px", padding: "24px 22px", paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))", maxHeight: "90dvh", overflowY: "auto" },
  handle:    { width: "36px", height: "4px", borderRadius: "4px", background: PALETTE.border, margin: "0 auto 20px" },
  tab:       { flex: 1, padding: "10px", borderRadius: "12px", border: "none", fontFamily: "inherit", fontWeight: 700, fontSize: "13px", cursor: "pointer" },
  row:       { display: "flex", alignItems: "center", gap: "12px" },
  divider:   { height: "1px", background: PALETTE.border, margin: "16px 0" },
  badge:     { display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700 },
  fab:       { position: "fixed", bottom: "max(24px, env(safe-area-inset-bottom, 24px))", right: "20px", width: "56px", height: "56px", borderRadius: "50%", background: "linear-gradient(135deg, #6c63ff, #ff6584)", border: "none", color: "white", fontSize: "26px", cursor: "pointer", zIndex: 10, boxShadow: "0 8px 24px rgba(108,99,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center" },
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ ...S.center, background: PALETTE.bg }}>
      <div style={{ fontSize: "40px", animation: "spin 1s linear infinite" }}>💸</div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label style={S.label}>{label}</label>}
      <input style={S.input} {...props} />
    </div>
  );
}

// ─── AUTH SCREEN ─────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      if (mode === "register") {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, "users", cred.user.uid), { name, email, uid: cred.user.uid, createdAt: serverTimestamp() });
      } else {
        await signInWithEmailAndPassword(auth, email, pass);
      }
    } catch (e) {
      const msgs = { "auth/email-already-in-use": "Email ya registrado", "auth/wrong-password": "Contraseña incorrecta", "auth/user-not-found": "Usuario no encontrado", "auth/weak-password": "Contraseña demasiado corta", "auth/invalid-email": "Email inválido", "auth/invalid-credential": "Email o contraseña incorrectos" };
      setErr(msgs[e.code] || "Error al conectar");
    }
    setLoading(false);
  };

  return (
    <div style={S.center}>
      <div style={S.card}>
        <div style={{ textAlign: "center", fontSize: "48px", marginBottom: "12px" }}>💸</div>
        <h1 style={{ ...S.title, textAlign: "center" }}>MisGastos</h1>
        <p style={{ ...S.sub, textAlign: "center" }}>Gastos compartidos en tiempo real</p>

        <div style={{ display: "flex", gap: "8px", marginBottom: "24px", background: PALETTE.card2, borderRadius: "14px", padding: "4px" }}>
          {["login","register"].map(m => (
            <button key={m} style={{ ...S.tab, background: mode === m ? "linear-gradient(135deg,#6c63ff,#8b5cf6)" : "transparent", color: mode === m ? "white" : PALETTE.muted }}
              onClick={() => { setMode(m); setErr(""); }}>
              {m === "login" ? "Entrar" : "Registrarse"}
            </button>
          ))}
        </div>

        {mode === "register" && <Input label="Tu nombre" placeholder="Miguel" value={name} onChange={e => setName(e.target.value)} />}
        <Input label="Email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} autoCapitalize="none" />
        <Input label="Contraseña" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} />
        {err && <p style={S.err}>{err}</p>}
        <button style={S.btn} onClick={submit} disabled={loading}>
          {loading ? "..." : mode === "login" ? "Entrar →" : "Crear cuenta →"}
        </button>
      </div>
    </div>
  );
}

// ─── GROUP SCREEN ─────────────────────────────────────────────────────────────
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
    const q = query(collection(db, "groups"), where("members", "array-contains", user.uid));
    return onSnapshot(q, snap => setGroups(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user]);

  const createGroup = async () => {
    if (!groupName.trim()) return;
    setLoading(true);
    const inviteCode = nanoid(6);
    const ref = await addDoc(collection(db, "groups"), {
      name: groupName.trim(), inviteCode, members: [user.uid],
      memberNames: { [user.uid]: user.displayName },
      createdBy: user.uid, createdAt: serverTimestamp(),
    });
    setShowCreate(false); setGroupName(""); setLoading(false);
    onGroup({ id: ref.id, name: groupName.trim(), inviteCode, members: [user.uid], memberNames: { [user.uid]: user.displayName } });
  };

  const joinGroup = async () => {
    setErr("");
    const q = query(collection(db, "groups"), where("inviteCode", "==", code.trim().toUpperCase()));
    const snap = await (await import("firebase/firestore")).getDocs(q);
    if (snap.empty) { setErr("Código no encontrado 😕"); return; }
    const gDoc = snap.docs[0];
    if (gDoc.data().members.includes(user.uid)) { onGroup({ id: gDoc.id, ...gDoc.data() }); return; }
    await updateDoc(doc(db, "groups", gDoc.id), {
      members: arrayUnion(user.uid),
      [`memberNames.${user.uid}`]: user.displayName,
    });
    setShowJoin(false); setCode("");
    onGroup({ id: gDoc.id, ...gDoc.data() });
  };

  return (
    <div style={S.app}>
      <div style={S.wrap}>
        <div style={S.header}>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800 }}>Hola, {user.displayName?.split(" ")[0]} 👋</div>
            <div style={{ color: PALETTE.muted, fontSize: "13px" }}>Tus grupos</div>
          </div>
          <button style={{ ...S.btnSm, padding: "8px 12px", fontSize: "18px" }} onClick={() => signOut(auth)}>↩</button>
        </div>

        {groups.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: PALETTE.muted }}>
            <div style={{ fontSize: "56px", marginBottom: "12px" }}>🏠</div>
            <div style={{ fontWeight: 700, fontSize: "16px", color: PALETTE.text }}>Sin grupos aún</div>
            <div style={{ fontSize: "13px", marginTop: "4px" }}>Crea uno o únete con un código</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
          {groups.map(g => (
            <div key={g.id} onClick={() => onGroup(g)}
              style={{ background: PALETTE.card, borderRadius: "20px", padding: "18px 20px", cursor: "pointer", border: `1px solid ${PALETTE.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "16px" }}>{g.name}</div>
                <div style={{ color: PALETTE.muted, fontSize: "12px", marginTop: "2px" }}>
                  {Object.keys(g.memberNames || {}).length} miembro{Object.keys(g.memberNames || {}).length !== 1 ? "s" : ""} · código: <strong style={{ color: PALETTE.accent }}>{g.inviteCode}</strong>
                </div>
              </div>
              <span style={{ fontSize: "20px" }}>→</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
          <button style={{ ...S.btn, marginTop: 0, flex: 1, background: "linear-gradient(135deg,#6c63ff,#8b5cf6)" }} onClick={() => setShowCreate(true)}>
            + Crear grupo
          </button>
          <button style={{ ...S.btn, marginTop: 0, flex: 1, background: "linear-gradient(135deg,#ff6584,#ff8a65)" }} onClick={() => setShowJoin(true)}>
            Unirse
          </button>
        </div>
      </div>

      {/* CREATE */}
      {showCreate && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div style={S.sheet}>
            <div style={S.handle} />
            <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px" }}>Nuevo grupo 🏠</div>
            <Input label="Nombre del grupo" placeholder="Casa, Pareja, Viaje..." value={groupName} onChange={e => setGroupName(e.target.value)} />
            <button style={S.btn} onClick={createGroup} disabled={loading || !groupName.trim()}>
              {loading ? "..." : "Crear grupo →"}
            </button>
          </div>
        </div>
      )}

      {/* JOIN */}
      {showJoin && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowJoin(false)}>
          <div style={S.sheet}>
            <div style={S.handle} />
            <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px" }}>Unirse a un grupo 🔑</div>
            <Input label="Código de invitación" placeholder="ABC123" value={code} onChange={e => setCode(e.target.value)} autoCapitalize="characters" />
            {err && <p style={S.err}>{err}</p>}
            <button style={S.btn} onClick={joinGroup} disabled={!code.trim()}>Unirse →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN DASHBOARD ──────────────────────────────────────────────────────────
function Dashboard({ user, group, onBack }) {
  const [tab, setTab] = useState("gastos");
  const [expenses, setExpenses] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [cat, setCat] = useState("super");
  const [paidBy, setPaidBy] = useState(user.uid);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "groups", group.id, "expenses"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, [group.id]);

  const addExpense = async () => {
    if (!desc.trim() || !amount) return;
    setSaving(true);
    const members = Object.keys(group.memberNames || {});
    const share = parseFloat(amount) / members.length;
    await addDoc(collection(db, "groups", group.id, "expenses"), {
      desc: desc.trim(), amount: parseFloat(amount), cat, paidBy,
      paidByName: group.memberNames[paidBy] || "Desconocido",
      members, share, createdAt: serverTimestamp(),
      settled: false,
    });
    setDesc(""); setAmount(""); setCat("super"); setPaidBy(user.uid);
    setShowAdd(false); setSaving(false);
  };

  const deleteExpense = async (id) => {
    await deleteDoc(doc(db, "groups", group.id, "expenses", id));
    setShowDetail(null);
  };

  // ── Balances ──
  const balances = useCallback(() => {
    const members = Object.keys(group.memberNames || {});
    const totals = {};
    members.forEach(m => totals[m] = 0);
    expenses.forEach(e => {
      if (!e.paidBy || !e.members) return;
      e.members.forEach(m => {
        if (totals[m] !== undefined) totals[m] -= e.share || 0;
      });
      if (totals[e.paidBy] !== undefined) totals[e.paidBy] += e.amount || 0;
    });
    return totals;
  }, [expenses, group.memberNames]);

  // ── Debts (who owes whom) ──
  const debts = useCallback(() => {
    const bal = { ...balances() };
    const result = [];
    const members = Object.keys(bal);
    for (let i = 0; i < 20; i++) {
      const maxP = members.reduce((a, b) => bal[a] > bal[b] ? a : b);
      const minP = members.reduce((a, b) => bal[a] < bal[b] ? a : b);
      if (Math.abs(bal[maxP]) < 0.01) break;
      const amt = Math.min(bal[maxP], -bal[minP]);
      if (amt < 0.01) break;
      result.push({ from: minP, to: maxP, amount: amt });
      bal[maxP] -= amt;
      bal[minP] += amt;
    }
    return result;
  }, [balances]);

  // ── Monthly summary ──
  const byMonth = useCallback(() => {
    const map = {};
    expenses.forEach(e => {
      if (!e.createdAt) return;
      const d = e.createdAt.toDate ? e.createdAt.toDate() : new Date(e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!map[key]) map[key] = { total: 0, items: [] };
      map[key].total += e.amount || 0;
      map[key].items.push(e);
    });
    return Object.entries(map).sort((a,b) => b[0].localeCompare(a[0]));
  }, [expenses]);

  const catInfo = id => CATEGORIES.find(c => c.id === id) || CATEGORIES[7];
  const memberList = Object.entries(group.memberNames || {});
  const totalSpent = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div style={S.app}>
      <div style={S.wrap}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 800 }}>{group.name}</div>
            <div style={{ color: PALETTE.muted, fontSize: "12px" }}>
              Código: <strong style={{ color: PALETTE.accent, letterSpacing: "2px" }}>{group.inviteCode}</strong>
              {" "}· {memberList.length} miembro{memberList.length !== 1 ? "s" : ""}
            </div>
          </div>
          <button style={{ ...S.btnSm, padding: "8px 14px" }} onClick={onBack}>← Grupos</button>
        </div>

        {/* Summary card */}
        <div style={{ background: "linear-gradient(135deg, #1a1a3e, #2a1a4e)", borderRadius: "22px", padding: "20px 22px", marginBottom: "20px", border: `1px solid ${PALETTE.border}` }}>
          <div style={{ color: PALETTE.muted, fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px" }}>Total gastado</div>
          <div style={{ fontSize: "36px", fontWeight: 900, background: "linear-gradient(135deg,#6c63ff,#ff6584)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {fmt(totalSpent)}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
            {memberList.map(([uid, name]) => {
              const bal = balances()[uid] || 0;
              return (
                <div key={uid} style={{ background: PALETTE.card, borderRadius: "12px", padding: "6px 12px", fontSize: "12px" }}>
                  <span style={{ fontWeight: 700 }}>{name.split(" ")[0]}</span>
                  <span style={{ color: bal >= 0 ? PALETTE.green : PALETTE.red, marginLeft: "6px", fontWeight: 800 }}>
                    {bal >= 0 ? "+" : ""}{fmt(bal)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "6px", background: PALETTE.card, borderRadius: "16px", padding: "4px", marginBottom: "16px" }}>
          {[["gastos","💳 Gastos"],["deudas","⚖️ Deudas"],["resumen","📅 Resumen"]].map(([t, label]) => (
            <button key={t} style={{ ...S.tab, background: tab === t ? "linear-gradient(135deg,#6c63ff,#8b5cf6)" : "transparent", color: tab === t ? "white" : PALETTE.muted }}
              onClick={() => setTab(t)}>{label}</button>
          ))}
        </div>

        {/* ── TAB: GASTOS ── */}
        {tab === "gastos" && (
          <div>
            {loading && <div style={{ textAlign: "center", padding: "40px", color: PALETTE.muted }}>Cargando...</div>}
            {!loading && expenses.length === 0 && (
              <div style={{ textAlign: "center", padding: "50px 0", color: PALETTE.muted }}>
                <div style={{ fontSize: "48px", marginBottom: "10px" }}>🧾</div>
                <div style={{ fontWeight: 700, color: PALETTE.text }}>Sin gastos aún</div>
                <div style={{ fontSize: "13px", marginTop: "4px" }}>Pulsa + para añadir el primero</div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {expenses.map(e => {
                const c = catInfo(e.cat);
                const d = e.createdAt?.toDate ? e.createdAt.toDate() : new Date();
                return (
                  <div key={e.id} onClick={() => setShowDetail(e)}
                    style={{ background: PALETTE.card, borderRadius: "18px", padding: "14px 16px", cursor: "pointer", border: `1px solid ${PALETTE.border}`, display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: PALETTE.card2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>
                      {c.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.desc}</div>
                      <div style={{ color: PALETTE.muted, fontSize: "12px", marginTop: "2px" }}>
                        {e.paidByName} · {d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: "16px", color: PALETTE.accent }}>{fmt(e.amount)}</div>
                      <div style={{ color: PALETTE.muted, fontSize: "11px" }}>{fmt(e.share || 0)}/p.</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB: DEUDAS ── */}
        {tab === "deudas" && (
          <div>
            {debts().length === 0 ? (
              <div style={{ textAlign: "center", padding: "50px 0", color: PALETTE.muted }}>
                <div style={{ fontSize: "48px", marginBottom: "10px" }}>🎉</div>
                <div style={{ fontWeight: 700, color: PALETTE.text }}>¡Estáis al día!</div>
                <div style={{ fontSize: "13px", marginTop: "4px" }}>No hay deudas pendientes</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ color: PALETTE.muted, fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>Quién debe qué</div>
                {debts().map((d, i) => (
                  <div key={i} style={{ background: PALETTE.card, borderRadius: "18px", padding: "16px 18px", border: `1px solid ${PALETTE.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ background: "#3a1a1a", borderRadius: "12px", padding: "6px 12px", fontSize: "13px", fontWeight: 700, color: PALETTE.red }}>
                        {group.memberNames[d.from]?.split(" ")[0]}
                      </div>
                      <div style={{ color: PALETTE.muted, fontSize: "13px" }}>debe</div>
                      <div style={{ background: "#1a3a1a", borderRadius: "12px", padding: "6px 12px", fontSize: "13px", fontWeight: 700, color: PALETTE.green }}>
                        {group.memberNames[d.to]?.split(" ")[0]}
                      </div>
                      <div style={{ marginLeft: "auto", fontWeight: 900, fontSize: "18px", color: PALETTE.accent }}>{fmt(d.amount)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ ...S.divider, marginTop: "24px" }} />
            <div style={{ color: PALETTE.muted, fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" }}>Balance individual</div>
            {memberList.map(([uid, name]) => {
              const bal = balances()[uid] || 0;
              const pct = totalSpent > 0 ? Math.abs(bal) / totalSpent * 100 : 0;
              return (
                <div key={uid} style={{ background: PALETTE.card, borderRadius: "16px", padding: "14px 16px", marginBottom: "8px", border: `1px solid ${PALETTE.border}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontWeight: 700 }}>{name}</span>
                    <span style={{ fontWeight: 800, color: bal >= 0 ? PALETTE.green : PALETTE.red, fontSize: "16px" }}>
                      {bal >= 0 ? "+" : ""}{fmt(bal)}
                    </span>
                  </div>
                  <div style={{ height: "6px", borderRadius: "3px", background: PALETTE.border, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: "3px", background: bal >= 0 ? PALETTE.green : PALETTE.red, transition: "width 0.5s" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB: RESUMEN ── */}
        {tab === "resumen" && (
          <div>
            {byMonth().map(([key, data]) => {
              const catTotals = {};
              data.items.forEach(e => { catTotals[e.cat] = (catTotals[e.cat] || 0) + e.amount; });
              return (
                <div key={key} style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ fontWeight: 800, fontSize: "15px", textTransform: "capitalize" }}>
                      {monthLabel(key + "-01")}
                    </div>
                    <div style={{ fontWeight: 900, color: PALETTE.accent, fontSize: "16px" }}>{fmt(data.total)}</div>
                  </div>
                  <div style={{ background: PALETTE.card, borderRadius: "18px", padding: "14px 16px", border: `1px solid ${PALETTE.border}` }}>
                    {Object.entries(catTotals).sort((a,b) => b[1]-a[1]).map(([cid, total]) => {
                      const c = catInfo(cid);
                      const pct = data.total > 0 ? total / data.total * 100 : 0;
                      return (
                        <div key={cid} style={{ marginBottom: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                            <span>{c.icon} {c.label}</span>
                            <span style={{ fontWeight: 700 }}>{fmt(total)}</span>
                          </div>
                          <div style={{ height: "5px", borderRadius: "3px", background: PALETTE.border }}>
                            <div style={{ height: "100%", width: `${pct}%`, borderRadius: "3px", background: "linear-gradient(90deg,#6c63ff,#ff6584)" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {byMonth().length === 0 && (
              <div style={{ textAlign: "center", padding: "50px 0", color: PALETTE.muted }}>
                <div style={{ fontSize: "48px", marginBottom: "10px" }}>📅</div>
                <div style={{ fontWeight: 700, color: PALETTE.text }}>Sin datos aún</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB */}
      <button style={S.fab} onClick={() => setShowAdd(true)}>+</button>

      {/* ADD EXPENSE */}
      {showAdd && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={S.sheet}>
            <div style={S.handle} />
            <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px" }}>Nuevo gasto 💳</div>

            <label style={S.label}>Descripción</label>
            <input style={S.input} placeholder="Mercadona, Netflix, Gasolina..." value={desc}
              onChange={e => setDesc(e.target.value)} />

            <label style={S.label}>Importe (€)</label>
            <input style={S.input} type="number" placeholder="0,00" min="0" step="0.01" value={amount}
              onChange={e => setAmount(e.target.value)} inputMode="decimal" />

            <label style={S.label}>Categoría</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: "16px" }}>
              {CATEGORIES.map(c => (
                <div key={c.id} onClick={() => setCat(c.id)}
                  style={{ background: cat === c.id ? PALETTE.accent : PALETTE.card2, borderRadius: "12px", padding: "10px 6px", textAlign: "center", cursor: "pointer", border: `1.5px solid ${cat === c.id ? PALETTE.accent : PALETTE.border}` }}>
                  <div style={{ fontSize: "20px" }}>{c.icon}</div>
                  <div style={{ fontSize: "10px", marginTop: "3px", fontWeight: 600, color: cat === c.id ? "white" : PALETTE.muted }}>{c.label}</div>
                </div>
              ))}
            </div>

            <label style={S.label}>Pagado por</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
              {memberList.map(([uid, name]) => (
                <div key={uid} onClick={() => setPaidBy(uid)}
                  style={{ padding: "8px 16px", borderRadius: "12px", cursor: "pointer", background: paidBy === uid ? PALETTE.accent : PALETTE.card2, border: `1.5px solid ${paidBy === uid ? PALETTE.accent : PALETTE.border}`, fontWeight: 700, fontSize: "13px", color: paidBy === uid ? "white" : PALETTE.text }}>
                  {name.split(" ")[0]}
                </div>
              ))}
            </div>

            <button style={S.btn} onClick={addExpense} disabled={saving || !desc.trim() || !amount}>
              {saving ? "Guardando..." : "Añadir gasto →"}
            </button>
          </div>
        </div>
      )}

      {/* DETAIL */}
      {showDetail && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowDetail(null)}>
          <div style={S.sheet}>
            <div style={S.handle} />
            <div style={{ textAlign: "center", fontSize: "48px", marginBottom: "8px" }}>{catInfo(showDetail.cat).icon}</div>
            <div style={{ textAlign: "center", fontWeight: 800, fontSize: "22px", marginBottom: "4px" }}>{showDetail.desc}</div>
            <div style={{ textAlign: "center", fontSize: "36px", fontWeight: 900, color: PALETTE.accent, marginBottom: "20px" }}>{fmt(showDetail.amount)}</div>
            <div style={{ background: PALETTE.card2, borderRadius: "16px", padding: "16px", marginBottom: "16px" }}>
              {[
                ["Categoría", catInfo(showDetail.cat).label],
                ["Pagado por", showDetail.paidByName],
                ["Por persona", fmt(showDetail.share || 0)],
                ["Fecha", showDetail.createdAt?.toDate ? showDetail.createdAt.toDate().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "—"],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${PALETTE.border}` }}>
                  <span style={{ color: PALETTE.muted, fontSize: "13px" }}>{k}</span>
                  <span style={{ fontWeight: 700, fontSize: "13px" }}>{v}</span>
                </div>
              ))}
            </div>
            {(showDetail.paidBy === user.uid || group.createdBy === user.uid) && (
              <button style={{ ...S.btnDanger, width: "100%", padding: "14px" }} onClick={() => deleteExpense(showDetail.id)}>
                🗑️ Eliminar gasto
              </button>
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

  useEffect(() => {
    return onAuthStateChanged(auth, u => setUser(u || null));
  }, []);

  if (user === undefined) return <Spinner />;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        input:focus { border-color: #6c63ff !important; }
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 4px; }
      `}</style>
      {!user && <AuthScreen />}
      {user && !group && <GroupScreen user={user} onGroup={setGroup} />}
      {user && group && <Dashboard user={user} group={group} onBack={() => setGroup(null)} />}
    </>
  );
}
