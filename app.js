const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = { names: [], lang: "en-NG", tasks: [], transcript: [], rec: null, listening: false, ai: "none", aiCursor: 0 };

document.addEventListener("DOMContentLoaded", () => {
  const sel = $("#langSel");
  LANGS.forEach((l) => {
    const o = document.createElement("option");
    o.value = l.code;
    o.textContent = l.label;
    sel.appendChild(o);
  });
  restore();
  sel.value = state.lang;
  $("#namesInput").value = state.names.join(", ");

  sel.addEventListener("change", () => { state.lang = sel.value; save(); if (state.rec) state.rec.lang = state.lang; });
  $("#namesInput").addEventListener("change", () => {
    state.names = $("#namesInput").value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    save();
    if (state.transcript.length) reingest();
  });
  $("#micBtn").addEventListener("click", toggleMic);
  $("#typeBtn").addEventListener("click", () => {
    const t = $("#typedInput").value.trim();
    if (!t) { toast("Type something first, or tap the mic"); return; }
    $("#typedInput").value = "";
    ingest(t, "typed");
  });
  $("#demoBtn").addEventListener("click", playDemo);
  $("#clearBtn").addEventListener("click", () => { state.tasks = []; state.transcript = []; save(); render(); });
  $("#copyDigest").addEventListener("click", copyDigest);
  $("#icsBtn").addEventListener("click", downloadIcs);
  $("#settingsBtn").addEventListener("click", toggleSettings);
  $("#grokBtn").addEventListener("click", () => setPreset("https://api.x.ai/v1/chat/completions", "grok-4-1-fast-reasoning"));
  $("#openaiBtn").addEventListener("click", () => setPreset("https://api.openai.com/v1/chat/completions", "gpt-4o-mini"));
  $("#freeBtn").addEventListener("click", () => setPreset("https://text.pollinations.ai/openai", "openai"));
  ["apiKey", "apiBase", "apiModel"].forEach((id) => $("#" + id).addEventListener("change", persistSettings));
  $("#fontToggle").addEventListener("click", () => toggleBody("easy", "#fontToggle", "Aa Easy read", "Aa Default type"));
  $("#contrastToggle").addEventListener("click", () => toggleBody("contrast", "#contrastToggle", "◐ High contrast", "◐ Normal contrast"));
  $("#sizeToggle").addEventListener("click", () => toggleBody("big", "#sizeToggle", "A+ Larger text", "A– Default text"));
  $("#motionToggle").addEventListener("click", () => toggleBody("still", "#motionToggle", "✦ Reduce motion", "✦ Motion allowed"));

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    $("#micStatus").textContent = "This browser has no ear (no Web Speech API). Type below — everything else still works.";
    $("#micBtn").disabled = true;
  }
  render();
});

function restore() {
  try {
    state.names = JSON.parse(localStorage.getItem("abeg.names") || "[]");
    if (!state.names.length) state.names = NAMES_DEFAULT.slice();
    state.lang = localStorage.getItem("abeg.lang") || "en-NG";
    state.tasks = JSON.parse(localStorage.getItem("abeg.tasks") || "[]");
    state.transcript = JSON.parse(localStorage.getItem("abeg.transcript") || "[]");
    const k = localStorage.getItem("abeg.key"), b = localStorage.getItem("abeg.base"), m = localStorage.getItem("abeg.model");
    if (k) $("#apiKey").value = k;
    $("#apiBase").value = b || "https://text.pollinations.ai/openai";
    $("#apiModel").value = m || "openai";
  } catch (err) {
    state.names = NAMES_DEFAULT.slice();
  }
}

function save() {
  try {
    localStorage.setItem("abeg.names", JSON.stringify(state.names));
    localStorage.setItem("abeg.lang", state.lang);
    localStorage.setItem("abeg.tasks", JSON.stringify(state.tasks));
    localStorage.setItem("abeg.transcript", JSON.stringify(state.transcript));
  } catch (err) {
    console.warn("not saved", err && err.message);
  }
}

function persistSettings() {
  try {
    localStorage.setItem("abeg.key", $("#apiKey").value.trim());
    localStorage.setItem("abeg.base", $("#apiBase").value.trim());
    localStorage.setItem("abeg.model", $("#apiModel").value.trim());
  } catch (err) {
    console.warn("not saved", err && err.message);
  }
}

