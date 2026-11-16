import { useEffect, useState } from "react";
import { api, setToken } from "./api";

type User = { id: string; name: string; role: string };
type Finding = {
  id: string; type: string; severity: string; span: string; explanation: string;
  evidence: { id: string; excerpt: string }[]; suggestion: string | null;
  confidence: number; source: string; status: string; reason?: string;
};

const label = (s: string) => s.replace(/_/g, " ");
const CAN_CREATE = ["creator", "brand_manager", "admin"];
const CAN_KB = ["brand_manager", "admin"];

function Err({ m }: { m: string }) {
  return m ? <div className="err" role="alert">{m}</div> : null;
}

/* ---------------- login ---------------- */
function Login({ onUser }: { onUser: (u: User) => void }) {
  const [reg, setReg] = useState(false);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "creator" });
  const [err, setErr] = useState("");
  const go = async () => {
    try {
      const r = await api(reg ? "/auth/register" : "/auth/login", "POST", f);
      setToken(r.token);
      localStorage.setItem("user", JSON.stringify(r.user));
      onUser(r.user);
    } catch (e: any) { setErr(e.message); }
  };
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="login card">
      <h1>ReCheck</h1>
      <p className="mute">Every brand. One source of truth.</p>
      <Err m={err} />
      {reg && <p><input placeholder="Your name" value={f.name} onChange={set("name")} /></p>}
      <p><input placeholder="Email" value={f.email} onChange={set("email")} /></p>
      <p><input type="password" placeholder="Password" value={f.password} onChange={set("password")} /></p>
      {reg && (
        <p>
          <select value={f.role} onChange={set("role")}>
            <option value="creator">Creator</option>
            <option value="brand_manager">Brand manager</option>
            <option value="reviewer">Reviewer</option>
            <option value="admin">Admin</option>
          </select>
        </p>
      )}
      <div className="row">
        <button className="primary" onClick={go}>{reg ? "Create account" : "Sign in"}</button>
        <button onClick={() => { setReg(!reg); setErr(""); }}>{reg ? "I have an account" : "New here? Register"}</button>
      </div>
    </div>
  );
}

