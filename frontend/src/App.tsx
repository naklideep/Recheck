
import { useEffect, useState } from "react";
import api, { setToken } from "./api";
import "./index.css";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type ContentItem = {
  id: string;
  _id?: string;
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
  claimText?: string;
  forbidden?: string;
  preferred?: string;
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
  s === "approved"
    ? "green"
    : s === "in_review"
    ? "blue"
    : s === "changes_requested"
    ? "orange"
    : s === "audited"
    ? "purple"
    : "gray";

const pretty = (s: string) =>
  (s || "unknown").replaceAll("_", " ");

function getStoredUser(): User | null {
  try {
    const stored = localStorage.getItem("recheck_user");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [token, setTokenState] = useState(
    () => localStorage.getItem("token") ?? ""
  );

  const [user, setUser] = useState<User | null>(getStoredUser);
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
  const [guidelines, setGuidelines] = useState("");
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

  // AUTHENTICATION

  async function login() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await api.post("/auth/login", {
        email,
        password,
      });

      const newToken = res.data.token;
      const loggedInUser = res.data.user;

      if (!newToken || !loggedInUser) {
        throw new Error("Invalid login response from server");
      }

      setToken(newToken);
      setTokenState(newToken);

      localStorage.setItem(
        "recheck_user",
        JSON.stringify(loggedInUser)
      );

      setUser(loggedInUser);
      setMessage("Welcome back to RECHECK!");
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Login failed"
      );
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setToken("");
    setTokenState("");

    localStorage.removeItem("recheck_user");

    setUser(null);
    setSelected(null);
    setFindings([]);
    setItems([]);
    setQueue([]);
    setRules([]);
    setTerms([]);
    setGuidelines("");
    setAnalytics(null);

    setTab("dashboard");
    setMessage("Logged out successfully");
    setError("");
  }

  // CONTENT LIBRARY

  async function loadContent() {
    const res = await api.get("/content");
    const data = res.data;

    const rawItems = Array.isArray(data)
      ? data
      : data?.items || data?.data || [];

    const normalized: ContentItem[] = rawItems.map(
      (item: any) => ({
        ...item,
        id: item.id || item._id,
      })
    );

    setItems(normalized);

    setQueue(
      normalized.filter(
        (item) => item.status === "in_review"
      )
    );
  }

  async function openContent(
    id: string,
    destination: Tab = "content"
  ) {
    try {
      const res = await api.get(`/content/${id}`);

      const detail = res.data;

      if (detail?.item) {
        detail.item.id =
          detail.item.id || detail.item._id;
      }

      setSelected(detail);
      setFindings(detail.findings || []);
      setTab(destination);
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Could not open content"
      );
    }
  }

  // BRAND KNOWLEDGE

  async function loadRules() {
    try {
      const [claimsResponse, termsResponse, guidelinesResponse] =
        await Promise.all([
          api.get("/claims"),
          api.get("/terms"),
          api.get("/guidelines"),
        ]);

      const claims = claimsResponse.data;
      const terminology = termsResponse.data;

      setRules(
        Array.isArray(claims)
          ? claims
          : claims?.claims || []
      );

      setTerms(
        Array.isArray(terminology)
          ? terminology
          : terminology?.terms || []
      );

      setGuidelines(
        guidelinesResponse.data?.body || ""
      );
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Could not load brand knowledge"
      );
    }
  }

  async function addClaim() {
    if (!newRule.trim()) return;

    try {
      await api.post("/claims", {
        claimText: newRule.trim(),
        sourceRef: "Manually added brand claim",
        validUntil: "",
      });

      setNewRule("");
      await loadRules();

      setMessage("Approved claim added");
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Could not add claim"
      );
    }
  }

  async function addTerm() {
    if (!newTerm.trim()) return;

    try {
      await api.post("/terms", {
        forbidden: newTerm.trim(),
        preferred: "",
        note: "",
      });

      setNewTerm("");
      await loadRules();

      setMessage("Terminology rule added");
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Could not add term"
      );
    }
  }

  async function saveGuidelines() {
    try {
      await api.put("/guidelines", {
        body: guidelines,
      });

      setMessage("Brand guidelines saved");
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Could not save guidelines"
      );
    }
  }

  async function syncKnowledge() {
    try {
      await api.post("/rag/sync");

      setMessage(
        "Brand knowledge synchronized with RAG"
      );
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "RAG synchronization failed"
      );
    }
  }

  // CONTENT AUDIT

  async function audit() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const res = await api.post("/content", {
        title,
        text: content,
      });

      await loadContent();

      if (res.data?.id) {
        await openContent(res.data.id, "audit");
      }

      setMessage("Audit completed successfully");
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Audit failed"
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitContent(id: string) {
    setLoading(true);

    try {
      await api.post(`/content/${id}/submit`);

      await loadContent();
      await openContent(id, tab);

      setMessage("Submitted for review successfully");
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Submission failed"
      );
    } finally {
      setLoading(false);
    }
  }

  // FINDINGS

  async function updateFinding(
    finding: Finding,
    status: string
  ) {
    if (!finding.id) return;

    const reason =
      status === "rejected"
        ? window.prompt(
            "Reason for rejecting this finding?"
          )
        : "";

    if (status === "rejected" && !reason?.trim()) {
      return;
    }

    try {
      await api.patch(`/findings/${finding.id}`, {
        status,
        reason,
      });

      if (selected?.item?.id) {
        await openContent(selected.item.id, tab);
      }

      setMessage("Finding updated successfully");
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Could not update finding"
      );
    }
  }

  // REVIEW WORKFLOW

  async function review(
    id: string,
    decision: "approve" | "changes"
  ) {
    try {
      const res = await api.post(
        `/content/${id}/review`,
        {
          decision,
          note: reviewNote,
        }
      );

      setReviewNote("");

      await loadContent();
      await openContent(id, "reviews");

      setMessage(
        `Review completed: ${pretty(res.data.status)}`
      );
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Review failed"
      );
    }
  }

  // ANALYTICS

  async function loadAnalytics() {
    try {
      const res = await api.get("/analytics");
      setAnalytics(res.data);
    } catch (e: any) {
      setError(
        e.response?.data?.detail ||
        e.message ||
        "Analytics unavailable"
      );
    }
  }

  // INITIAL DATA LOADING

  useEffect(() => {
    if (!token) return;

    loadContent().catch((e: any) => {
      setError(
        e.message || "Could not load content"
      );
    });
  }, [token]);

  useEffect(() => {
    if (!token) return;

    if (tab === "rules") {
      loadRules();
    }

    if (tab === "analytics") {
      loadAnalytics();
    }
  }, [tab, token]);

  // DASHBOARD DATA

  const visibleNav = nav.filter((item) => {
    if (item.id === "reviews") return canReview;
    if (item.id === "rules") return canManage;
    return true;
  });

  const stats = {
    total: items.length,

    review: items.filter(
      (item) => item.status === "in_review"
    ).length,

    approved: items.filter(
      (item) => item.status === "approved"
    ).length,

    flagged: items.reduce(
      (total, item) =>
        total + (item.openFindings || 0),
      0
    ),
  };

  // LOGIN SCREEN

  if (!token) {
    return (
      <main className="login-screen">
        <div className="login-card">
          <div className="brand-mark">R</div>

          <div className="eyebrow">
            AI-POWERED BRAND GOVERNANCE
          </div>

          <h1>
            Welcome to <span>RECHECK</span>
          </h1>

          <p className="muted">
            Keep every brand message consistent,
            compliant and on-brand.
          </p>

          <label>Email address</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
          />

          <label>Password</label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            onKeyDown={(e) => {
              if (e.key === "Enter") login();
            }}
          />

          {error && (
            <div className="alert error">
              {error}
            </div>
          )}

          <button
            className="primary full"
            onClick={login}
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in →"}
          </button>

          <p className="muted small">
            RECHECK · Brand governance intelligence
          </p>
        </div>
      </main>
    );
  }

  // MAIN APPLICATION

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>

          <div>
            <strong>RECHECK</strong>
            <small>Brand Governance</small>
          </div>
        </div>

        <div className="workspace-label">
          WORKSPACE
        </div>

        <nav>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${
                tab === item.id ? "active" : ""
              }`}
              onClick={() => {
                setTab(item.id);
                setError("");
              }}
            >
              <span className="nav-icon">
                {item.icon}
              </span>

              {item.label}

              {item.id === "reviews" &&
                queue.length > 0 && (
                  <span className="nav-count">
                    {queue.length}
                  </span>
                )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-avatar">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>

          <div className="user-info">
            <strong>{user?.name || "User"}</strong>
            <small>{pretty(role)}</small>
          </div>

          <button
            className="icon-button"
            onClick={logout}
            title="Logout"
          >
            ↪
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="muted">
              Workspace /
            </span>{" "}
            <strong>
              {nav.find((item) => item.id === tab)?.label ||
                "Content"}
            </strong>
          </div>

          <div className="top-right">
            <span className="status-dot" />
            System operational

            <span className="avatar">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
        </header>

        <div className="page">
          {message && (
            <div
              className="alert success"
              onClick={() => setMessage("")}
            >
              {message} ×
            </div>
          )}

          {error && (
            <div
              className="alert error"
              onClick={() => setError("")}
            >
              {error} ×
            </div>
          )}

          {/* DASHBOARD */}

          {tab === "dashboard" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    YOUR BRAND WORKSPACE
                  </div>

                  <h1>
                    Good to see you,{" "}
                    {user?.name?.split(" ")[0]}.
                  </h1>

                  <p>
                    Here's what's happening across
                    your brand content.
                  </p>
                </div>

                <button
                  className="primary"
                  onClick={() => {
                    setSelected(null);
                    setTab("audit");
                  }}
                >
                  ＋ New audit
                </button>
              </div>

              <div className="stats-grid">
                <Stat
                  label="Total content"
                  value={stats.total}
                  icon="▤"
                />

                <Stat
                  label="Pending reviews"
                  value={stats.review}
                  icon="◷"
                />

                <Stat
                  label="Approved"
                  value={stats.approved}
                  icon="✓"
                />

                <Stat
                  label="Open findings"
                  value={stats.flagged}
                  icon="⚑"
                />
              </div>

              <div className="section-heading">
                <h2>Recent content</h2>

                <button
                  className="text-button"
                  onClick={() => setTab("content")}
                >
                  View all →
                </button>
              </div>

              <ContentTable
                items={items.slice(0, 6)}
                onOpen={(id) => openContent(id, "content")}
              />

              <div className="tip">
                <span>✦</span>

                <div>
                  <strong>
                    Brand-first. Every time.
                  </strong>

                  <p>
                    RECHECK checks content against
                    approved claims, terminology and
                    brand guidelines before it goes live.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* CONTENT AUDIT */}

          {tab === "audit" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    CONTENT INTELLIGENCE
                  </div>

                  <h1>Content audit</h1>

                  <p>
                    Check your copy against your brand's
                    approved knowledge.
                  </p>
                </div>
              </div>

              <div className="editor-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Content input</h2>
                    <span className="pill">
                      New audit
                    </span>
                  </div>

                  <label>
                    Campaign / content title
                  </label>

                  <input
                    value={title}
                    onChange={(e) =>
                      setTitle(e.target.value)
                    }
                    placeholder="e.g. Summer launch campaign"
                  />

                  <label>Marketing copy</label>

                  <textarea
                    className="copy-editor"
                    value={content}
                    onChange={(e) =>
                      setContent(e.target.value)
                    }
                    placeholder="Paste your content here..."
                    rows={13}
                  />

                  <div className="editor-footer">
                    <span>
                      {content.length} characters
                    </span>

                    <button
                      className="primary"
                      disabled={loading || !content.trim()}
                      onClick={audit}
                    >
                      {loading
                        ? "Analyzing..."
                        : "✦ Run brand audit"}
                    </button>
                  </div>
                </section>

                <section className="panel audit-info">
                  <div className="panel-heading">
                    <h2>Audit coverage</h2>
                  </div>

                  {[
                    "Approved claims & factual accuracy",
                    "Terminology consistency",
                    "Brand tone & guidelines",
                    "Evidence-backed AI findings",
                  ].map((item, index) => (
                    <div className="coverage" key={item}>
                      <span className="coverage-icon">
                        {["✓", "⌘", "◈", "✦"][index]}
                      </span>

                      {item}

                      <span className="check">✓</span>
                    </div>
                  ))}

                  <div className="note">
                    <strong>How it works</strong>

                    <p>
                      Rules detect risky language.
                      RAG retrieves relevant brand knowledge.
                      AI explains findings with evidence.
                    </p>
                  </div>
                </section>
              </div>

              {selected && (
                <AuditDetail
                  selected={selected}
                  findings={findings}
                  onUpdate={updateFinding}
                  onSubmit={submitContent}
                  loading={loading}
                />
              )}
            </>
          )}

          {/* CONTENT LIBRARY */}

          {tab === "content" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    CONTENT LIBRARY
                  </div>

                  <h1>My content</h1>

                  <p>
                    Track audits, versions and approval status.
                  </p>
                </div>

                <button
                  className="primary"
                  onClick={() => {
                    setSelected(null);
                    setTab("audit");
                  }}
                >
                  ＋ New content
                </button>
              </div>

              <ContentTable
                items={items}
                onOpen={(id) => openContent(id, "content")}
              />

              {selected && (
                <AuditDetail
                  selected={selected}
                  findings={findings}
                  onUpdate={updateFinding}
                  onSubmit={submitContent}
                  loading={loading}
                />
              )}
            </>
          )}

          {/* REVIEW QUEUE */}

          {tab === "reviews" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    QUALITY CONTROL
                  </div>

                  <h1>Review queue</h1>

                  <p>
                    Review audited content before it
                    gets approved.
                  </p>
                </div>
              </div>

              <ContentTable
                items={queue}
                onOpen={(id) => openContent(id, "reviews")}
              />

              {selected && (
                <AuditDetail
                  selected={selected}
                  findings={findings}
                  onUpdate={updateFinding}
                  onSubmit={submitContent}
                  canReview={canReview}
                  onReview={review}
                  reviewNote={reviewNote}
                  setReviewNote={setReviewNote}
                  loading={loading}
                />
              )}
            </>
          )}

          {/* BRAND KNOWLEDGE */}

          {tab === "rules" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    BRAND KNOWLEDGE BASE
                  </div>

                  <h1>Brand rules</h1>

                  <p>
                    Manage the approved knowledge that
                    powers your audits.
                  </p>
                </div>

                <button
                  className="secondary"
                  onClick={syncKnowledge}
                >
                  ↻ Sync RAG
                </button>
              </div>

              <div className="rules-grid">
                <RulePanel
                  title="Approved claims"
                  items={rules}
                  value={newRule}
                  setValue={setNewRule}
                  add={addClaim}
                  field="claimText"
                />

                <RulePanel
                  title="Terminology"
                  items={terms}
                  value={newTerm}
                  setValue={setNewTerm}
                  add={addTerm}
                  field="forbidden"
                />
              </div>

              <section className="panel">
                <div className="panel-heading">
                  <h2>Brand guidelines</h2>

                  <span className="pill">
                    {guidelines.length} characters
                  </span>
                </div>

                <textarea
                  rows={9}
                  value={guidelines}
                  onChange={(e) =>
                    setGuidelines(e.target.value)
                  }
                  placeholder="Enter your brand guidelines..."
                />

                <div className="editor-footer">
                  <span>
                    Changes are saved to your brand knowledge base.
                  </span>

                  <button
                    className="primary"
                    onClick={saveGuidelines}
                  >
                    Save guidelines
                  </button>
                </div>
              </section>
            </>
          )}

          {/* ANALYTICS */}

          {tab === "analytics" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    BRAND PERFORMANCE
                  </div>

                  <h1>Analytics</h1>

                  <p>
                    Understand your content quality
                    and review outcomes.
                  </p>
                </div>

                <button
                  className="secondary"
                  onClick={loadAnalytics}
                >
                  ↻ Refresh
                </button>
              </div>

              <section className="panel">
                <div className="panel-heading">
                  <h2>Backend analytics</h2>

                  <span className="pill">
                    Live API
                  </span>
                </div>

                <pre className="json">
                  {JSON.stringify(analytics, null, 2)}
                </pre>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// STAT CARD

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-foot">
        Across your workspace
      </div>
    </div>
  );
}

// CONTENT TABLE

function ContentTable({
  items,
  onOpen,
}: {
  items: ContentItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <section className="panel table-panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>CONTENT</th>
              <th>STATUS</th>
              <th>FINDINGS</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.title}</strong>

                  <small className="row-id">
                    {item.id}
                  </small>
                </td>

                <td>
                  <span
                    className={`pill ${statusColor(
                      item.status
                    )}`}
                  >
                    {pretty(item.status)}
                  </span>
                </td>

                <td>
                  {item.openFindings ?? "—"}
                </td>

                <td>
                  <button
                    className="text-button"
                    onClick={() => onOpen(item.id)}
                  >
                    Open →
                  </button>
                </td>
              </tr>
            ))}

            {!items.length && (
              <tr>
                <td colSpan={4} className="empty">
                  No content yet. Run your first audit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// AUDIT DETAIL

function AuditDetail({
  selected,
  findings,
  onUpdate,
  onSubmit,
  canReview,
  onReview,
  reviewNote,
  setReviewNote,
  loading,
}: any) {
  const item = selected?.item;

  if (!item) return null;

  return (
    <section className="panel detail-panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">
            AUDIT REPORT
          </div>

          <h2>{item.title}</h2>
        </div>

        <span
          className={`pill ${statusColor(item.status)}`}
        >
          {pretty(item.status)}
        </span>
      </div>

      <div className="detail-meta">
        Content ID: <code>{item.id}</code>
      </div>

      <div className="finding-summary">
        <strong>{findings.length}</strong>
        <span>findings detected</span>

        <span className="summary-spacer" />

        <strong>
          {findings.filter(
            (finding: Finding) =>
              finding.severity === "high"
          ).length}
        </strong>

        <span>high severity</span>
      </div>

      {findings.map((finding: Finding, index: number) => (
        <article
          className="finding-card"
          key={finding.id || index}
        >
          <div className="finding-top">
            <strong>{pretty(finding.type)}</strong>

            <span
              className={`pill ${
                finding.severity === "high"
                  ? "red"
                  : finding.severity === "medium"
                  ? "orange"
                  : "green"
              }`}
            >
              {finding.severity}
            </span>
          </div>

          <blockquote>
            {finding.span}
          </blockquote>

          <p>{finding.explanation}</p>

          {finding.evidence?.map((evidence, index) => (
            <div className="evidence" key={index}>
              Evidence: {evidence.excerpt}
            </div>
          ))}

          {finding.suggestion && (
            <div className="suggestion">
              Suggestion: {finding.suggestion}
            </div>
          )}

          <small className="muted">
            Source: {finding.source || "unknown"} ·
            Confidence:{" "}
            {Math.round(
              (finding.confidence || 0) * 100
            )}
            %
          </small>

          {finding.status === "open" && (
            <div className="finding-actions">
              <button
                className="secondary small-btn"
                onClick={() =>
                  onUpdate(finding, "accepted")
                }
              >
                Accept finding
              </button>

              <button
                className="danger small-btn"
                onClick={() =>
                  onUpdate(finding, "rejected")
                }
              >
                Reject finding
              </button>
            </div>
          )}
        </article>
      ))}

      {item.status === "audited" && (
        <button
          className="primary"
          disabled={loading}
          onClick={() => onSubmit(item.id)}
        >
          {loading
            ? "Submitting..."
            : "Submit for review →"}
        </button>
      )}

      {canReview && item.status === "in_review" && (
        <div className="review-actions">
          <label>Reviewer note</label>

          <textarea
            rows={3}
            value={reviewNote}
            onChange={(e) =>
              setReviewNote(e.target.value)
            }
            placeholder="Add review feedback..."
          />

          <button
            className="primary"
            onClick={() =>
              onReview(item.id, "approve")
            }
          >
            ✓ Approve
          </button>

          <button
            className="danger"
            onClick={() =>
              onReview(item.id, "changes")
            }
          >
            Request changes
          </button>
        </div>
      )}
    </section>
  );
}

// BRAND KNOWLEDGE PANEL

function RulePanel({
  title,
  items,
  value,
  setValue,
  add,
  field,
}: any) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{title}</h2>

        <span className="pill">
          {items.length}
        </span>
      </div>

      <div className="rule-list">
        {items.map((item: Rule, index: number) => (
          <div
            className="rule-row"
            key={item.id || item._id || index}
          >
            <div>
              {item[field] ||
                item.claimText ||
                item.forbidden ||
                item.name ||
                item.text ||
                item.phrase ||
                "Brand rule"}

              {field === "forbidden" && item.preferred && (
                <small className="row-id">
                  Preferred: {item.preferred}
                </small>
              )}
            </div>

            <span className="pill green">
              Approved
            </span>
          </div>
        ))}

        {!items.length && (
          <p className="muted">
            No entries yet.
          </p>
        )}
      </div>

      <div className="rule-add">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`Add ${field}...`}
        />

        <button
          className="primary"
          onClick={add}
        >
          ＋ Add
        </button>
      </div>
    </section>
  );
}
