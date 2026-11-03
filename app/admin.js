"use client";
import { useState, useEffect, useCallback } from "react";
import { api, post, Donut, Legend } from "./ui";

/* ================= Recruiter: jobs with required/optional skills, publishing, batch screening ================= */
function JobCard({ job, onDone }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  async function screen() {
    if (!files.length) return setMsg({ type: "error", text: "Please choose at least one resume (PDF or TXT)." });
    const body = new FormData();
    body.append("jobId", job.id);
    files.forEach((f) => body.append("resumes", f));
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      const data = await api("/api/screen", { method: "POST", body });
      const failed = data.failed.map((f) => `${f.fileName}: ${f.error}`).join(" | ");
      setMsg({ type: data.failed.length ? "error" : "ok", text: `${data.saved} resume(s) screened.${failed ? " Skipped: " + failed : ""}` });
      setFiles([]);
      onDone();
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish() {
    await post("/api/jobs", { id: job.id, published: !job.published }, "PATCH").catch(() => {});
    onDone();
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, flex: 1 }}>{job.title} <span className="muted" style={{ fontWeight: 400 }}>• {job.company || "—"} • {job.location || "Remote"} • {job.candidates} candidate(s)</span></h3>
        <span className={"pill " + (job.published ? "meets" : "critical")} style={{ flex: "0 0 auto" }}>{job.published ? "Published" : "Draft"}</span>
        <button className="btn" style={{ flex: "0 0 auto" }} onClick={togglePublish}>{job.published ? "Unpublish" : "Publish"}</button>
      </div>
      <p className="muted" style={{ whiteSpace: "pre-wrap", maxHeight: 70, overflow: "hidden", margin: "8px 0" }}>{job.description}</p>
      <div>
        {job.requiredSkills.map((s) => <span className="tag" key={s}>{s} *</span>)}
        {job.optionalSkills.map((s) => <span className="tag" key={s} style={{ background: "#eef0f6", color: "#3b4156" }}>{s}</span>)}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <input type="file" multiple accept=".pdf,.txt" onChange={(e) => setFiles(Array.from(e.target.files))} />
        <button className="btn primary" style={{ flex: "0 0 auto" }} onClick={screen} disabled={busy}>{busy ? "Screening resumes..." : "Batch Screen Resumes"}</button>
      </div>
      {msg.text && <p className={msg.type}>{msg.text}</p>}
    </div>
  );
}