function setPreset(base, model) {
  $("#apiBase").value = base;
  $("#apiModel").value = model;
  persistSettings();
  toast("Preset set — " + model);
}

function toggleBody(cls, sel, onLabel, offLabel) {
  const b = document.body;
  const on = b.classList.toggle(cls);
  const btn = $(sel);
  btn.textContent = on ? onLabel : offLabel;
  btn.setAttribute("aria-pressed", String(on));
}

function toggleSettings() {
  const p = $("#settings");
  p.hidden = !p.hidden;
  $("#settingsBtn").setAttribute("aria-expanded", String(!p.hidden));
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

function toggleMic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  if (state.listening) { state.rec.stop(); return; }
  const rec = new SR();
  state.rec = rec;
  rec.lang = state.lang;
  rec.interimResults = true;
  rec.continuous = true;
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) ingest(r[0].transcript.trim(), "voice");
      else interim += r[0].transcript;
    }
    $("#live").textContent = interim;
  };
  rec.onerror = (e) => {
    state.listening = false;
    $("#micBtn").classList.remove("on");
    $("#micStatus").textContent = e.error === "not-allowed"
      ? "Mic permission blocked. Allow it in browser settings, or type below."
      : "Mic error: " + e.error + ". Type below if it continues.";
  };
  rec.onend = () => {
    state.listening = false;
    $("#micBtn").classList.remove("on");
    $("#live").textContent = "";
    $("#micStatus").textContent = "Tap the mic and talk like you dey talk.";
  };
  rec.start();
  state.listening = true;
  $("#micBtn").classList.add("on");
  $("#micStatus").textContent = "Listening in " + (LANGS.find((l) => l.code === state.lang) || {}).label + "… tap again to stop.";
}

function playDemo() {
  $("#demoBtn").disabled = true;
  DEMO_SPEECH.forEach((line, i) => {
    setTimeout(() => {
      ingest(line, "demo");
      if (i === DEMO_SPEECH.length - 1) $("#demoBtn").disabled = false;
    }, 400 * i);
  });
}

function ingest(text, source) {
  if (!text) return;
  state.transcript.push({ text: text, source: source, lang: state.lang, at: Date.now() });
  runUnderstanding(text);
}

function reingest() {
  const all = state.transcript.map((t) => t.text).join(". ");
  state.tasks = state.tasks.filter((t) => t.keep);
  understand(all, state.names, Date.now()).forEach((t) => {
    if (!state.tasks.some((x) => overlap(x.task, t.task) > 0.6)) state.tasks.push(t);
  });
  save();
  render();
}

async function runUnderstanding(text) {
  const engineTasks = understand(text, state.names, Date.now());
  engineTasks.forEach((e) => {
    if (!state.tasks.some((x) => overlap(x.task, e.task) > 0.6)) { e.source = "engine"; state.tasks.push(e); }
  });
  save();
  render();
  scheduleAi();
}

function scheduleAi() {
  clearTimeout(scheduleAi._t);
  scheduleAi._t = setTimeout(aiPass, 1600);
}

async function aiPass() {
  const pending = state.transcript.slice(state.aiCursor || 0).map((t) => t.text).join("\n");
  if (!pending.trim()) return;
  const key = $("#apiKey").value.trim();
  const base = $("#apiBase").value.trim() || "https://text.pollinations.ai/openai";
  const model = $("#apiModel").value.trim() || "openai";
  let aiTasks = null;
  try {
    aiTasks = await aiExtract(pending, key, base, model);
    state.ai = key ? "key" : "free";
  } catch (err) {
    if (key) {
      try {
        aiTasks = await aiExtract(pending, "", "https://text.pollinations.ai/openai", "openai");
        state.ai = "free";
      } catch (err2) {
        aiTasks = null;
      }
    }
    if (!aiTasks) {
      state.ai = "engine";
      toast("Free AI busy or unreachable — grammar engine carrying. AI retries on your next breath.");
      render();
      return;
    }
  }
  state.aiCursor = state.transcript.length;
  const full = state.transcript.map((t) => t.text).join("\n");
  const engineTasks = understand(full, state.names, Date.now());
  aiTasks.forEach((t) => {
    t.verified = verifyTask(t, full);
    t.source = "ai";
    t.engineConfirmed = engineTasks.some((e) => overlap(e.task, t.task) > 0.5);
    const twin = state.tasks.find((x) => overlap(x.task, t.task) > 0.6);
    if (twin) {
      twin.quote = t.quote || twin.quote;
      twin.evidence = t.quote || twin.evidence;
      twin.source = "ai";
      twin.verified = t.verified;
      twin.engineConfirmed = true;
      if (!twin.owner && t.owner) twin.owner = t.owner;
      if (!twin.due && t.due) twin.due = t.due;
      if (t.money && !twin.money) twin.money = t.money;
    } else {
      state.tasks.push(t);
    }
  });
  save();
  render();
}