/* ---------------- finding card ---------------- */
function FindingCard({ f, editable, onDone }: { f: Finding; editable: boolean; onDone: () => void }) {
  const [sug, setSug] = useState(f.suggestion ?? "");
  const [err, setErr] = useState("");
  const patch = async (status: string, reason = "") => {
    try { await api(`/findings/${f.id}`, "PATCH", { status, reason, suggestion: sug || null }); onDone(); }
    catch (e: any) { setErr(e.message); }
  };
  const reject = () => {
    const reason = window.prompt("Why reject this finding?");
    if (reason) patch("rejected", reason);
  };
  return (
    <div className={`card finding ${f.status}`}>
      <div className="row">
        <span className={`badge ${f.severity}`}>{f.severity}</span>
        <strong>{label(f.type)}</strong>
        <span className="mute">{f.source === "rule" ? "rule" : "AI"} · confidence {Math.round(f.confidence * 100)}%</span>
        {f.status !== "open" && <span className="badge">{f.status}</span>}
      </div>
      <p>Found <span className="quote">{f.span}</span></p>
      <p>{f.explanation}</p>
      {f.evidence.length ? f.evidence.map(e => <div className="ev" key={e.id}>{e.excerpt}</div>)
        : <div className="ev none">No approved evidence found</div>}
      <Err m={err} />
      {editable && (
        <>
          <input placeholder="Suggested replacement (you can edit it)" value={sug} onChange={e => setSug(e.target.value)} />
          <div className="row" style={{ marginTop: ".5rem" }}>
            <button className="primary" disabled={!sug} onClick={() => patch("accepted")}>Accept fix</button>
            <button onClick={reject}>Reject</button>
            {f.status !== "open" && <button onClick={() => patch("open")}>Undo</button>}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- content view ---------------- */
function ContentView({ id, user, onChange }: { id: string; user: User; onChange: () => void }) {
  const [d, setD] = useState<any>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { const x = await api(`/content/${id}`); setD(x); setText(x.version.body); }
    catch (e: any) { setErr(e.message); }
  };
  useEffect(() => { setD(null); load(); }, [id]);
  if (!d) return <Err m={err} />;

  const { item, findings, versions, approvals } = d;
  const editable = CAN_CREATE.includes(user.role) && ["audited", "changes_requested"].includes(item.status);
  const accepted: Finding[] = findings.filter((f: Finding) => f.status === "accepted" && f.suggestion);
  const after = accepted.reduce((t, f) => t.replace(f.span, f.suggestion!), d.version.body);

  const run = async (fn: () => Promise<any>) => {
    setBusy(true); setErr("");
    try { await fn(); await load(); onChange(); } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  const reaudit = (body: string) => run(() => api("/content", "POST", { title: item.title, text: body, contentId: id }));
  const reviewer = ["reviewer", "admin"].includes(user.role) && item.status === "in_review";

  return (
    <div>
      <div className="row">
        <h2 style={{ margin: 0 }}>{item.title}</h2>
        <span className={`badge ${item.status}`}>{label(item.status)}</span>
        <span className="mute">version {d.version.number} · by {item.createdByName}</span>
      </div>
      <Err m={err} />
      {d.version.aiNote && <div className="ok">{d.version.aiNote}</div>}

      <div className="card" style={{ marginTop: ".8rem" }}>
        <h3>Draft</h3>
        <textarea value={text} readOnly={!editable} onChange={e => setText(e.target.value)} />
        {editable && (
          <div className="row" style={{ marginTop: ".6rem" }}>
            <button className="lime" disabled={busy} onClick={() => reaudit(text)}>{busy ? "Auditing…" : "Re-audit my edits"}</button>
            {accepted.length > 0 && <button disabled={busy} onClick={() => reaudit(after)}>Apply {accepted.length} accepted fixes and re-audit</button>}
            {item.status === "audited" && <button className="primary" disabled={busy} onClick={() => run(() => api(`/content/${id}/submit`, "POST"))}>Submit for review</button>}
          </div>
        )}
      </div>

      {accepted.length > 0 && (
        <div className="card">
          <h3>Before and after</h3>
          <div className="diff"><pre>{d.version.body}</pre><pre>{after}</pre></div>
        </div>
      )}

      {reviewer && (
        <div className="card">
          <h3>Your decision</h3>
          <textarea style={{ minHeight: 70 }} placeholder="Note for the creator" value={note} onChange={e => setNote(e.target.value)} />
          <div className="row" style={{ marginTop: ".6rem" }}>
            <button className="lime" onClick={() => run(() => api(`/content/${id}/review`, "POST", { decision: "approve", note }))}>Approve</button>
            <button onClick={() => run(() => api(`/content/${id}/review`, "POST", { decision: "changes", note }))}>Request changes</button>
          </div>
        </div>
      )}

      <h3>Findings ({findings.length})</h3>
      {findings.length === 0 && <div className="card">No issues found. A human still decides.</div>}
      {findings.map((f: Finding) => (
        <FindingCard key={f.id + f.status} f={f} editable={editable || reviewer} onDone={load} />
      ))}

      {approvals.length > 0 && (
        <div className="card">
          <h3>Review history</h3>
          {approvals.map((a: any) => <p key={a.id}><strong>{a.reviewer}</strong>: {label(a.decision)} {a.note && `— ${a.note}`}</p>)}
        </div>
      )}
      <div className="card">
        <h3>Versions</h3>
        {versions.map((v: any) => <p className="mute" key={v.id}>v{v.number} · {new Date(v.createdAt).toLocaleString()}</p>)}
      </div>
    </div>
  );
}

/* ---------------- new draft ---------------- */
function NewDraft({ onCreated }: { onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr("");
    try { const r = await api("/content", "POST", { title: title || "Untitled draft", text }); onCreated(r.id); }
    catch (e: any) { setErr(e.message); }
    setBusy(false);
  };
  return (
    <div className="card">
      <h2>New draft</h2>
      <Err m={err} />
      <p><input placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} /></p>
      <p><textarea placeholder="Paste your copy here" value={text} onChange={e => setText(e.target.value)} /></p>
      <button className="lime" disabled={busy || !text.trim()} onClick={go}>{busy ? "Auditing…" : "Run audit"}</button>
    </div>
  );
}

function ContentTab({ user }: { user: User }) {
  const [items, setItems] = useState<any[]>([]);
  const [sel, setSel] = useState<string | "new" | null>(null);
  const load = async () => setItems(await api("/content"));
  useEffect(() => { load(); }, []);
  return (
    <div className="split">
      <div>
        {CAN_CREATE.includes(user.role) && <button className="lime item" onClick={() => setSel("new")}>+ New draft</button>}
        {items.length === 0 && <p className="mute">No content yet.</p>}
        {items.map(i => (
          <button key={i.id} className={`item ${sel === i.id ? "on" : ""}`} onClick={() => setSel(i.id)}>
            <strong>{i.title}</strong><br />
            <span className={`badge ${i.status}`}>{label(i.status)}</span>{" "}
            <span className="mute">{i.openFindings} open</span>
          </button>
        ))}
      </div>
      <div>
        {sel === "new" && <NewDraft onCreated={id => { load(); setSel(id); }} />}
        {sel && sel !== "new" && <ContentView id={sel} user={user} onChange={load} />}
        {!sel && <div className="card"><h2>Pick a draft</h2><p className="mute">Reviewers: choose anything marked in review.</p></div>}
      </div>
    </div>
  );
}

/* ---------------- knowledge base ---------------- */
function KnowledgeTab({ user }: { user: User }) {
  const [claims, setClaims] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [guide, setGuide] = useState("");
  const [c, setC] = useState({ claimText: "", sourceRef: "", validUntil: "" });
  const [t, setT] = useState({ forbidden: "", preferred: "", note: "" });
  const [msg, setMsg] = useState("");
  const can = CAN_KB.includes(user.role);
  const load = async () => {
    setClaims(await api("/claims")); setTerms(await api("/terms"));
    setGuide((await api("/guidelines")).body);
  };
  useEffect(() => { load(); }, []);
  const wrap = (fn: () => Promise<any>) => async () => { try { await fn(); setMsg(""); await load(); } catch (e: any) { setMsg(e.message); } };
  return (
    <div className="wrap">
      <Err m={msg} />
      {can && claims.length === 0 && <div className="ok">Empty workspace. <button onClick={wrap(() => api("/seed", "POST"))}>Load demo data</button></div>}
      <div className="card">
        <h3>Tone and guidelines</h3>
        <textarea style={{ minHeight: 90 }} readOnly={!can} value={guide} onChange={e => setGuide(e.target.value)} />
        {can && <p><button className="primary" onClick={wrap(() => api("/guidelines", "PUT", { body: guide }))}>Save guidelines</button></p>}
      </div>
      <div className="grid2">
        <div className="card">
          <h3>Approved claims</h3>
          {can && (
            <>
              <p><input placeholder='Claim, e.g. "Trusted by retailers"' value={c.claimText} onChange={e => setC({ ...c, claimText: e.target.value })} /></p>
              <p><input placeholder="Source" value={c.sourceRef} onChange={e => setC({ ...c, sourceRef: e.target.value })} /></p>
              <p><input type="date" value={c.validUntil} onChange={e => setC({ ...c, validUntil: e.target.value })} /></p>
              <p><button className="primary" disabled={!c.claimText} onClick={wrap(async () => { await api("/claims", "POST", c); setC({ claimText: "", sourceRef: "", validUntil: "" }); })}>Add claim</button></p>
            </>
          )}
          {claims.map(x => (
            <div key={x.id} className="ev">
              <strong>{x.claimText}</strong> <span className="mute">{x.sourceRef} {x.validUntil && `· valid to ${x.validUntil}`}</span>
              {can && <button style={{ marginLeft: 8 }} onClick={wrap(() => api(`/claims/${x.id}`, "DELETE"))}>Delete</button>}
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Terminology</h3>
          {can && (
            <>
              <p><input placeholder="Forbidden term" value={t.forbidden} onChange={e => setT({ ...t, forbidden: e.target.value })} /></p>
              <p><input placeholder="Preferred term" value={t.preferred} onChange={e => setT({ ...t, preferred: e.target.value })} /></p>
              <p><button className="primary" disabled={!t.forbidden} onClick={wrap(async () => { await api("/terms", "POST", t); setT({ forbidden: "", preferred: "", note: "" }); })}>Add term</button></p>
            </>
          )}
          {terms.map(x => (
            <div key={x.id} className="ev">
              <s>{x.forbidden}</s> → <strong>{x.preferred || "avoid"}</strong>
              {can && <button style={{ marginLeft: 8 }} onClick={wrap(() => api(`/terms/${x.id}`, "DELETE"))}>Delete</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- analytics ---------------- */
function Bars({ data }: { data: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(data));
  const e = Object.entries(data);
  if (!e.length) return <p className="mute">No data yet.</p>;
  return <>{e.map(([k, v]) => (
    <div key={k} style={{ margin: ".4rem 0" }}>
      <div className="row"><span style={{ width: 150 }}>{label(k)}</span><div className="bar" style={{ width: `${(v / max) * 60}%` }} /><span>{v}</span></div>
    </div>
  ))}</>;
}

function AnalyticsTab() {
  const [a, setA] = useState<any>(null);
  useEffect(() => { api("/analytics").then(setA); }, []);
  if (!a) return <div className="wrap">Loading…</div>;
  const pct = (x: number | null) => (x === null ? "n/a" : `${Math.round(x * 100)}%`);
  return (
    <div className="wrap">
      <div className="grid2">
        <div className="card"><h3>Findings by type</h3><Bars data={a.byType} /></div>
        <div className="card"><h3>Content by status</h3><Bars data={a.contentByStatus} /></div>
        <div className="card"><h3>Most repeated problems</h3><Bars data={Object.fromEntries(a.topSpans)} /></div>
        <div className="card">
          <h3>Rules people override</h3>
          <Bars data={a.rejectedByType} />
          <p className="mute">Fix acceptance: {pct(a.acceptanceRate)} · Rejection rate: {pct(a.rejectionRate)}. High rejection on one type can mean a guideline is unclear.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- app shell ---------------- */
export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const u = localStorage.getItem("user");
    return u ? JSON.parse(u) : null;
  });
  const [tab, setTab] = useState("content");
  if (!user) return <Login onUser={setUser} />;
  const logout = () => { setToken(""); localStorage.removeItem("user"); setUser(null); };
  return (
    <>
      <header className="top">
        <span className="logo">ReCheck</span>
        <nav>
          {[["content", "Content"], ["kb", "Knowledge base"], ["stats", "Analytics"]].map(([k, l]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <span className="who">{user.name} · {label(user.role)}</span>
        <button onClick={logout}>Sign out</button>
      </header>
      {tab === "content" && <div className="wrap"><ContentTab user={user} /></div>}
      {tab === "kb" && <KnowledgeTab user={user} />}
      {tab === "stats" && <AnalyticsTab />}
    </>
  );
}
