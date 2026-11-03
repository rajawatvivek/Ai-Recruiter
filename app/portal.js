"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api, post, initials, clamp, Wait } from "./ui";
import { GapView, AtsView } from "./features";

/* ================= Login / registration ================= */
export function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", email: "", password: "", role: "candidate", company: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const data = await post(mode === "login" ? "/api/login" : "/api/register", f);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  const demo = [["Admin", "admin@hireai.com", "admin123"], ["Recruiter", "recruiter@hireai.com", "recruiter123"], ["Candidate", "candidate@hireai.com", "candidate123"]];

  return (
    <div className="login">
      <form onSubmit={submit}>
        <div className="logo"><i>H</i>HireSense<span> AI</span></div>
        <p className="muted">{mode === "login" ? "Sign in to continue" : "Create your account"}</p>
        {mode === "register" && (
          <>
            <label>I am a</label>
            <select value={f.role} onChange={set("role")}>
              <option value="candidate">Candidate (looking for jobs)</option>
              <option value="recruiter">Recruiter (hiring)</option>
            </select>
            <label>Full name</label>
            <input value={f.name} onChange={set("name")} />
            {f.role === "recruiter" && (<><label>Company</label><input value={f.company} onChange={set("company")} /></>)}
          </>
        )}
        <label>Email</label>
        <input type="email" value={f.email} onChange={set("email")} />
        <label>Password</label>
        <input type="password" value={f.password} onChange={set("password")} />
        <button className="btn primary" style={{ width: "100%", marginTop: 16 }} disabled={busy}>{busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
        {error && <p className="error">{error}</p>}
        <p className="muted" style={{ marginTop: 14, textAlign: "center" }}>
          {mode === "login" ? "New here? " : "Already registered? "}
          <a className="link" style={{ cursor: "pointer" }} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Sign in"}</a>
        </p>
        {mode === "login" && (
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <small className="muted">Demo accounts (click to fill)</small>
            <div className="row" style={{ justifyContent: "center", marginTop: 6 }}>
              {demo.map(([l, email, password]) => <button type="button" key={l} className="chip" style={{ flex: "0 0 auto" }} onClick={() => setF({ ...f, email, password })}>{l}</button>)}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

/* ================= Profile (all roles) ================= */
export function Profile({ user, onSaved }) {
  const staff = user.role !== "candidate";
  const [f, setF] = useState({ name: user.name || "", headline: user.headline || "", company: user.company || "", about: user.about || "" });
  const [msg, setMsg] = useState({ type: "", text: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    try {
      const r = await post("/api/profile", f, "PUT");
      onSaved({ ...user, ...r.user });
      setMsg({ type: "ok", text: "Profile saved." });
    } catch (err) { setMsg({ type: "error", text: err.message }); }
  }

  return (
    <>
      <div className="top"><div><h1>{staff ? "Company Profile" : "My Profile"}</h1><p className="muted">{user.email} • {user.role}</p></div></div>
      <form className="card" style={{ maxWidth: 640 }} onSubmit={save}>
        <label style={{ marginTop: 0 }}>Full name</label>
        <input value={f.name} onChange={set("name")} />
        <label>{staff ? "Your job title" : "Headline"}</label>
        <input placeholder={staff ? "e.g. Talent Acquisition Lead" : "e.g. Backend Developer | Python, AWS"} value={f.headline} onChange={set("headline")} />
        {staff && (<><label>Company name</label><input value={f.company} onChange={set("company")} /></>)}
        <label>{staff ? "About the company" : "About me"}</label>
        <textarea style={{ height: 110 }} value={f.about} onChange={set("about")} />
        <button className="btn primary" style={{ marginTop: 14 }}>Save profile</button>
        {msg.text && <p className={msg.type}>{msg.text}</p>}
      </form>
    </>
  );
}

/* ================= Structured resume profile (module 3 + hallucination control) ================= */
export function ParsedProfile({ parsed }) {
  if (!parsed) return <div className="card"><p className="muted">No structured profile is available for this resume yet.</p></div>;
  const v = parsed.verification || {};
  const list = (arr) => (Array.isArray(arr) ? arr : []);
  return (
    <>
      <div className="note" style={{ marginBottom: 16 }}>
        🛡️ <b>Hallucination check:</b> {v.checked != null ? `${v.checked - (v.removed || 0)} of ${v.checked} extracted items were confirmed in the resume text${v.removed ? `; ${v.removed} unverified item(s) were removed.` : "."}` : "Extracted details are validated against the resume text."}
      </div>
      <div className="dash">
        <div>
          <div className="card">
            <h3>Experience</h3>
            {list(parsed.experience).map((e, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <b>{e.role}</b> <span className="muted">• {e.company} • {e.duration}</span>
                <ul className="checks" style={{ marginTop: 6 }}>{list(e.highlights).map((h, j) => <li key={j}>{h}</li>)}</ul>
              </div>
            ))}
            {!list(parsed.experience).length && <p className="muted">Nothing detected.</p>}
          </div>
          <div className="card">
            <h3>Projects</h3>
            {list(parsed.projects).map((p, i) => <p key={i} style={{ marginBottom: 8 }}><b>{p.name}</b> — {p.description}</p>)}
            {!list(parsed.projects).length && <p className="muted">Nothing detected.</p>}
          </div>
        </div>
        <div>
          <div className="card">
            <h3>Education</h3>
            {list(parsed.education).map((e, i) => <p key={i} style={{ marginBottom: 6 }}><b>{e.degree}</b><br /><span className="muted">{e.institution} {e.year}</span></p>)}
            {!list(parsed.education).length && <p className="muted">Nothing detected.</p>}
            <h3 style={{ marginTop: 14 }}>Certifications</h3>
            {list(parsed.certifications).map((c) => <span className="tag" key={c}>{c}</span>)}
            {!list(parsed.certifications).length && <p className="muted">None listed.</p>}
          </div>
          <div className="card">
            <h3>Skills</h3>
            <p className="muted" style={{ marginBottom: 4 }}>Technical</p>
            {list(parsed.technicalSkills).map((s) => <span className="tag" key={s}>{s}</span>)}
            <p className="muted" style={{ margin: "10px 0 4px" }}>Soft skills</p>
            {list(parsed.softSkills).map((s) => <span className="tag" key={s} style={{ background: "var(--purple-soft)", color: "#3b2aa8" }}>{s}</span>)}
            <p className="muted" style={{ margin: "10px 0 4px" }}>Sections detected</p>
            {list(parsed.sections).map((s) => <span className="tag" key={s} style={{ background: "#eef0f6", color: "#3b4156" }}>{s}</span>)}
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= Candidate: resumes, versions, analysis ================= */
function useResumeAi(resumeId, kind, jobId) {
  const [s, setS] = useState({ data: null, loading: true, error: "" });
  const run = useCallback((refresh) => {
    setS((x) => ({ ...x, loading: true, error: "" }));
    post("/api/resume-ai", { resumeId, kind, jobId: jobId || null, refresh })
      .then((r) => setS({ data: r.data, loading: false, error: "" }))
      .catch((e) => setS({ data: null, loading: false, error: e.message }));
  }, [resumeId, kind, jobId]);
  useEffect(() => { run(false); }, [run]);
  return { ...s, refresh: () => run(true) };
}

function ImproveView({ d, refresh }) {
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Improved professional summary</h3>
          <button className="btn" style={{ flex: "0 0 auto" }} onClick={refresh}>Regenerate</button>
        </div>
        <p style={{ marginTop: 10, lineHeight: 1.6 }}>{d.summaryRewrite}</p>
      </div>
      <div className="card">
        <h3>Bullet point rewrites</h3>
        {(d.bullets || []).map((b, i) => (
          <div key={i} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--border)" : 0 }}>
            <p className="muted">Before: {b.original}</p>
            <p>✅ <b>After:</b> {b.improved}</p>
            <p className="muted" style={{ fontSize: 12 }}>{b.why}</p>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Suggested keywords</h3>
        {(d.missingKeywords || []).map((k) => <span className="tag miss" key={k}>{k}</span>)}
        <h3 style={{ marginTop: 14 }}>Tips</h3>
        <ul className="checks">{(d.tips || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>
    </>
  );
}

function ResumeAiPanel({ resumeId, kind, jobId }) {
  const s = useResumeAi(resumeId, kind, jobId);
  return (
    <Wait s={s}>
      {s.data && (kind === "ats" ? <AtsView d={s.data} refresh={s.refresh} /> : kind === "gap" ? <GapView d={s.data} refresh={s.refresh} /> : <ImproveView d={s.data} refresh={s.refresh} />)}
    </Wait>
  );
}

function History({ resumeId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api("/api/resume-ai?resumeId=" + resumeId).then(setRows).catch(() => {}); }, [resumeId]);
  const names = { ats: "ATS report", improve: "Improvements", gap: "Skill gap" };
  return (
    <div className="card scroll">
      <h3>Resume analysis history</h3>
      <table>
        <thead><tr><th>Date</th><th>Analysis</th><th>Target job</th><th>Score</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}><td>{new Date(r.createdAt).toLocaleString()}</td><td>{names[r.kind] || r.kind}</td><td>{r.jobTitle || "General"}</td><td>{r.score != null ? <b>{r.score}</b> : "—"}</td></tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="muted" style={{ padding: 10 }}>No analyses yet — open the ATS, Improve or Skill Gap tab.</p>}
    </div>
  );
}

// Compare two versions of a resume: ATS score, skills added/removed, length
function VersionCompare({ resumes }) {
  const [a, setA] = useState(resumes[1]?.id || "");
  const [b, setB] = useState(resumes[0]?.id || "");
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function compare() {
    setError(""); setBusy(true); setOut(null);
    try {
      const get = async (id) => {
        const [r, ats] = await Promise.all([api("/api/resumes?id=" + id), post("/api/resume-ai", { resumeId: id, kind: "ats" })]);
        return { r, ats: clamp(ats.data.score) };
      };
      const [x, y] = await Promise.all([get(a), get(b)]);
      const set = (r) => new Set((r.parsed?.technicalSkills || []).map((s) => s.toLowerCase()));
      const sa = set(x.r), sb = set(y.r);
      const words = (t) => t.split(/\s+/).filter(Boolean).length;
      setOut({
        x, y,
        added: [...sb].filter((s) => !sa.has(s)),
        removed: [...sa].filter((s) => !sb.has(s)),
        words: [words(x.r.text), words(y.r.text)],
        sections: [(x.r.parsed?.sections || []).length, (y.r.parsed?.sections || []).length],
      });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const sel = (v, set) => (
    <select value={v} onChange={(e) => set(e.target.value)}>
      {resumes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
    </select>
  );
  const delta = out ? out.y.ats - out.x.ats : 0;

  return (
    <div className="card">
      <h3>Compare resume versions</h3>
      <div className="row">{sel(a, setA)}<span style={{ flex: "0 0 auto" }}>→</span>{sel(b, setB)}
        <button className="btn primary" style={{ flex: "0 0 auto" }} onClick={compare} disabled={busy || a === b}>{busy ? "Comparing..." : "Compare"}</button>
      </div>
      {error && <p className="error">{error}</p>}
      {out && (
        <div style={{ marginTop: 14 }}>
          <div className="stats">
            <div className="card gs"><b>{out.x.ats} → {out.y.ats}</b><span>ATS score</span><small style={{ color: delta >= 0 ? "var(--green)" : "var(--red)" }}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} points</small></div>
            <div className="card gs"><b>{out.words[0]} → {out.words[1]}</b><span>Word count</span></div>
            <div className="card gs"><b>{out.sections[0]} → {out.sections[1]}</b><span>Sections</span></div>
          </div>
          <p><b>Skills added:</b> {out.added.length ? out.added.map((s) => <span className="tag" key={s}>{s}</span>) : <span className="muted">none</span>}</p>
          <p style={{ marginTop: 6 }}><b>Skills removed:</b> {out.removed.length ? out.removed.map((s) => <span className="tag miss" key={s}>{s}</span>) : <span className="muted">none</span>}</p>
        </div>
      )}
    </div>
  );
}

export function MyResumes() {
  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("profile");
  const [jobId, setJobId] = useState("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  const load = useCallback((select) => api("/api/resumes").then((r) => { setResumes(r); setSel((s) => select || s || r[0]?.id || null); }).catch((e) => setMsg({ type: "error", text: e.message })), []);
  useEffect(() => { load(); api("/api/board").then(setJobs).catch(() => {}); }, [load]);

  async function upload(e) {
    e.preventDefault();
    if (!file) return setMsg({ type: "error", text: "Please choose a PDF or TXT file." });
    const body = new FormData();
    body.append("resume", file);
    body.append("label", label);
    setBusy(true); setMsg({ type: "", text: "" });
    try {
      const r = await api("/api/resumes", { method: "POST", body });
      setMsg({ type: "ok", text: r.parsed ? "Resume uploaded and analyzed." : "Resume uploaded (structured analysis needs an OpenAI key)." });
      setFile(null); setLabel(""); e.target.reset();
      await load(r.id); setTab("profile");
    } catch (err) { setMsg({ type: "error", text: err.message }); } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!window.confirm("Delete this resume version?")) return;
    await api("/api/resumes?id=" + id, { method: "DELETE" }).catch(() => {});
    setSel(null); load();
  }

  const cur = resumes.find((r) => r.id === sel);
  const tabs = [["profile", "Profile"], ["ats", "ATS Report"], ["improve", "Improvements"], ["gap", "Skill Gap"], ["history", "History"]];

  return (
    <>
      <div className="top"><div><h1>My Resumes</h1><p className="muted">Upload versions, check ATS compatibility and improve your resume</p></div></div>
      <form className="card" onSubmit={upload}>
        <h3>Upload a resume version</h3>
        <div className="row">
          <input placeholder="Version name (e.g. Resume v3)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input type="file" accept=".pdf,.txt" onChange={(e) => setFile(e.target.files[0])} />
          <button className="btn primary" style={{ flex: "0 0 auto" }} disabled={busy}>{busy ? "Analyzing..." : "Upload & analyze"}</button>
        </div>
        {msg.text && <p className={msg.type}>{msg.text}</p>}
      </form>

      <div className="picker" style={{ marginBottom: 16 }}>
        {resumes.map((r) => (
          <div key={r.id} className={"chip" + (sel === r.id ? " on" : "")} style={{ cursor: "pointer", padding: "10px 14px" }} onClick={() => setSel(r.id)}>
            <b>{r.label}</b><br /><small className="muted">{new Date(r.createdAt).toLocaleDateString()} • ATS {r.atsScore ?? "—"}</small>
          </div>
        ))}
        {!resumes.length && <p className="muted">No resumes yet — upload your first one above.</p>}
      </div>

      {resumes.length > 1 && <VersionCompare resumes={resumes} />}

      {cur && (
        <>
          <div className="row" style={{ justifyContent: "space-between", margin: "8px 0" }}>
            <div className="tabs" style={{ marginBottom: 0 }}>{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
            <div className="row" style={{ flex: "0 0 auto" }}>
              {["ats", "improve", "gap"].includes(tab) && (
                <select style={{ width: 240 }} value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  <option value="">General (no target job)</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>Target: {j.title}</option>)}
                </select>
              )}
              <button className="btn danger" style={{ flex: "0 0 auto" }} onClick={() => remove(cur.id)}>Delete version</button>
            </div>
          </div>
          {tab === "profile" && <ParsedProfile parsed={cur.parsed} />}
          {["ats", "improve", "gap"].includes(tab) && <ResumeAiPanel key={`${cur.id}-${tab}-${jobId}`} resumeId={cur.id} kind={tab} jobId={jobId} />}
          {tab === "history" && <History resumeId={cur.id} />}
        </>
      )}
    </>
  );
}

/* ================= Candidate: job board with personalized recommendations ================= */
export function JobBoard() {
  const [resumes, setResumes] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [jobs, setJobs] = useState([]);
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api("/api/resumes").then((r) => { setResumes(r); setResumeId(r[0]?.id || ""); }).catch((e) => setError(e.message)); }, []);
  const load = useCallback(() => api("/api/board?resumeId=" + resumeId).then(setJobs).catch((e) => setError(e.message)), [resumeId]);
  useEffect(() => { load(); }, [load]);

  async function apply(jobId) {
    if (!resumeId) return setMsg({ ...msg, [jobId]: { type: "error", text: "Upload a resume first." } });
    setBusy(jobId);
    try {
      const r = await post("/api/board", { jobId, resumeId });
      setMsg({ ...msg, [jobId]: { type: "ok", text: `Application sent! Your AI match: ${r.score}%` } });
      load();
    } catch (err) { setMsg({ ...msg, [jobId]: { type: "error", text: err.message } }); } finally { setBusy(null); }
  }

  return (
    <>
      <div className="top"><div><h1>Job Board</h1><p className="muted">Jobs recommended for your resume</p></div></div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <label style={{ marginTop: 0 }}>Match jobs using</label>
        <select style={{ maxWidth: 320 }} value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
          {resumes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          {!resumes.length && <option value="">No resume uploaded</option>}
        </select>
      </div>
      {jobs.map((j) => (
        <div className="card" key={j.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0 }}>{j.title}</h3>
              <p className="muted">{j.company || "Company"} • {j.location || "Remote"}</p>
            </div>
            {j.match != null && <div style={{ flex: "0 0 160px" }}><div className="bar" style={{ margin: 0 }}><span className="track"><i style={{ width: j.match + "%" }} /></span><b style={{ width: 44, textAlign: "right" }}>{j.match}%</b></div><small className="muted">Skills match</small></div>}
          </div>
          <p className="muted" style={{ margin: "8px 0", whiteSpace: "pre-wrap", maxHeight: 64, overflow: "hidden" }}>{j.description}</p>
          <div>{j.skills.map((s) => <span key={s.skill} className={"tag" + (j.match != null && !s.has ? " miss" : "")} title={s.required ? "Required" : "Optional"}>{s.skill}{s.required ? " *" : ""}</span>)}</div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn primary" style={{ flex: "0 0 auto" }} disabled={j.applied || busy === j.id} onClick={() => apply(j.id)}>{j.applied ? "Applied ✓" : busy === j.id ? "Submitting..." : "Apply with this resume"}</button>
            {msg[j.id]?.text && <span className={msg[j.id].type}>{msg[j.id].text}</span>}
          </div>
        </div>
      ))}
      {!jobs.length && <p className="muted">No open jobs right now.</p>}
      <p className="muted" style={{ fontSize: 12 }}>* required skill. Red = not found in your resume.</p>
    </>
  );
}

/* ================= Candidate: application status tracker ================= */
export function Applications() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api("/api/applications").then(setRows).catch((e) => setError(e.message)); }, []);
  const steps = ["Applied", "Under review", "Shortlisted", "Interview"];

  return (
    <>
      <div className="top"><div><h1>My Applications</h1><p className="muted">Track where each application stands</p></div></div>
      {error && <p className="error">{error}</p>}
      {rows.map((a) => {
        const idx = a.interviewAt ? 3 : a.status === "Shortlisted" ? 2 : 1;
        const rejected = a.status === "Rejected";
        return (
          <div className="card" key={a.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div style={{ flex: 1 }}><h3 style={{ margin: 0 }}>{a.title}</h3><p className="muted">{a.company} • applied {new Date(a.createdAt).toLocaleDateString()} • resume: {a.resume}</p></div>
              <b style={{ flex: "0 0 auto" }}>AI match {a.score}%</b>
            </div>
            <div className="steps">
              {steps.map((s, i) => <div key={s} className={"step" + (!rejected && i <= idx ? " done" : "")}><i>{i + 1}</i>{s}</div>)}
            </div>
            {rejected && <p className="error">Not selected for this role. Check the skill gaps below and keep improving your resume.</p>}
            {a.interviewAt && <p className="ok">📅 Interview: {new Date(a.interviewAt).toLocaleString()}</p>}
            {a.missing.length > 0 && <p className="muted" style={{ marginTop: 8 }}>Skills to work on: {a.missing.map((s) => <span className="tag miss" key={s}>{s}</span>)}</p>}
          </div>
        );
      })}
      {!rows.length && <p className="muted">You haven't applied to any jobs yet — visit the Job Board.</p>}
    </>
  );
}

/* ================= Candidate: generative AI career assistant ================= */
const TASKS = [
  ["bullets", "Rewrite bullet points", "Paste weak bullet points (optional) — otherwise we'll pick the weakest from your resume."],
  ["summary", "Improve summary", "Anything you want to emphasise? (optional)"],
  ["keywords", "Suggest keywords", "Choose a target job above for best results."],
  ["projects", "Project descriptions", "Name or describe the projects to write up (optional)."],
  ["skills", "Skills to learn", "Any career goal? (optional)"],
  ["tailor", "Tailor to a job", "Choose a target job above."],
  ["chat", "Ask about my resume", ""],
];

export function Career() {
  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [resumeId, setResumeId] = useState("");
  const [jobId, setJobId] = useState("");
  const [task, setTask] = useState("bullets");
  const [input, setInput] = useState("");
  const [out, setOut] = useState("");
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Ask me anything about your resume — e.g. \"What are my strongest skills?\" or \"Do I have leadership experience?\"" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const end = useRef(null);

  useEffect(() => {
    api("/api/resumes").then((r) => { setResumes(r); setResumeId(r[0]?.id || ""); }).catch((e) => setError(e.message));
    api("/api/board").then(setJobs).catch(() => {});
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function run(text = input) {
    setError("");
    if (!resumeId) return setError("Please upload a resume first (My Resumes).");
    setBusy(true);
    try {
      if (task === "chat") {
        const next = [...msgs, { role: "user", content: text }];
        setMsgs(next); setInput("");
        const r = await post("/api/career", { task, resumeId, jobId: jobId || null, input: text, history: msgs.slice(1) });
        setMsgs([...next, { role: "assistant", content: r.reply }]);
      } else {
        const r = await post("/api/career", { task, resumeId, jobId: jobId || null, input });
        setOut(r.reply);
      }
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  const cur = TASKS.find((t) => t[0] === task);

  return (
    <>
      <div className="top"><div><h1>Career Assistant</h1><p className="muted">Generative AI help to strengthen your resume</p></div></div>
      <div className="card">
        <div className="row">
          <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
            {resumes.map((r) => <option key={r.id} value={r.id}>Resume: {r.label}</option>)}
            {!resumes.length && <option value="">No resume uploaded</option>}
          </select>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">No target job</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>Target: {j.title}</option>)}
          </select>
        </div>
        <div className="picker" style={{ marginTop: 12 }}>
          {TASKS.map(([k, l]) => <button key={k} className={"chip" + (task === k ? " on" : "")} onClick={() => { setTask(k); setOut(""); }}>{l}</button>)}
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      {task === "chat" ? (
        <div className="card chat">
          <div className="msgs" style={{ height: 340 }}>
            {msgs.map((m, i) => <div key={i} className={"msg " + m.role}><div className="who2">{m.role === "user" ? "🙂" : "🤖"}</div><div className="bub">{m.content}</div></div>)}
            {busy && <div className="msg assistant"><div className="who2">🤖</div><div className="bub muted">Thinking…</div></div>}
            <div ref={end} />
          </div>
          <form className="row" onSubmit={(e) => { e.preventDefault(); input.trim() && run(input); }}>
            <input placeholder="Ask a question about your resume..." value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn primary" style={{ flex: "0 0 auto" }} disabled={busy}>Send ➤</button>
          </form>
        </div>
      ) : (
        <div className="card">
          <textarea style={{ height: 90 }} placeholder={cur[2]} value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn primary" style={{ marginTop: 10 }} onClick={() => run()} disabled={busy}>{busy ? "Generating..." : `✨ ${cur[1]}`}</button>
          {out && (
            <>
              <pre className="mail" style={{ marginTop: 14 }}>{out}</pre>
              <button className="btn" style={{ marginTop: 8 }} onClick={() => navigator.clipboard?.writeText(out)}>Copy</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
