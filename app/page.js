"use client";
import { useState, useEffect, useCallback } from "react";

import { api, post, initials, scoreLabel, STATUSES } from "./ui";
import { SkillGap, Ats, Questions, ScheduleForm, Invite, Interviews, Compare, Assistant, Analytics } from "./features";
import { AuthScreen, Profile, ParsedProfile, MyResumes, JobBoard, Applications, Career } from "./portal";
import { Jobs, Admin } from "./admin";

/* ---------------- Dashboard ---------------- */
function Dashboard({ openCandidate, go }) {
  const [cands, setCands] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/api/candidates"), api("/api/jobs")])
      .then(([c, j]) => { setCands(c); setJobs(j); })
      .catch((e) => setError(e.message));
  }, []);

  // Numbers for the stat cards, pipeline and score distribution
  const count = (st) => cands.filter((c) => c.status === st).length;
  const avg = cands.length ? Math.round(cands.reduce((a, c) => a + c.score, 0) / cands.length) : 0;
  const buckets = [
    ["90 - 100", (c) => c.score >= 90],
    ["80 - 89", (c) => c.score >= 80 && c.score < 90],
    ["70 - 79", (c) => c.score >= 70 && c.score < 80],
    ["50 - 69", (c) => c.score >= 50 && c.score < 70],
    ["Below 50", (c) => c.score < 50],
  ];
  const stats = [
    ["💼", "Open jobs", jobs.length],
    ["👥", "Candidates screened", cands.length],
    ["⭐", "Shortlisted", count("Shortlisted")],
    ["🎯", "Average match", avg + "%"],
  ];
  const pct = (n) => (cands.length ? Math.round((n / cands.length) * 100) : 0);

  return (
    <>
      <div className="top">
        <div><h1>Dashboard</h1><p className="muted">Welcome back — here is your screening overview</p></div>
        <button className="btn primary" onClick={() => go("jobs")}>+ New Job / Upload Resumes</button>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="stats">
        {stats.map(([icon, label, value]) => (
          <div className="card stat" key={label}>
            <div className="ico">{icon}</div>
            <div><span className="muted">{label}</span><b>{value}</b></div>
          </div>
        ))}
      </div>

      {/* Featured best match, in the style of the match-details screen */}
      {cands[0] && (() => {
        const c = cands[0];
        const circ = 2 * Math.PI * 46;
        return (
          <div className="card feature">
            <div className="profile" style={{ flex: "1 1 220px" }}>
              <div className="avatar">{initials(c.name)}</div>
              <div>
                <span className="tag">AI Parsed</span>
                <h3 style={{ margin: "4px 0 2px" }}>{c.name}</h3>
                <p className="muted">{c.title} • {c.yearsExp} yrs</p>
                <p className="muted">{c.location}</p>
                <p className="muted">Best match for <b>{c.jobTitle}</b></p>
              </div>
            </div>
            <div className="ring" style={{ width: 110, height: 110 }}>
              <svg width="110" height="110">
                <circle cx="55" cy="55" r="46" fill="none" stroke="#ecebf8" strokeWidth="10" />
                <circle cx="55" cy="55" r="46" fill="none" stroke="#4f2fd6" strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - c.score / 100)} />
              </svg>
              <div><b style={{ fontSize: 24 }}>{c.score}%</b><small>{scoreLabel(c.score).toUpperCase()}</small></div>
            </div>
            <div style={{ flex: "1 1 260px" }}>
              <h3>Why this candidate matches</h3>
              <ul className="checks">{c.reasons.slice(0, 3).map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
            <div style={{ flex: "0 0 auto" }}>
              <button className="btn primary" onClick={() => openCandidate(c.id)}>View Match Details →</button>
            </div>
          </div>
        );
      })()}

      <div className="dash">
        {/* Top matches across all jobs */}
        <div className="card scroll">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>Top Matches</h3>
            <a className="link" style={{ flex: "0 0 auto" }} onClick={() => go("candidates")}>View all →</a>
          </div>
          {cands.length === 0 ? (
            <p className="muted">No candidates yet. Create a job and upload resumes to get started.</p>
          ) : (
            <table>
              <thead><tr><th>Candidate</th><th>Job</th><th>Match</th><th>Status</th></tr></thead>
              <tbody>
                {cands.slice(0, 7).map((c) => (
                  <tr key={c.id} className="click" onClick={() => openCandidate(c.id)}>
                    <td>
                      <div className="sim" style={{ padding: 0, cursor: "inherit" }}>
                        <div className="avatar sm">{initials(c.name)}</div>
                        <div><b>{c.name}</b><div className="muted">{c.title}</div></div>
                      </div>
                    </td>
                    <td>{c.jobTitle}</td>
                    <td style={{ minWidth: 130 }}>
                      <div className="bar" style={{ margin: 0 }}>
                        <span className="track"><i className={c.score < 70 ? "low" : ""} style={{ width: c.score + "%" }} /></span>
                        <b style={{ width: 40, textAlign: "right" }}>{c.score}%</b>
                      </div>
                    </td>
                    <td><span className={"badge " + c.status}>{c.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pipeline by status */}
        <div className="card">
          <h3>Hiring Pipeline</h3>
          {STATUSES.map((s) => (
            <div key={s} style={{ marginBottom: 14 }}>
              <div className="kv" style={{ fontSize: 13 }}><span>{s}</span><b>{count(s)}</b></div>
              <div className="track"><i style={{ width: pct(count(s)) + "%", background: s === "Shortlisted" ? "var(--green)" : s === "Review" ? "var(--amber)" : "var(--red)" }} /></div>
            </div>
          ))}
          <h3 style={{ marginTop: 22 }}>Score Distribution</h3>
          {buckets.map(([label, test]) => {
            const n = cands.filter(test).length;
            return (
              <div className="bar" key={label} style={{ margin: "8px 0" }}>
                <span style={{ width: 70, fontSize: 12 }}>{label}</span>
                <span className="track"><i style={{ width: pct(n) + "%" }} /></span>
                <span style={{ width: 30 }}>{n}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Jobs overview */}
      <div className="card scroll">
        <h3>Jobs Overview</h3>
        <table>
          <thead><tr><th>Job</th><th>Location</th><th>Candidates</th><th>Shortlisted</th><th>Top score</th></tr></thead>
          <tbody>
            {jobs.map((j) => {
              const mine = cands.filter((c) => c.jobId === j.id);
              return (
                <tr key={j.id} className="click" onClick={() => go("jobs")}>
                  <td><b>{j.title}</b></td>
                  <td>{j.location || "Remote"}</td>
                  <td>{mine.length}</td>
                  <td>{mine.filter((c) => c.status === "Shortlisted").length}</td>
                  <td>{mine.length ? Math.max(...mine.map((c) => c.score)) + "%" : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && <p className="muted" style={{ padding: 12 }}>No jobs yet.</p>}
      </div>
    </>
  );
}

/* ---------------- Candidates (search, filter, report) ---------------- */
function Candidates({ openCandidate }) {
  const [rows, setRows] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState({ q: "", jobId: "", status: "" });
  const [error, setError] = useState("");

  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();

  useEffect(() => { api("/api/jobs").then(setJobs).catch(() => {}); }, []);
  useEffect(() => {
    api("/api/candidates?" + qs).then(setRows).catch((e) => setError(e.message));
  }, [qs]);

  return (
    <>
      <div className="top">
        <div><h1>Candidates</h1><p className="muted">Ranked by match score</p></div>
        <a className="btn" href={"/api/report?" + qs}>Download Report (CSV)</a>
      </div>
      <div className="card">
        <div className="row">
          <input placeholder="Search name, email, title..." value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <select value={filters.jobId} onChange={(e) => setFilters({ ...filters, jobId: e.target.value })}>
            <option value="">All jobs</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card scroll">
        <table>
          <thead><tr><th>#</th><th>Candidate</th><th>Job</th><th>Score</th><th>Matched skills</th><th>Missing skills</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} className="click" onClick={() => openCandidate(c.id)}>
                <td>{i + 1}</td>
                <td><b>{c.name}</b><div className="muted">{c.fileName}</div></td>
                <td>{c.jobTitle}</td>
                <td><b>{c.score}%</b></td>
                <td>{c.matched.map((s) => <span className="tag" key={s}>{s}</span>)}</td>
                <td>{c.missing.map((s) => <span className="tag miss" key={s}>{s}</span>)}</td>
                <td><span className={"badge " + c.status}>{c.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted" style={{ padding: 12 }}>No candidates found.</p>}
      </div>
    </>
  );
}

/* ---------------- Match details (like the HireAI design) ---------------- */
function Detail({ id, back, openCandidate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("match");
  const [invite, setInvite] = useState(null);

  const load = useCallback(() => {
    api("/api/candidates?id=" + id).then(setData).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { setData(null); setTab("match"); setInvite(null); load(); }, [load]);

  async function setStatus(status) {
    try {
      await post("/api/candidates", { id, status }, "PATCH");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading...</p>;

  const { candidate: c, rank, total, similar } = data;
  const circ = 2 * Math.PI * 62;
  const breakdown = [
    ["Skills", "Technical and tool-based capabilities", c.skillsScore],
    ["Experience", "Years and depth of relevant experience", c.experienceScore],
    ["Domain", "Industry and problem domain alignment", c.domainScore],
  ];
  const detailed = [
    ["Skills", "Programming languages, frameworks, tools, databases, cloud, etc.", c.strengths.skills, c.skillsScore],
    ["Experience", "Years of experience and relevance to the role", c.strengths.experience, c.experienceScore],
    ["Domain", "Industry knowledge, problem domain, use cases", c.strengths.domain, c.domainScore],
    ["Education", "Educational background relevance", c.strengths.education, c.educationScore],
  ];

  return (
    <>
      <div className="crumbs"><a onClick={back}>← Candidates</a> &nbsp;›&nbsp; {c.name} &nbsp;›&nbsp; <b>Match Details</b></div>
      <div className="top">
        <div>
          <h1>Semantic JD Matching</h1>
          <p className="muted">Job: {c.jobTitle} • Location: {c.jobLocation || "Remote"}</p>
        </div>
        <button className="btn" onClick={back}>← Back to Candidates</button>
      </div>

      <div className="tabs">
        {[["match", "Match Overview"], ["profile", "Resume Profile"], ["gap", "Skill Gap"], ["ats", "ATS Analysis"], ["questions", "Interview Questions"], ["schedule", "Schedule"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "profile" && <ParsedProfile parsed={c.parsed} />}
      {tab === "gap" && <SkillGap id={id} />}
      {tab === "ats" && <Ats id={id} />}
      {tab === "questions" && <Questions id={id} />}
      {tab === "schedule" && (
        <>
          {invite && <Invite invite={invite} close={() => setInvite(null)} />}
          <ScheduleForm candidates={[c]} defaultId={c.id} onDone={(r) => setInvite(r.invite)} />
        </>
      )}

      {tab === "match" && <div className="grid3">
        {/* Left: profile, job, matching info */}
        <div>
          <div className="card">
            <div className="profile">
              <div className="avatar">{initials(c.name)}</div>
              <div><h3 style={{ margin: 0 }}>{c.name}</h3><p className="muted">{c.title || "—"}{c.yearsExp ? ` • ${c.yearsExp} yrs` : ""}</p><p className="muted">{c.location}</p></div>
            </div>
            <div className="info">✉ {c.email || "—"}<br />☎ {c.phone || "—"}</div>
            <div className="info">📄 {c.fileName}</div>
          </div>
          <div className="card">
            <h3>Job Description</h3>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>{c.jobTitle}</p>
            <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{c.jobDescription}</p>
          </div>
          <div className="card">
            <h3>Matching Details</h3>
            <div className="kv"><span>Matched on</span><span>{new Date(c.createdAt).toLocaleString()}</span></div>
            <div className="kv"><span>Matching model</span><span>gpt-4o-mini</span></div>
            <div className="kv"><span>Match ID</span><span>match_{String(c.id).padStart(6, "0")}</span></div>
          </div>
        </div>

        {/* Middle: score + breakdown */}
        <div>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Overall Match Score</h3>
              <span className="tag" style={{ flex: "0 0 auto" }}>{c.score >= 80 ? "Strong Semantic Match" : c.score >= 50 ? "Partial Match" : "Weak Match"}</span>
            </div>
            <div className="scorebox">
              <div>
                <div className="ring">
                  <svg width="150" height="150">
                    <circle cx="75" cy="75" r="62" fill="none" stroke="#ecebf8" strokeWidth="12" />
                    <circle cx="75" cy="75" r="62" fill="none" stroke="#4f2fd6" strokeWidth="12" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - c.score / 100)} />
                  </svg>
                  <div><b>{c.score}%</b><small>{scoreLabel(c.score).toUpperCase()} MATCH</small></div>
                </div>
                <p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 6 }}>Rank {rank} of {total} for this job</p>
              </div>
              <div className="bars">
                <h3>Score Breakdown</h3>
                {breakdown.map(([label, sub, val]) => (
                  <div key={label}>
                    <div className="bar"><span>{label}</span><span className="track"><i style={{ width: val + "%" }} /></span><span>{val}%</span></div>
                    <p className="muted" style={{ fontSize: 11, marginTop: -6 }}>{sub}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="note">This match is based on semantic understanding of the job requirements and candidate background. We analyze meaning, context and relationships — not just keywords.</div>
          </div>

          <div className="card scroll">
            <h3>Detailed Score Breakdown</h3>
            <table>
              <thead><tr><th>Category</th><th>What we look for</th><th>Candidate strength</th><th>Score</th></tr></thead>
              <tbody>
                {detailed.map(([cat, look, tags, val]) => (
                  <tr key={cat}>
                    <td><b>{cat}</b></td>
                    <td className="muted">{look}</td>
                    <td>{(tags || []).map((t) => <span className="tag" key={t}>{t}</span>)}</td>
                    <td><b>{val}%</b><div className="muted">{scoreLabel(val)}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: reasons, skills, similar */}
        <div>
          <div className="card">
            <h3>Why This Candidate Matches</h3>
            <ul className="checks">{c.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
          <div className="card">
            <h3>Skills Overlap</h3>
            {c.skillOverlap.map((s) => (
              <div className="bar" key={s.skill} style={{ margin: "8px 0" }}>
                <span style={{ width: 90, fontWeight: 600, fontSize: 12 }}>{s.skill}</span>
                <span className="track"><i className={s.match < 70 ? "low" : ""} style={{ width: s.match + "%" }} /></span>
                <span style={{ width: 40 }}>{s.match}%</span>
              </div>
            ))}
            {c.skillOverlap.length === 0 && <p className="muted">No skills data.</p>}
          </div>
          <div className="card">
            <h3>Similar Candidates</h3>
            {similar.map((s) => (
              <div className="sim" key={s.id} onClick={() => openCandidate(s.id)}>
                <div className="avatar sm">{initials(s.name)}</div>{s.name}<b>{s.score}%</b>
              </div>
            ))}
            {similar.length === 0 && <p className="muted">No other candidates for this job.</p>}
          </div>
        </div>
      </div>}

      {/* AI recommendation + HR decision */}
      <div className="reco">
        <div>
          <h3>★ AI Recommendation: {c.recommendation}</h3>
          <p>{c.summary}</p>
          <p className="muted" style={{ marginTop: 4 }}>Current status: <span className={"badge " + c.status}>{c.status}</span></p>
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => setStatus("Shortlisted")}>Add to Shortlist</button>
          <button className="btn" onClick={() => setStatus("Review")}>Move to Review</button>
          <button className="btn danger" onClick={() => setStatus("Rejected")}>Not a Fit</button>
        </div>
      </div>
    </>
  );
}

/* ---------------- App shell (role-based navigation) ---------------- */
const STAFF_NAV = [
  ["dashboard", "▦  Dashboard"], ["jobs", "💼  Jobs"], ["candidates", "👥  Candidates"], ["compare", "⚖️  Compare"],
  ["interviews", "📅  Interviews"], ["assistant", "🤖  HR Assistant"], ["analytics", "📊  Analytics"], ["profile", "🏢  Company"],
];
const CANDIDATE_NAV = [
  ["resumes", "📄  My Resumes"], ["board", "🔎  Job Board"], ["applications", "📌  Applications"], ["career", "✨  Career Assistant"], ["profile", "👤  Profile"],
];

export default function Home() {
  const [user, setUser] = useState(undefined); // undefined = checking session, null = logged out
  const [view, setView] = useState("");
  const [candidateId, setCandidateId] = useState(null);
  const [blind, setBlind] = useState(false); // blind screening: server hides names/contact details
  const [ver, setVer] = useState(0); // bump to remount the page and refetch after toggling blind mode

  useEffect(() => {
    api("/api/login").then((d) => { setUser(d.user); setBlind(!!d.blind); }).catch(() => setUser(null));
  }, []);

  async function toggleBlind() {
    const r = await post("/api/blind", { on: !blind });
    setBlind(r.blind);
    setVer((v) => v + 1);
  }

  const openCandidate = (id) => { setCandidateId(id); setView("detail"); };

  async function logout() {
    await api("/api/login", { method: "DELETE" }).catch(() => {});
    setUser(null);
    setView("");
  }

  if (user === undefined) return <p style={{ padding: 24 }}>Loading...</p>;
  if (!user) return <AuthScreen onLogin={(u) => { setUser(u); setView(""); }} />;

  const isCandidate = user.role === "candidate";
  const nav = isCandidate ? CANDIDATE_NAV : [...STAFF_NAV, ...(user.role === "admin" ? [["admin", "🛡️  Admin"]] : [])];
  const current = view || nav[0][0];

  return (
    <div className="app">
      <aside className="side">
        <div className="logo"><i>H</i>HireSense<span> AI</span></div>
        {nav.map(([key, label]) => (
          <button key={key} className={"nav" + ((current === key || (current === "detail" && key === "candidates")) ? " on" : "")} onClick={() => setView(key)}>
            {label}
          </button>
        ))}
        {!isCandidate && (
          <label className="blind" title="Hide names, emails and phone numbers while screening">
            <input type="checkbox" checked={blind} onChange={toggleBlind} /> Blind screening
          </label>
        )}
        <div className="me">
          <div className="avatar sm">{initials(user.name)}</div>
          <div>{user.name}<small style={{ textTransform: "capitalize" }}>{user.role}</small></div>
          <button onClick={logout} title="Log out">⎋</button>
        </div>
      </aside>
      <main className="main" key={ver}>
        {current === "dashboard" && <Dashboard openCandidate={openCandidate} go={setView} />}
        {current === "jobs" && <Jobs user={user} />}
        {current === "candidates" && <Candidates openCandidate={openCandidate} />}
        {current === "compare" && <Compare />}
        {current === "interviews" && <Interviews openCandidate={openCandidate} />}
        {current === "assistant" && <Assistant />}
        {current === "analytics" && <Analytics blind={blind} />}
        {current === "admin" && <Admin me={user} />}
        {current === "detail" && <Detail id={candidateId} back={() => setView("candidates")} openCandidate={openCandidate} />}
        {current === "profile" && <Profile user={user} onSaved={setUser} />}
        {current === "resumes" && <MyResumes />}
        {current === "board" && <JobBoard />}
        {current === "applications" && <Applications />}
        {current === "career" && <Career />}
      </main>
    </div>
  );
}