function aiExtract(text, key, base, model) {
  const langLabel = (LANGS.find((l) => l.code === state.lang) || {}).label || state.lang;
  const system = "You are the ear of Abeg, a Nigerian voice-task app. The transcript was spoken in " + langLabel + ". Extract every task, intention, reminder, report of something already done, and money commitment. Return ONLY JSON of shape {\"tasks\":[{\"task\": short English imperative, \"owner\": \"Me\" for the speaker, \"Us\" for the whole group, a person name, or null, \"due_label\": English like tonight/tomorrow/friday/4pm or null, \"done\": true only if the speaker said it is already done, \"money\": amount string or null, \"quote\": EXACT verbatim substring of the transcript that proves this task}]}. Every task must carry a quote copied word-for-word from the transcript. Never invent a task without a quote.";
  const payload = { model: model, temperature: 0.2, messages: [{ role: "system", content: system }, { role: "user", content: "TRANSCRIPT:\n" + text }] };
  const headers = { "Content-Type": "application/json" };
  if (key) headers.Authorization = "Bearer " + key;
  return fetch(base, { method: "POST", headers: headers, body: JSON.stringify(payload) })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .catch((netErr) => {
      if (!key) throw netErr;
      return fetch("/ai-proxy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base: base, model: model, key: key, messages: payload.messages }) })
        .then((r2) => { if (!r2.ok) throw new Error("relay HTTP " + r2.status); return r2.json(); });
    })
    .then((data) => {
      const raw = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
      const parsed = JSON.parse(raw.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "").trim());
      return (parsed.tasks || []).map((t) => ({
        task: String(t.task || "").slice(0, 140),
        owner: t.owner || null,
        due: t.due_label ? { label: String(t.due_label) } : null,
        done: !!t.done,
        money: t.money || null,
        quote: String(t.quote || ""),
        evidence: String(t.quote || t.task || ""),
        conflict: false,
      })).filter((t) => t.task);
    });
}

function verifyTask(t, full) {
  const hay = full.toLowerCase();
  if (!t.quote || hay.indexOf(t.quote.toLowerCase().trim()) === -1) return false;
  if (t.owner && t.owner !== "Me" && t.owner !== "Us" && hay.indexOf(String(t.owner).toLowerCase()) === -1) return false;
  if (t.due && t.due.label) {
    const toks = String(t.due.label).toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const q = (t.quote || "").toLowerCase();
    if (toks.length && !toks.some((w) => q.indexOf(w) !== -1 || hay.indexOf(w) !== -1)) return false;
  }
  return true;
}

