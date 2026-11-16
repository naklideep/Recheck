
import { useEffect, useState } from "react";
import axios from "axios";
import "./index.css";

const API = "http://127.0.0.1:8000";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type ContentItem = {
  id: string;
  title: string;
  status: string;
  openFindings?: number;
};

type Finding = {
  id: string;
  type: string;
  severity: string;
  span: string;
  explanation: string;
  evidence?: { id: string; excerpt: string }[];
  suggestion?: string | null;
  confidence?: number;
  source?: string;
  status?: string;
};

type Rule = {
  id?: string;
  _id?: string;
  name?: string;
  term?: string;
  phrase?: string;
  claim?: string;
  text?: string;
  description?: string;
  category?: string;
  replacement?: string;
  status?: string;
};

type Tab =
  | "dashboard"
  | "audit"
  | "content"
  | "reviews"
  | "rules"
  | "analytics";

const nav = [
  { id: "dashboard", label: "Overview", icon: "⌂" },
  { id: "audit", label: "Content Audit", icon: "✳" },
  { id: "content", label: "My Content", icon: "▤" },
  { id: "reviews", label: "Review Queue", icon: "◷" },
  { id: "rules", label: "Brand Knowledge", icon: "◈" },
  { id: "analytics", label: "Analytics", icon: "▥" },
] as const;

const statusColor = (s: string) =>
  s === "approved" ? "green" :
  s === "in_review" ? "blue" :
  s === "changes_requested" ? "orange" :
  s === "audited" ? "purple" : "gray";

const pretty = (s: string) =>
  (s || "unknown").replaceAll("_", " ");