export function Jobs({ user }) {
  const [jobs, setJobs] = useState([]);
  const blank = { title: "", location: "", company: user.company || "", description: "", requiredSkills: "", optionalSkills: "", published: true };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(() => api("/api/jobs").then(setJobs).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault();
    setError("");
    try {
      await post("/api/jobs", form);
      setForm(blank);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="top"><div><h1>Jobs</h1><p className="muted">Create and publish jobs, then batch-screen resumes against them</p></div></div>
      <form className="card" onSubmit={create}>
        <h3>New job opening</h3>
        <div className="row">
          <input placeholder="Job title (e.g. Senior Backend Engineer)" value={form.title} onChange={set("title")} />
          <input placeholder="Location" value={form.location} onChange={set("location")} />
          <input placeholder="Company" value={form.company} onChange={set("company")} />
        </div>
        <textarea style={{ marginTop: 10, height: 100 }} placeholder="Paste the job description..." value={form.description} onChange={set("description")} />
        <div className="row" style={{ marginTop: 10 }}>
          <input placeholder="Required skills (comma separated)" value={form.requiredSkills} onChange={set("requiredSkills")} />
          <input placeholder="Optional skills (comma separated)" value={form.optionalSkills} onChange={set("optionalSkills")} />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
          <input type="checkbox" style={{ width: "auto" }} checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
          Publish now (visible to candidates on the Job Board)
        </label>
        <button className="btn primary" style={{ marginTop: 6 }}>Create Job</button>
        {error && <p className="error">{error}</p>}
      </form>
      {jobs.map((j) => <JobCard key={j.id} job={j} onDone={load} />)}
      {jobs.length === 0 && <p className="muted">No jobs yet.</p>}
    </>
  );
}

/* ================= Admin: analytics, users, jobs, API monitoring, audit logs ================= */
const fmt = (d) => new Date(d).toLocaleString();

function Overview() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const [th, setTh] = useState(80);
  const load = useCallback(() => api("/api/admin?section=overview").then((r) => { setD(r); setTh(r.feedback.threshold); }).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  if (error) return <p className="error">{error}</p>;
  if (!d) return <p className="muted">Loading...</p>;

  const c = d.counts;
  const stats = [["👥", "Candidates", c.candidates], ["🏢", "Recruiters", c.recruiters], ["💼", "Jobs (published)", `${c.jobs} (${c.published})`], ["📄", "Resumes analyzed", c.screened + c.analyses],
    ["📨", "Applications", c.applications], ["📅", "Interviews", c.interviews]];
  const parts = [["Shortlisted", "#16a34a"], ["Review", "#f59e0b"], ["Rejected", "#dc2626"]].map(([name, color]) => ({ name, color, value: d.statuses[name] || 0 }));
  const maxDemand = d.demand[0]?.count || 1;
  const maxGap = d.gaps[0]?.count || 1;
  const fb = d.feedback;

  async function apply(value) {
    await post("/api/admin", { threshold: value }, "PATCH").catch(() => {});
    load();
  }

  return (
    <>
      <div className="stats">
        {stats.map(([i, l, v]) => <div className="card stat" key={l}><div className="ico">{i}</div><div><span className="muted">{l}</span><b>{v}</b></div></div>)}
      </div>
      <div className="dash">
        <div className="card">
          <h3>Shortlisting statistics</h3>
          <div className="row" style={{ gap: 24 }}>
            <Donut parts={parts} center={<><small className="muted">Screened</small><b style={{ fontSize: 26 }}>{c.screened}</b></>} />
            <div>{parts.map((p) => <div className="kv" key={p.name} style={{ gap: 18 }}><span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: p.color, marginRight: 6 }} />{p.name}</span><b>{p.value}</b></div>)}</div>
          </div>
          <h3 style={{ marginTop: 18 }}>Shortlist rate by job</h3>
          {d.perJob.map((j) => (
            <div className="bar" key={j.title} style={{ margin: "8px 0" }}>
              <span style={{ width: 150, fontSize: 12 }}>{j.title}</span>
              <span className="track"><i style={{ width: (j.total ? (j.shortlisted / j.total) * 100 : 0) + "%" }} /></span>
              <span style={{ width: 60, fontSize: 12 }}>{j.shortlisted}/{j.total}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Skills demand (in open jobs)</h3>
          {d.demand.map((s) => (
            <div className="bar" key={s.skill} style={{ margin: "7px 0" }}>
              <span style={{ width: 110, fontSize: 12 }}>{s.skill}</span>
              <span className="track"><i style={{ width: (s.count / maxDemand) * 100 + "%" }} /></span><span style={{ width: 24 }}>{s.count}</span>
            </div>
          ))}
          <h3 style={{ marginTop: 18 }}>Skills candidates lack most</h3>
          {d.gaps.map((s) => (
            <div className="bar" key={s.skill} style={{ margin: "7px 0" }}>
              <span style={{ width: 110, fontSize: 12 }}>{s.skill}</span>
              <span className="track"><i className="low" style={{ width: (s.count / maxGap) * 100 + "%" }} /></span><span style={{ width: 24 }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>🔁 Feedback learning</h3>
        {fb.total === 0 ? <p className="muted">No recruiter feedback yet. Every shortlist / review / reject decision is compared with the AI's recommendation.</p> : (
          <>
            <p>Recruiters agreed with the AI on <b>{fb.agree} of {fb.total}</b> decisions (<b>{Math.round((fb.agree / fb.total) * 100)}%</b>).</p>
            <p className="muted" style={{ margin: "6px 0" }}>
              {fb.suggested != null && fb.suggested !== fb.threshold
                ? `Recruiters shortlisted candidates scoring as low as ${fb.suggested}. Suggested shortlist threshold: ${fb.suggested} (currently ${fb.threshold}).`
                : "The current shortlist threshold matches recruiter decisions."}
            </p>
          </>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          <span style={{ flex: "0 0 auto" }}>Shortlist threshold:</span>
          <input type="number" min="50" max="95" style={{ maxWidth: 100 }} value={th} onChange={(e) => setTh(e.target.value)} />
          <button className="btn" style={{ flex: "0 0 auto" }} onClick={() => apply(th)}>Save</button>
          {fb.suggested != null && fb.suggested !== fb.threshold && <button className="btn primary" style={{ flex: "0 0 auto" }} onClick={() => apply(fb.suggested)}>Apply suggestion ({fb.suggested})</button>}
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>New screenings are auto-labelled Shortlisted at or above the threshold, Review within 20 points below it, otherwise Rejected. Recruiters always make the final decision.</p>
      </div>
    </>
  );
}

function Users({ me }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const load = useCallback(() => api("/api/admin?section=users").then(setRows).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function role(id, r) { try { await post("/api/admin", { userId: id, role: r }, "PATCH"); load(); } catch (e) { setError(e.message); } }
  async function del(id) {
    if (!window.confirm("Delete this user and their resumes?")) return;
    try { await api("/api/admin?userId=" + id, { method: "DELETE" }); load(); } catch (e) { setError(e.message); }
  }

  return (
    <div className="card scroll">
      <h3>Manage candidates and recruiters</h3>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Role</th><th></th></tr></thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id}>
              <td><b>{u.name}</b></td><td>{u.email}</td><td>{u.company || "—"}</td>
              <td><select value={u.role} disabled={u.id === me.id} onChange={(e) => role(u.id, e.target.value)}><option>admin</option><option>recruiter</option><option>candidate</option></select></td>
              <td>{u.id !== me.id && <button className="btn danger" onClick={() => del(u.id)}>Delete</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminJobs() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const load = useCallback(() => api("/api/admin?section=jobs").then(setRows).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);
  async function del(id) {
    if (!window.confirm("Delete this job and all its candidates?")) return;
    try { await api("/api/admin?jobId=" + id, { method: "DELETE" }); load(); } catch (e) { setError(e.message); }
  }
  return (
    <div className="card scroll">
      <h3>Manage job postings</h3>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Job</th><th>Company</th><th>Location</th><th>Candidates</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {rows.map((j) => (
            <tr key={j.id}><td><b>{j.title}</b></td><td>{j.company || "—"}</td><td>{j.location}</td><td>{j.candidates}</td>
              <td><span className={"pill " + (j.published ? "meets" : "critical")}>{j.published ? "Published" : "Draft"}</span></td>
              <td><button className="btn danger" onClick={() => del(j.id)}>Delete</button></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApiMonitor() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/api/admin?section=api").then(setD).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="error">{error}</p>;
  if (!d) return <p className="muted">Loading...</p>;
  const maxDay = Math.max(1, ...d.daily.map((x) => x.calls));
  const rate = d.total ? ((d.errors / d.total) * 100).toFixed(1) : 0;

  return (
    <>
      <div className="stats">
        <div className="card gs"><b>{d.total}</b><span>AI calls</span></div>
        <div className="card gs red"><b>{d.errors}</b><span>Errors</span><small>{rate}% error rate</small></div>
        <div className="card gs amber"><b>{d.avgMs} ms</b><span>Avg latency</span></div>
        <div className="card gs green"><b>{d.tokens.toLocaleString()}</b><span>Tokens used</span></div>
      </div>
      <div className="dash">
        <div className="card scroll">
          <h3>Usage by feature</h3>
          <table>
            <thead><tr><th>Feature</th><th>Calls</th><th>Errors</th><th>Avg ms</th></tr></thead>
            <tbody>{d.byName.map((r) => <tr key={r.name}><td><b>{r.name}</b></td><td>{r.calls}</td><td style={{ color: r.errors ? "var(--red)" : "inherit" }}>{r.errors}</td><td>{r.avgMs}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card">
          <h3>Calls per day (last 7 days)</h3>
          {d.daily.map((x) => (
            <div className="bar" key={x.d} style={{ margin: "7px 0" }}>
              <span style={{ width: 50, fontSize: 12 }}>{x.d}</span>
              <span className="track"><i style={{ width: (x.calls / maxDay) * 100 + "%" }} /></span><span style={{ width: 60, fontSize: 12 }}>{x.calls}{x.errors ? ` (${x.errors}✗)` : ""}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card scroll">
        <h3>Recent errors</h3>
        <table>
          <thead><tr><th>When</th><th>Feature</th><th>Error</th></tr></thead>
          <tbody>{d.recentErrors.map((r, i) => <tr key={i}><td>{fmt(r.created_at)}</td><td>{r.name}</td><td className="muted">{r.error}</td></tr>)}</tbody>
        </table>
        {!d.recentErrors.length && <p className="muted" style={{ padding: 10 }}>No errors 🎉</p>}
      </div>
    </>
  );
}

function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { api("/api/admin?section=audit").then(setRows).catch((e) => setError(e.message)); }, []);
  return (
    <div className="card scroll">
      <h3>Audit logs (latest 100)</h3>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td>{fmt(r.created_at)}</td><td>{r.user_name || "—"}</td><td><span className="tag">{r.action}</span></td><td className="muted">{r.detail}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function Admin({ me }) {
  const [tab, setTab] = useState("overview");
  const tabs = [["overview", "Overview"], ["users", "Users"], ["jobs", "Job Postings"], ["api", "API & Errors"], ["audit", "Audit Logs"]];
  return (
    <>
      <div className="top"><div><h1>Admin</h1><p className="muted">Platform-wide analytics, users, monitoring and audit trail</p></div></div>
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === "overview" && <Overview />}
      {tab === "users" && <Users me={me} />}
      {tab === "jobs" && <AdminJobs />}
      {tab === "api" && <ApiMonitor />}
      {tab === "audit" && <AuditLogs />}
    </>
  );
}