function render() {
  const tasks = state.tasks;
  $("#resultsPanel").hidden = !tasks.length && !state.transcript.length;
  const d = digest(tasks);
  const cells = [
    { n: d.total, l: "tasks heard", c: "info" },
    { n: d.open, l: "still open", c: "info" },
    { n: d.done, l: "already done", c: "good" },
    { n: d.tonight, l: "due today", c: d.tonight ? "warn" : "info" },
    { n: d.unassigned, l: "no owner", c: d.unassigned ? "bad" : "good" },
    { n: d.conflicts, l: "date clashes", c: d.conflicts ? "bad" : "good" },
    { n: d.unverified, l: "unverified", c: d.unverified ? "warn" : "good" },
  ];
  $("#digest").innerHTML = cells.map((c) => "<div class=\"cell " + c.c + "\"><b>" + c.n + "</b><span>" + c.l + "</span></div>").join("");

  const st = runSelfTest(TEST_SET, state.names);
  $("#selfTest").innerHTML = "grammar engine self-test: <b>" + st.pass + "/" + st.total + "</b> pidgin sentences parsed correct · understanding by " +
    (state.ai === "key" ? "your AI key, checked by code" : state.ai === "free" ? "free keyless AI, checked by code" : state.ai === "engine" ? "the pidgin grammar engine alone" : "free keyless AI + grammar engine");

  const ul = $("#taskList");
  ul.innerHTML = "";
  tasks.forEach((t, i) => {
    const li = document.createElement("li");
    if (t.done) li.className = "done";
    if (!t.verified && t.source === "ai") li.className += " unverified";
    if (t.conflict) li.className += " conflict";
    const row = document.createElement("div");
    row.className = "trow";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!t.done;
    cb.setAttribute("aria-label", "Mark done: " + t.task);
    cb.addEventListener("change", () => { t.done = cb.checked; save(); render(); });
    const wrap = document.createElement("div");
    wrap.className = "ttext";
    const txt = document.createElement("div");
    txt.textContent = t.task;
    wrap.appendChild(txt);
    const chips = document.createElement("div");
    chips.className = "chips";
    const add = (label, cls) => { const s = document.createElement("span"); s.className = "chip " + (cls || ""); s.textContent = label; chips.appendChild(s); };
    if (t.owner) add(t.owner === "Me" ? "you" : t.owner, "owner"); else add("no owner", "badge");
    if (t.due && t.due.label) add("due " + t.due.label, "due");
    if (t.money) add(t.money, "money");
    if (t.done) add("done already", "eng");
    if (t.conflict) add("two dates clash", "badge");
    if (t.source === "ai" && !t.verified) add("unverified — quote not found", "warnb");
    if (t.source === "ai" && t.verified && t.engineConfirmed) add("AI + grammar agree", "eng");
    if (t.source === "engine") add("grammar engine", "eng");
    wrap.appendChild(chips);
    if (t.evidence) {
      const ev = document.createElement("details");
      ev.className = "ev";
      const sum = document.createElement("summary");
      sum.textContent = "the exact words";
      const q = document.createElement("q");
      q.textContent = t.evidence;
      ev.append(sum, q);
      wrap.appendChild(ev);
    }
    row.append(cb, wrap);
    li.appendChild(row);
    ul.appendChild(li);
  });

  const tl = $("#transcriptList");
  tl.innerHTML = "";
  state.transcript.slice(-12).forEach((tr) => {
    const li = document.createElement("li");
    const src = document.createElement("span");
    src.className = "src";
    src.textContent = tr.source === "voice" ? "🎤" : tr.source === "typed" ? "⌨️" : "▶";
    li.append(src, document.createTextNode(tr.text));
    tl.appendChild(li);
  });
  $("#sessionTag").textContent = "ABEG-" + hash(state.transcript.map((t) => t.text).join("|")).toUpperCase() + " · " + state.transcript.length + " breaths";
  $("#capySecret").hidden = tasks.length < 8;
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).slice(0, 6);
}

function copyDigest() {
  const d = digest(state.tasks);
  const lines = ["ABEG DIGEST — " + new Date().toLocaleString(),
    d.total + " tasks heard, " + d.open + " open, " + d.done + " done, " + d.tonight + " due today/tonight",
    ""];
  state.tasks.forEach((t) => {
    lines.push((t.done ? "[x] " : "[ ] ") + t.task + " — " + (t.owner || "no owner") + (t.due ? ", due " + t.due.label : "") + (t.verified === false ? " (UNVERIFIED)" : ""));
  });
  const text = lines.join("\n");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast("Digest copied"), () => toast("Copy blocked"));
  else toast("Copy blocked — long-press instead");
}

function downloadIcs() {
  const withDue = state.tasks.filter((t) => t.due && t.due.ms && !t.done);
  if (!withDue.length) { toast("No dated tasks yet"); return; }
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Abeg//voice tasks//EN"];
  withDue.forEach((t, i) => {
    const dt = new Date(t.due.ms).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    lines.push("BEGIN:VEVENT", "UID:abeg-" + i + "-" + Date.now(), "DTSTART:" + dt, "SUMMARY:" + t.task.replace(/,/g, "\\,"), "DESCRIPTION:" + (t.owner || "no owner"), "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
  a.download = "abeg-deadlines.ics";
  a.click();
  toast(withDue.length + " deadlines exported");
}
