"use client";
import { useState, useEffect, useRef } from "react";
import { api, post, initials, scoreLabel, COLORS, clamp, useAi, Wait, Ring, Radar, GroupBars, Legend, Donut } from "./ui";

/* ================= Skill Gap Analyzer ================= */
const gapStatus = (gap) => (gap >= 0 ? "meets" : gap <= -25 ? "critical" : "below");

export function SkillGap({ id }) {
  const s = useAi(id, "gap");
  return <Wait s={s}>{s.data && <GapView d={s.data} refresh={s.refresh} />}</Wait>;
}

export function GapView({ d, refresh }) {
  const dims = (d.dimensions || []).map((x) => ({ name: x.name, current: clamp(x.current), target: clamp(x.target) }));
  const gaps = dims.map((x) => x.current - x.target);
  const total = gaps.reduce((a, b) => a + b, 0);
  const avg = dims.length ? (total / dims.length).toFixed(1) : 0;
  const critical = gaps.filter((g) => g <= -25).length;
  const strengths = gaps.filter((g) => g >= 0).length;

  return (
    <>
      <div className="stats">
        <div className="card gs red"><b>{total}</b><span>Total Gap</span><small>Points below target</small></div>
        <div className="card gs amber"><b>{avg}</b><span>Average Gap</span><small>Per skill area</small></div>
        <div className="card gs red"><b>{critical}</b><span>Critical Gaps</span><small>Need immediate attention</small></div>
        <div className="card gs green"><b>{strengths}</b><span>Strengths</span><small>Meeting expectations</small></div>
      </div>
      {d.summary && <p className="note" style={{ marginBottom: 16 }}>{d.summary}</p>}

      <div className="card" style={{ textAlign: "center" }}>
        <h3>Skills Radar Chart</h3>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Radar
            axes={dims.map((x) => x.name)}
            series={[
              { name: "Expected Level", values: dims.map((x) => x.target), color: "#5b6ee1", dashed: true },
              { name: "Current Level", values: dims.map((x) => x.current), color: "#4caf6a" },
            ]}
          />
        </div>
        <Legend items={[{ name: "Current Level", color: "#4caf6a" }, { name: "Expected Level", color: "#5b6ee1" }]} />
      </div>

      <div className="gcards">
        {dims.map((x, i) => {
          const gap = gaps[i];
          const st = gapStatus(gap);
          return (
            <div className="card" key={x.name}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <b>{x.name}</b><span className={"pill " + st} style={{ flex: "0 0 auto" }}>{st}</span>
              </div>
              <div className="kv"><span>Current: {x.current}%</span><span>Target: {x.target}%</span></div>
              <div className="track" style={{ height: 8 }}><i style={{ width: x.current + "%", background: "#7cbf81" }} /></div>
              <div className="kv" style={{ marginTop: 10 }}><span>Gap</span><span style={{ color: gap < 0 ? "#b94a3a" : "var(--green)" }}>{gap}%</span></div>
              <div className="track"><i style={{ width: Math.min(100, Math.abs(gap) * 3) + "%", background: "#c0614f" }} /></div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Skills to Learn &amp; Suggested Courses</h3>
          <button className="btn" style={{ flex: "0 0 auto" }} onClick={refresh}>Regenerate</button>
        </div>
        {(d.missingSkills || []).map((m) => (
          <div key={m.skill} style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
            <b>{m.skill}</b> <span className={"pill " + (m.priority === "High" ? "critical" : m.priority === "Medium" ? "below" : "meets")}>{m.priority}</span>
            <p className="muted" style={{ marginTop: 4 }}>{m.why}</p>
            <p style={{ marginTop: 4 }}>📘 {m.howToLearn}</p>
            {(m.courses || []).map((c, i) => <span className="tag" key={i}>{c.title} — {c.provider}</span>)}
          </div>
        ))}
        {!(d.missingSkills || []).length && <p className="muted" style={{ marginTop: 10 }}>No major skill gaps found.</p>}
        <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>Course names are AI suggestions — please verify availability before recommending.</p>
      </div>
    </>
  );
}

/* ================= ATS Analysis / Resume Improver ================= */
const SECTIONS = [
  ["Contact Info", "contactInfo"], ["Summary", "summary"], ["Experience", "experience"], ["Skills", "skills"],
  ["Education", "education"], ["Keywords", "keywords"], ["Formatting", "formatting"], ["Achievements", "achievements"],
  ["Readability", "readability"], ["Action Verbs", "actionVerbs"],
];
const tone = (v) => (v >= 80 ? "#10b981" : v >= 60 ? "#f59e0b" : "#f43f5e");

export function Ats({ id }) {
  const s = useAi(id, "ats");
  return <Wait s={s}>{s.data && <AtsView d={s.data} refresh={s.refresh} />}</Wait>;
}

export function AtsView({ d, refresh }) {
  const score = clamp(d.score);
  const checks = d.checks || {};
  return (
    <>
      <div className="atsTop">
        <div className="card" style={{ textAlign: "center" }}>
          <Ring value={score} size={190} stroke={16} gradient caption="OUT OF 100" />
          <span className="pill below" style={{ marginTop: 14, display: "inline-block", background: "#fef3c7", color: "#b45309" }}>{(d.rating || scoreLabel(score)).toUpperCase()}</span>
        </div>
        <div className="card">
          <h3>🏅 Performance Summary</h3>
          <p style={{ lineHeight: 1.6 }}>Resume scored <b>{score}/100</b>. {d.summary}</p>
          <div className="row" style={{ marginTop: 14, alignItems: "stretch" }}>
            <div className="mini"><small>DISTORTION RISK</small><b>{d.distortionRisk || "None"}</b></div>
            <div className="mini">
              <small>GLOBAL STANDARD</small>
              {[["Phone Format", "phoneFormat"], ["Date Format", "dateFormat"], ["Language Support", "language"]].map(([l, k]) => (
                <div key={k} style={{ color: checks[k] === false ? "var(--red)" : "inherit" }}>{checks[k] === false ? "✗" : "✓"} {l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <h3 className="muted" style={{ margin: "8px 0", letterSpacing: 1, fontSize: 13 }}>SECTION BREAKDOWN</h3>
      <div className="sections">
        {SECTIONS.map(([label, key]) => {
          const v = clamp(d.sections?.[key]);
          return (
            <div className="card" key={key} style={{ padding: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <small className="muted" style={{ fontWeight: 600, letterSpacing: 0.5 }}>{label.toUpperCase()}</small>
                <b style={{ color: tone(v), flex: "0 0 auto" }}>{v}</b>
              </div>
              <div className="track"><i style={{ width: v + "%", background: tone(v) }} /></div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Missing Keywords</h3>
          <button className="btn" style={{ flex: "0 0 auto" }} onClick={refresh}>Re-analyze</button>
        </div>
        <div style={{ marginTop: 10 }}>
          {(d.missingKeywords || []).map((k) => <span className="tag miss" key={k}>{k}</span>)}
          {!(d.missingKeywords || []).length && <span className="muted">None — great keyword coverage.</span>}
        </div>
      </div>
      <div className="card">
        <h3>Suggested Improvements</h3>
        {(d.suggestions || []).map((x, i) => (
          <div key={i} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--border)" : 0 }}>
            <b>{x.section}</b>
            <p className="muted">⚠ {x.issue}</p>
            <p>✅ {x.fix}</p>
          </div>
        ))}
      </div>
    </>
  );
}

/* ================= Interview question generator ================= */
export function Questions({ id }) {
  const s = useAi(id, "questions");
  return <Wait s={s}>{s.data && <QuestionsView d={s.data} refresh={s.refresh} />}</Wait>;
}

function QuestionGroup({ title, items }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {(items || []).map((q, i) => (
        <div className="q" key={i}>
          <div className="who"><span className="bubble">?</span><b>INTERVIEWER</b>{q.difficulty && <span className="tag" style={{ marginLeft: "auto" }}>{q.difficulty}</span>}</div>
          <p style={{ margin: "6px 0 8px 40px", fontSize: 15 }}>{q.question}</p>
          <details style={{ marginLeft: 40 }}>
            <summary className="link" style={{ textAlign: "left" }}>Sample answer &amp; evaluation criteria</summary>
            <p style={{ marginTop: 6 }}><b>Sample answer:</b> {q.sampleAnswer}</p>
            <p style={{ marginTop: 6 }}><b>A strong answer includes:</b> {q.evaluation}</p>
          </details>
        </div>
      ))}
    </div>
  );
}

function QuestionsView({ d, refresh }) {
  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <p className="muted">Questions are generated from this candidate's resume and the job description.</p>
        <button className="btn" style={{ flex: "0 0 auto" }} onClick={refresh}>Regenerate</button>
      </div>
      <QuestionGroup title="Technical questions" items={d.technical} />
      <QuestionGroup title="HR / behavioural questions" items={d.hr} />
      <QuestionGroup title="Resume-based probing questions" items={d.resumeBased} />
    </>
  );
}

/* ================= Interview scheduling ================= */
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const t12 = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "am" : "pm"}`; };
const endTime = (at, dur) => { const [h, m] = at.slice(11).split(":").map(Number); const t = h * 60 + m + dur; return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Form to book a slot; returns the drafted invitation email via onDone
export function ScheduleForm({ candidates, defaultId, onDone }) {
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const [f, setF] = useState({ candidateId: defaultId || candidates[0]?.id || "", at: `${ymd(tomorrow)}T10:00`, duration: 45, mode: "Video call", notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError(""); setBusy(true);
    try { onDone(await post("/api/interviews", f)); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Schedule interview</h3>
      <div className="row">
        {!defaultId && (
          <select value={f.candidateId} onChange={(e) => setF({ ...f, candidateId: e.target.value })}>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.jobTitle}</option>)}
          </select>
        )}
        <input type="datetime-local" value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} />
        <select value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })}>
          {[30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} min</option>)}
        </select>
        <select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
          {["Video call", "Phone", "On-site"].map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>
      <input style={{ marginTop: 10 }} placeholder="Notes (e.g. Technical round, panel members)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      <button className="btn primary" style={{ marginTop: 12 }} disabled={busy}>{busy ? "Scheduling..." : "Schedule & draft invitation"}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

// Email draft shown after scheduling (opens in the HR user's own email app)
export function Invite({ invite, close }) {
  const mailto = `mailto:${invite.to}?subject=${encodeURIComponent(invite.subject)}&body=${encodeURIComponent(invite.body)}`;
  return (
    <div className="card" style={{ borderColor: "var(--green)" }}>
      <h3>✅ Interview scheduled — invitation email draft</h3>
      <p className="muted">To: {invite.to || "(hidden in blind screening mode)"}</p>
      <p><b>{invite.subject}</b></p>
      <pre className="mail">{invite.body}</pre>
      <div className="row" style={{ marginTop: 10 }}>
        {invite.to && <a className="btn primary" style={{ flex: "0 0 auto" }} href={mailto}>Open in email app</a>}
        <button className="btn" style={{ flex: "0 0 auto" }} onClick={() => navigator.clipboard?.writeText(invite.body)}>Copy text</button>
        <button className="btn danger" style={{ flex: "0 0 auto" }} onClick={close}>Close</button>
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>Emails are not sent automatically; the draft opens in your own mail client.</p>
    </div>
  );
}

export function Interviews({ openCandidate }) {
  const [items, setItems] = useState([]);
  const [cands, setCands] = useState([]);
  const [week, setWeek] = useState(monday(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");

  const load = () => api("/api/interviews").then(setItems).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api("/api/candidates").then((c) => setCands(c.filter((x) => x.status !== "Rejected"))).catch(() => {});
  }, []);

  const shift = (days) => { const d = new Date(week); d.setDate(d.getDate() + days); setWeek(d); };
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(week); d.setDate(d.getDate() + i); return d; });
  const today = ymd(new Date());
  const busyDays = new Set(items.map((i) => i.at.slice(0, 10)));

  // Mini month calendar for the month of the displayed week
  const first = new Date(week.getFullYear(), week.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(week.getFullYear(), week.getMonth() + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(week.getFullYear(), week.getMonth(), i + 1))];
  const weekKeys = new Set(days.map(ymd));

  async function cancel(id) {
    if (!window.confirm("Cancel this interview?")) return;
    try { await api("/api/interviews?id=" + id, { method: "DELETE" }); load(); } catch (e) { setError(e.message); }
  }

  return (
    <>
      <div className="top">
        <div><h1>Interviews</h1><p className="muted">Schedule, track and invite shortlisted candidates</p></div>
        <button className="btn primary" onClick={() => { setShowForm(!showForm); setInvite(null); }}>＋ New Meeting</button>
      </div>
      {error && <p className="error">{error}</p>}
      {invite && <Invite invite={invite} close={() => setInvite(null)} />}
      {showForm && cands.length > 0 && <ScheduleForm candidates={cands} onDone={(r) => { setInvite(r.invite); setShowForm(false); load(); }} />}

      <div className="calwrap">
        <div>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
              <b style={{ flex: 1 }}>{week.toLocaleString("en", { month: "long", year: "numeric" })}</b>
              <button className="btn" style={{ flex: "0 0 auto", padding: "2px 10px" }} onClick={() => shift(-7)}>‹</button>
              <button className="btn" style={{ flex: "0 0 auto", padding: "2px 10px" }} onClick={() => shift(7)}>›</button>
            </div>
            <div className="mcal">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="muted">{d}</span>)}
              {cells.map((d, i) => d ? (
                <button key={i} className={(weekKeys.has(ymd(d)) ? "inweek " : "") + (ymd(d) === today ? "today" : "")} onClick={() => setWeek(monday(d))}>
                  {d.getDate()}{busyDays.has(ymd(d)) && <i />}
                </button>
              ) : <span key={i} />)}
            </div>
          </div>
          <div className="card">
            <h3>This week</h3>
            <p className="muted">{items.filter((i) => weekKeys.has(i.at.slice(0, 10))).length} interview(s) scheduled</p>
            <p className="muted" style={{ marginTop: 4 }}>{items.length} total upcoming &amp; past</p>
          </div>
        </div>

        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{days[0].toLocaleDateString("en", { month: "short", day: "numeric" })} – {days[6].toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</h3>
            <button className="btn" style={{ flex: "0 0 auto" }} onClick={() => setWeek(monday(new Date()))}>Today</button>
          </div>
          <div className="weekgrid">
            {days.map((d, i) => {
              const list = items.filter((x) => x.at.slice(0, 10) === ymd(d)).sort((a, b) => a.at.localeCompare(b.at));
              return (
                <div key={i} className="daycol">
                  <div className={"dayhead" + (ymd(d) === today ? " today" : "")}>{DAYS[i]} <b>{pad(d.getDate())}</b></div>
                  {list.map((x) => (
                    <div key={x.id} className="event">
                      <b onClick={() => openCandidate(x.candidateId)} style={{ cursor: "pointer" }}>{x.name}</b>
                      <div className="muted" style={{ fontSize: 12 }}>{x.jobTitle}</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{t12(x.at.slice(11))} – {t12(endTime(x.at, x.duration))}</div>
                      <div style={{ fontSize: 12 }}><span className="tag">{x.mode}</span></div>
                      {x.notes && <div className="muted" style={{ fontSize: 11 }}>{x.notes}</div>}
                      <button className="link" onClick={() => cancel(x.id)}>Cancel</button>
                    </div>
                  ))}
                  {!list.length && <p className="muted" style={{ fontSize: 12 }}>—</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ================= Candidate comparison ================= */
export function Compare() {
  const [all, setAll] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState("");
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/api/candidates"), api("/api/jobs")])
      .then(([c, j]) => { setAll(c); setJobs(j); setPicked(c.slice(0, 3).map((x) => x.id)); })
      .catch((e) => setError(e.message));
  }, []);

  const pool = all.filter((c) => !jobId || String(c.jobId) === jobId);
  const chosen = picked.map((id) => all.find((c) => c.id === id)).filter(Boolean);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 4 ? [...p, id] : p));
  const metrics = [["Overall", "score"], ["Skills", "skillsScore"], ["Experience", "experienceScore"], ["Domain", "domainScore"], ["Education", "educationScore"]];
  const series = chosen.map((c, i) => ({ name: c.name, color: COLORS[i], values: metrics.map(([, k]) => c[k]) }));
  const skills = [...new Set(chosen.flatMap((c) => c.skillOverlap.map((s) => s.skill)))];

  return (
    <>
      <div className="top"><div><h1>Compare Candidates</h1><p className="muted">Select up to 4 candidates to compare side by side</p></div></div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <select style={{ maxWidth: 320, marginBottom: 10 }} value={jobId} onChange={(e) => setJobId(e.target.value)}>
          <option value="">All jobs</option>
          {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <div className="picker">
          {pool.map((c) => (
            <label key={c.id} className={"chip" + (picked.includes(c.id) ? " on" : "")}>
              <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} style={{ display: "none" }} />
              {c.name} <b>{c.score}%</b>
            </label>
          ))}
        </div>
      </div>

      {chosen.length < 2 ? <p className="muted">Pick at least two candidates to see the comparison.</p> : (
        <>
          <div className="stats">
            {chosen.map((c, i) => (
              <div className="card" key={c.id} style={{ borderTop: `4px solid ${COLORS[i]}`, margin: 0 }}>
                <div className="sim" style={{ cursor: "inherit", padding: 0 }}><div className="avatar sm">{initials(c.name)}</div><div><b>{c.name}</b><div className="muted">{c.title}</div></div></div>
                <div style={{ marginTop: 10 }}><b style={{ fontSize: 26 }}>{c.score}%</b> <span className="muted">{scoreLabel(c.score)}</span></div>
                <p className="muted">{c.yearsExp} yrs • {c.jobTitle}</p>
                <span className={"badge " + c.status}>{c.status}</span>
              </div>
            ))}
          </div>
          <div className="dash" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>Score comparison</h3>
              <GroupBars cats={metrics.map(([l]) => l)} series={series} />
              <Legend items={series} />
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <h3>Profile radar</h3>
              <Radar axes={metrics.map(([l]) => l)} series={series} size={260} />
            </div>
          </div>
          <div className="card scroll">
            <h3>Skill matrix</h3>
            <table>
              <thead><tr><th>Skill</th>{chosen.map((c, i) => <th key={c.id} style={{ color: COLORS[i] }}>{c.name}</th>)}</tr></thead>
              <tbody>
                {skills.map((sk) => (
                  <tr key={sk}>
                    <td><b>{sk}</b></td>
                    {chosen.map((c) => {
                      const m = c.skillOverlap.find((s) => s.skill === sk)?.match;
                      return <td key={c.id}>{m == null ? <span className="muted">—</span> : <span className={"tag" + (m < 50 ? " miss" : "")}>{m}%</span>}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/* ================= HR chatbot ================= */
const SUGGESTIONS = [
  "Who is the best candidate for the MERN Stack Developer role?",
  "Show candidates with more than 4 years of experience",
  "Which shortlisted candidates know Kubernetes?",
  "Summarize the Data Analyst pipeline",
];

export function Assistant() {
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Hi! I'm HireSense. Ask me anything about your candidates — best fits for a role, experience filters, missing skills and more." }]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send(message) {
    if (!message.trim() || busy) return;
    const next = [...msgs, { role: "user", content: message }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r = await post("/api/chat", { message, history: msgs.slice(1) });
      setMsgs([...next, { role: "assistant", content: r.reply }]);
    } catch (err) {
      setMsgs([...next, { role: "assistant", content: "⚠ " + err.message }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="top"><div><h1>HR Assistant</h1><p className="muted">Ask questions answered from your candidate database</p></div></div>
      <div className="card chat">
        <div className="msgs">
          {msgs.map((m, i) => (
            <div key={i} className={"msg " + m.role}>
              <div className="who2">{m.role === "user" ? "🙂" : "🤖"}</div>
              <div className="bub">{m.content}</div>
            </div>
          ))}
          {busy && <div className="msg assistant"><div className="who2">🤖</div><div className="bub muted">Thinking…</div></div>}
          <div ref={end} />
        </div>
        <div className="row" style={{ margin: "10px 0" }}>
          {SUGGESTIONS.map((s) => <button key={s} className="chip" style={{ flex: "0 0 auto" }} onClick={() => send(s)}>{s}</button>)}
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <input placeholder="Type a message..." value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn primary" style={{ flex: "0 0 auto" }} disabled={busy}>Send ➤</button>
        </form>
      </div>
    </>
  );
}

/* ================= Analytics + bias audit ================= */
export function Analytics({ blind }) {
  const [cands, setCands] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [ivs, setIvs] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api("/api/candidates"), api("/api/jobs"), api("/api/interviews")])
      .then(([c, j, i]) => { setCands(c); setJobs(j); setIvs(i); })
      .catch((e) => setError(e.message));
  }, []);

  const n = (st) => cands.filter((c) => c.status === st).length;
  const statusParts = [
    { name: "Shortlisted", value: n("Shortlisted"), color: "#16a34a" },
    { name: "Review", value: n("Review"), color: "#f59e0b" },
    { name: "Rejected", value: n("Rejected"), color: "#dc2626" },
  ];
  const funnel = [
    ["Screened", cands.length, "#4361ee"],
    ["Fair match (50+)", cands.filter((c) => c.score >= 50).length, "#4cc9f0"],
    ["Shortlisted", n("Shortlisted"), "#4ef0b0"],
    ["Interview scheduled", new Set(ivs.map((i) => i.candidateId)).size, "#f2c94c"],
  ];

  // Candidates screened per day, last 14 days
  const perDay = Array.from({ length: 14 }, (_, k) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - k));
    return cands.filter((c) => ymd(new Date(c.createdAt)) === ymd(d)).length;
  });
  const maxDay = Math.max(1, ...perDay);
  const line = perDay.map((v, i) => `${(i / 13) * 560 + 20},${110 - (v / maxDay) * 90}`).join(" ");

  const gaps = {};
  cands.forEach((c) => c.missing.forEach((s) => (gaps[s] = (gaps[s] || 0) + 1)));
  const topGaps = Object.entries(gaps).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Fairness audit: selection rate by group + four-fifths (80%) rule
  const groupBy = (keyFn) => {
    const g = {};
    cands.forEach((c) => { const k = keyFn(c); (g[k] ||= []).push(c); });
    const rows = Object.entries(g).filter(([, l]) => l.length >= 2).map(([k, l]) => ({ k, total: l.length, rate: l.filter((c) => c.status === "Shortlisted").length / l.length }));
    const best = Math.max(0, ...rows.map((r) => r.rate));
    return rows.map((r) => ({ ...r, ratio: best ? r.rate / best : 1 }));
  };
  const band = (c) => (c.yearsExp <= 2 ? "0-2 yrs" : c.yearsExp <= 5 ? "3-5 yrs" : "6+ yrs");
  const audits = [["Experience band", groupBy(band)], ["Location (city)", groupBy((c) => (c.location || "Unknown").split(",")[0])]];
  const inconsistent = cands.filter((c) => Math.abs(c.score - (c.skillsScore + c.experienceScore + c.domainScore) / 3) > 12);

  return (
    <>
      <div className="top"><div><h1>Analytics</h1><p className="muted">Pipeline health, skill gaps and fairness checks</p></div></div>
      {error && <p className="error">{error}</p>}

      <div className="dash">
        <div className="card">
          <h3>Total candidates</h3>
          <div className="row" style={{ gap: 24 }}>
            <Donut parts={statusParts} center={<><small className="muted">Total</small><b style={{ fontSize: 28 }}>{cands.length}</b></>} />
            <div>{statusParts.map((p) => <div key={p.name} className="kv" style={{ gap: 20, fontSize: 13 }}><span><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: p.color, marginRight: 6 }} />{p.name}</span><b>{p.value}</b></div>)}</div>
          </div>
        </div>
        <div className="card">
          <h3>Hiring funnel</h3>
          {funnel.map(([label, v, color]) => (
            <div key={label} style={{ marginBottom: 8, textAlign: "center" }}>
              <div style={{ width: `${Math.max(12, cands.length ? (v / cands.length) * 100 : 0)}%`, background: color, margin: "0 auto", padding: "6px 0", borderRadius: 4, fontWeight: 600, fontSize: 13 }}>{v}</div>
              <small className="muted">{label}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="dash">
        <div className="card">
          <h3>Resumes screened — last 14 days</h3>
          <svg viewBox="0 0 600 130" style={{ width: "100%" }}>
            {[20, 65, 110].map((y) => <line key={y} x1="20" x2="580" y1={y} y2={y} stroke="#eef0f6" />)}
            <polyline points={`20,110 ${line} 580,110`} fill="#4f2fd61a" stroke="none" />
            <polyline points={line} fill="none" stroke="#4f2fd6" strokeWidth="2.5" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="card">
          <h3>Average match by job</h3>
          {jobs.map((j) => {
            const mine = cands.filter((c) => c.jobId === j.id);
            const avg = mine.length ? Math.round(mine.reduce((a, c) => a + c.score, 0) / mine.length) : 0;
            return <div className="bar" key={j.id} style={{ margin: "8px 0" }}><span style={{ width: 150, fontSize: 12 }}>{j.title}</span><span className="track"><i style={{ width: avg + "%" }} /></span><span>{avg}%</span></div>;
          })}
        </div>
      </div>

      <div className="card">
        <h3>Most common skill gaps</h3>
        {topGaps.map(([skill, c]) => (
          <div className="bar" key={skill} style={{ margin: "8px 0" }}><span style={{ width: 120, fontSize: 12 }}>{skill}</span><span className="track"><i className="low" style={{ width: (c / topGaps[0][1]) * 100 + "%" }} /></span><span style={{ width: 30 }}>{c}</span></div>
        ))}
      </div>

      <div className="card">
        <h3>⚖️ Fairness &amp; bias audit</h3>
        <p className="muted" style={{ marginBottom: 10 }}>
          Blind screening is <b>{blind ? "ON — names and contact details are hidden" : "OFF"}</b> (toggle in the sidebar). Protected traits (gender, age, photos, etc.) are not collected or used in scoring.
          Scores assist HR; the final decision is always human.
        </p>
        {audits.map(([title, rows]) => (
          <div key={title} style={{ marginBottom: 14 }}>
            <b>Shortlist rate by {title}</b>
            {rows.length === 0 && <p className="muted">Not enough data (needs 2+ candidates per group).</p>}
            {rows.map((r) => (
              <div className="bar" key={r.k} style={{ margin: "6px 0" }}>
                <span style={{ width: 110, fontSize: 12 }}>{r.k} ({r.total})</span>
                <span className="track"><i style={{ width: r.rate * 100 + "%", background: r.ratio < 0.8 ? "var(--amber)" : "var(--purple)" }} /></span>
                <span style={{ width: 150, fontSize: 12 }}>{Math.round(r.rate * 100)}% · ratio {r.ratio.toFixed(2)} {r.ratio < 0.8 ? "⚠" : "✓"}</span>
              </div>
            ))}
          </div>
        ))}
        <p className="muted" style={{ fontSize: 12 }}>Ratio below 0.80 (four-fifths rule) is a prompt to review the process, not proof of bias — experience is job-related.</p>
        <b style={{ display: "block", marginTop: 12 }}>Score consistency check</b>
        {inconsistent.length === 0 ? <p className="muted">All overall scores are consistent with their skills, experience and domain sub-scores.</p> : (
          <p className="muted">{inconsistent.length} candidate(s) have an overall score that differs from their sub-scores by more than 12 points: {inconsistent.map((c) => c.name).join(", ")}. Review the rationale.</p>
        )}
      </div>
    </>
  );
}