export default function App() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("dashboard");

  const [email, setEmail] = useState("deep.test@example.com");
  const [password, setPassword] = useState("TestPass123");

  const [title, setTitle] = useState("Test Campaign");
  const [content, setContent] = useState(
    "Our product is the world's best! Guaranteed 100% results!!!"
  );

  const [items, setItems] = useState<ContentItem[]>([]);
  const [queue, setQueue] = useState<ContentItem[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [terms, setTerms] = useState<Rule[]>([]);
  const [guidelines, setGuidelines] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  const [newRule, setNewRule] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [reviewNote, setReviewNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const role = user?.role || "";
  const canManage = ["admin", "brand_manager"].includes(role);
  const canReview = ["admin", "reviewer"].includes(role);

  const api = axios.create({ baseURL: API });
  api.interceptors.request.use((config) => {
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  async function login() {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      setToken(res.data.token);
      setUser(res.data.user);
      setMessage("Welcome back!");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    setSelected(null);
    setFindings([]);
    setTab("dashboard");
    setMessage("Logged out");
  }

  async function loadContent() {
    const res = await api.get("/content");
    const data = res.data;
    setItems(Array.isArray(data) ? data : data.items || data.data || []);
    setQueue((Array.isArray(data) ? data : data.items || data.data || [])
      .filter((x: ContentItem) => x.status === "in_review"));
  }

  async function loadRules() {
    try {
      const [c, t, g] = await Promise.all([
        api.get("/claims"),
        api.get("/terms"),
        api.get("/guidelines"),
      ]);
      setRules(Array.isArray(c.data) ? c.data : c.data.claims || []);
      setTerms(Array.isArray(t.data) ? t.data : t.data.terms || []);
      setGuidelines(Array.isArray(g.data) ? g.data : g.data.guidelines || []);
    } catch {
      setError("Could not load brand knowledge");
    }
  }

  async function loadAnalytics() {
    const res = await api.get("/analytics");
    setAnalytics(res.data);
  }

  async function openContent(id: string) {
    try {
      const res = await api.get(`/content/${id}`);
      setSelected(res.data);
      setFindings(res.data.findings || []);
      setTab("content");
    } catch {
      setError("Could not open content");
    }
  }

  async function audit() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await api.post("/content", { title, text: content });
      await openContent(res.data.id);
      setMessage("Audit completed successfully");
      await loadContent();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitContent(id: string) {
    try {
      await api.post(`/content/${id}/submit`);
      setMessage("Submitted for review");
      await openContent(id);
      await loadContent();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Submission failed");
    }
  }

  async function review(id: string, decision: "approve" | "changes") {
    try {
      const res = await api.post(`/content/${id}/review`, {
        decision,
        note: reviewNote,
      });
      setMessage(`Review completed: ${pretty(res.data.status)}`);
      setReviewNote("");
      await loadContent();
      await openContent(id);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Review failed");
    }
  }

  async function updateFinding(f: Finding, status: string) {
    if (!f.id) return;
    const reason = status === "rejected"
      ? window.prompt("Reason for rejecting this finding?")
      : "";
    if (status === "rejected" && !reason?.trim()) return;

    try {
      await api.patch(`/findings/${f.id}`, { status, reason });
      if (selected?.item?.id) await openContent(selected.item.id);
      setMessage("Finding updated");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Could not update finding");
    }
  }

  async function addClaim() {
    if (!newRule.trim()) return;
    try {
      await api.post("/claims", { claim: newRule });
      setNewRule("");
      await loadRules();
      setMessage("Claim added");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Could not add claim");
    }
  }

  async function addTerm() {
    if (!newTerm.trim()) return;
    try {
      await api.post("/terms", { term: newTerm });
      setNewTerm("");
      await loadRules();
      setMessage("Term added");
    } catch (e: any) {
      setError(e.response?.data?.detail || "Could not add term");
    }
  }

  async function syncKnowledge() {
    try {
      await api.post("/rag/sync");
      setMessage("Brand knowledge synchronized with RAG");
    } catch (e: any) {
      setError(e.response?.data?.detail || "RAG sync failed");
    }
  }

  useEffect(() => {
    if (!token) return;
    loadContent().catch(() => setError("Could not load content"));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (tab === "rules") loadRules();
    if (tab === "analytics") loadAnalytics().catch(() => setError("Analytics unavailable"));
  }, [tab, token]);

  const visibleNav = nav.filter(n => {
    if (n.id === "reviews") return canReview;
    if (n.id === "rules") return canManage;
    return true;
  });

  const stats = {
    total: items.length,
    review: items.filter(x => x.status === "in_review").length,
    approved: items.filter(x => x.status === "approved").length,
    flagged: items.reduce((a, x) => a + (x.openFindings || 0), 0,
    ),
  };

  if (!token) {
    return (
      <main className="login-screen">
        <div className="login-card">
          <div className="brand-mark">B</div>
          <div className="eyebrow">BRAND GOVERNANCE PLATFORM</div>
          <h1>Welcome to <span>Brandora</span></h1>
          <p className="muted">Keep every brand message consistent, compliant and on-brand.</p>
          <label>Email address</label>
          <input value={email} onChange={e => setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          {error && <div className="alert error">{error}</div>}
          <button className="primary full" onClick={login} disabled={loading}>
            {loading ? "Signing in..." : "Sign in →"}
          </button>
          <p className="muted small">Brandora · Powered by ReCheck</p>
        </div>
      </main>
    );
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div><strong>brandora</strong><small>by ReCheck</small></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {visibleNav.map(n => (
            <button key={n.id} className={`nav-item ${tab === n.id ? "active" : ""}`}
              onClick={() => { setTab(n.id); setError(""); }}>
              <span className="nav-icon">{n.icon}</span>{n.label}
              {n.id === "reviews" && queue.length > 0 && <span className="nav-count">{queue.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-avatar">{user?.name?.[0]?.toUpperCase() || "U"}</div>
          <div className="user-info"><strong>{user?.name}</strong><small>{pretty(role)}</small></div>
          <button className="icon-button" onClick={logout} title="Logout">↪</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="muted">Workspace / </span><strong>{nav.find(n => n.id === tab)?.label || "Content"}</strong></div>
          <div className="top-right"><span className="status-dot"/> System operational <span className="avatar">{user?.name?.[0]}</span></div>
        </header>

        <div className="page">
          {message && <div className="alert success" onClick={() => setMessage("")}>{message} ×</div>}
          {error && <div className="alert error" onClick={() => setError("")}>{error} ×</div>}

          {tab === "dashboard" && <>
            <div className="page-heading">
              <div><div className="eyebrow">YOUR BRAND WORKSPACE</div><h1>Good to see you, {user?.name?.split(" ")[0]}.</h1>
              <p>Here's what's happening across your brand content.</p></div>
              <button className="primary" onClick={() => setTab("audit")}>＋ New audit</button>
            </div>
            <div className="stats-grid">
              <Stat label="Total content" value={stats.total} icon="▤"/>
              <Stat label="Pending reviews" value={stats.review} icon="◷"/>
              <Stat label="Approved" value={stats.approved} icon="✓"/>
              <Stat label="Open findings" value={stats.flagged} icon="⚑"/>
            </div>
            <div className="section-heading"><h2>Recent content</h2><button className="text-button" onClick={() => setTab("content")}>View all →</button></div>
            <ContentTable items={items.slice(0,6)} onOpen={openContent}/>
            <div className="tip"><span>✦</span><div><strong>Brand-first. Every time.</strong><p>Brandora checks content against approved claims, terminology and brand guidelines before it goes live.</p></div></div>
          </>}

          {tab === "audit" && <>
            <div className="page-heading"><div><div className="eyebrow">CONTENT INTELLIGENCE</div><h1>Content audit</h1><p>Check your copy against your brand's approved knowledge.</p></div></div>
            <div className="editor-grid">
              <section className="panel">
                <div className="panel-heading"><h2>Content input</h2><span className="pill">New audit</span></div>
                <label>Campaign / content title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Summer launch campaign"/>
                <label>Marketing copy</label><textarea className="copy-editor" value={content} onChange={e => setContent(e.target.value)} placeholder="Paste your content here..." rows={13}/>
                <div className="editor-footer"><span>{content.length} characters</span><button className="primary" disabled={loading || !content.trim()} onClick={audit}>{loading ? "Analyzing..." : "✦ Run brand audit"}</button></div>
              </section>
              <section className="panel audit-info"><div className="panel-heading"><h2>Audit coverage</h2></div>
                {["Approved claims & factual accuracy","Terminology consistency","Brand tone & guidelines","Evidence-backed AI findings"].map((x,i)=><div className="coverage" key={x}><span className="coverage-icon">{["✓","⌘","◈","✦"][i]}</span>{x}<span className="check">✓</span></div>)}
                <div className="note"><strong>How it works</strong><p>Rules detect risky language. RAG retrieves relevant brand knowledge. AI explains findings with evidence.</p></div>
              </section>
            </div>
            {selected && <AuditDetail selected={selected} findings={findings} onUpdate={updateFinding} onSubmit={submitContent}/>}
          </>}

          {tab === "content" && <>
            <div className="page-heading"><div><div className="eyebrow">CONTENT LIBRARY</div><h1>My content</h1><p>Track audits, versions and approval status.</p></div><button className="primary" onClick={() => {setSelected(null);setTab("audit")}}>＋ New content</button></div>
            <ContentTable items={items} onOpen={openContent}/>
            {selected && <AuditDetail selected={selected} findings={findings} onUpdate={updateFinding} onSubmit={submitContent}/>}
          </>}

          {tab === "reviews" && <>
            <div className="page-heading"><div><div className="eyebrow">QUALITY CONTROL</div><h1>Review queue</h1><p>Review audited content before it gets approved.</p></div></div>
            <ContentTable items={queue} onOpen={openContent}/>
            {selected && <AuditDetail selected={selected} findings={findings} onUpdate={updateFinding} onSubmit={submitContent} canReview onReview={review} reviewNote={reviewNote} setReviewNote={setReviewNote}/>}
          </>}

          {tab === "rules" && <>
            <div className="page-heading"><div><div className="eyebrow">BRAND KNOWLEDGE BASE</div><h1>Brand rules</h1><p>Manage the approved knowledge that powers your audits.</p></div><button className="secondary" onClick={syncKnowledge}>↻ Sync RAG</button></div>
            <div className="rules-grid">
              <RulePanel title="Approved claims" items={rules} value={newRule} setValue={setNewRule} add={addClaim} field="claim"/>
              <RulePanel title="Terminology" items={terms} value={newTerm} setValue={setNewTerm} add={addTerm} field="term"/>
            </div>
            <section className="panel"><div className="panel-heading"><h2>Brand guidelines</h2></div>{guidelines.length ? guidelines.map((g,i)=><div className="rule-row" key={g.id||i}>{g.title||g.name||g.category||"Guideline"}<span className="pill">{g.category||"guideline"}</span></div>) : <p className="muted">No guidelines returned yet. Configure them in your backend.</p>}</section>
          </>}

          {tab === "analytics" && <>
            <div className="page-heading"><div><div className="eyebrow">BRAND PERFORMANCE</div><h1>Analytics</h1><p>Understand your content quality and review outcomes.</p></div><button className="secondary" onClick={loadAnalytics}>↻ Refresh</button></div>
            <section className="panel"><div className="panel-heading"><h2>Backend analytics</h2><span className="pill">Live API</span></div><pre className="json">{JSON.stringify(analytics,null,2)}</pre></section>
          </>}
        </div>
      </main>
    </div>
  );
}

function Stat({label,value,icon}: {label:string;value:number;icon:string}) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-foot">Across your workspace</div></div>;
}

function ContentTable({items,onOpen}: {items:ContentItem[];onOpen:(id:string)=>void}) {
  return <section className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>CONTENT</th><th>STATUS</th><th>FINDINGS</th><th></th></tr></thead><tbody>
    {items.map(x=><tr key={x.id}><td><strong>{x.title}</strong><small className="row-id">{x.id}</small></td><td><span className={`pill ${statusColor(x.status)}`}>{pretty(x.status)}</span></td><td>{x.openFindings ?? "—"}</td><td><button className="text-button" onClick={()=>onOpen(x.id)}>Open →</button></td></tr>)}
    {!items.length && <tr><td colSpan={4} className="empty">No content yet. Run your first audit.</td></tr>}
  </tbody></table></div></section>;
}

function AuditDetail({selected,findings,onUpdate,onSubmit,canReview,onReview,reviewNote,setReviewNote}:any) {
  const item=selected.item;
  return <section className="panel detail-panel"><div className="panel-heading"><div><div className="eyebrow">AUDIT REPORT</div><h2>{item?.title}</h2></div><span className={`pill ${statusColor(item?.status)}`}>{pretty(item?.status)}</span></div>
    <div className="detail-meta">Content ID: <code>{item?.id}</code></div>
    <div className="finding-summary"><strong>{findings.length}</strong><span>findings detected</span><span className="summary-spacer"/><strong>{findings.filter((f:Finding)=>f.severity==="high").length}</strong><span>high severity</span></div>
    {findings.map((f:Finding,i)=><article className="finding-card" key={f.id||i}><div className="finding-top"><strong>{pretty(f.type)}</strong><span className={`pill ${f.severity==="high"?"red":f.severity==="medium"?"orange":"green"}`}>{f.severity}</span></div><blockquote>{f.span}</blockquote><p>{f.explanation}</p>{f.evidence?.map((e:any,j)=><div className="evidence" key={j}>Evidence: {e.excerpt}</div>)}{f.suggestion&&<div className="suggestion">Suggestion: {f.suggestion}</div>}<small className="muted">Source: {f.source||"unknown"} · Confidence: {Math.round((f.confidence||0)*100)}%</small>
      {f.status==="open"&&<div className="finding-actions"><button className="secondary small-btn" onClick={()=>onUpdate(f,"accepted")}>Accept finding</button><button className="danger small-btn" onClick={()=>onUpdate(f,"rejected")}>Reject finding</button></div>}</article>)}
    {item?.status==="audited"&&<button className="primary" onClick={()=>onSubmit(item.id)}>Submit for review →</button>}
    {canReview&&item?.status==="in_review"&&<div className="review-actions"><label>Reviewer note</label><textarea rows={3} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder="Add review feedback..."/><button className="primary" onClick={()=>onReview(item.id,"approve")}>✓ Approve</button><button className="danger" onClick={()=>onReview(item.id,"changes")}>Request changes</button></div>}
  </section>;
}

function RulePanel({title,items,value,setValue,add,field}:any) {
  return <section className="panel"><div className="panel-heading"><h2>{title}</h2><span className="pill">{items.length}</span></div><div className="rule-list">{items.map((x:Rule,i)=><div className="rule-row" key={x.id||x._id||i}>{x[field]||x.name||x.text||x.phrase||"Brand rule"}<span className="pill green">Approved</span></div>)}{!items.length&&<p className="muted">No entries yet.</p>}</div><div className="rule-add"><input value={value} onChange={e=>setValue(e.target.value)} placeholder={`Add ${field}...`}/><button className="primary" onClick={add}>＋ Add</button></div></section>;
}
