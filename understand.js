const P_VERBS = "(pay|buy|send|call|tell|ask|meet|submit|print|design|draft|write|fix|carry|bring|fetch|collect|deliver|book|reserve|cook|clean|wash|sweep|charge|transfer|recharge|check|confirm|organise|organize|handle|sort|order|pick|drop|record|edit|upload|share|post|reply|answer|finish|complete|start|begin|prepare|pack|load|sign|measure|cut|sew|draw|paint|translate|invite|watch|attend|join|test|review|plan|schedule|email|scan|publish|deploy|host|register|update|renew|feed|water|practise|practice|rehearse|present|open|close|read|revise|study|memorize|memorise|solve|attempt|wash|iron|charge|bury|dig|lay|connect|install|arrange|decorate|mark|cover)";
const VERB_RE = new RegExp("\\b" + P_VERBS + "\\b", "i");
const DON_RE = new RegExp("\\b(don|done)\\s+([a-z']+\\s+)?" + P_VERBS + "\\b", "i");
const REMIND_RE = /\b(no|not|dont|don't|make\s+\w+\s+no)\s+forget\b/i;
const REMIND_ME = /\bremind\s+(me|us)\b/i;
const WE_RE = /^(we|make\s+we|all\s+of\s+us|make\s+we\s+all)\b/i;
const SELF_RE = /^(make\s+)?(me|i|myself)\b/i;
const SELF_MID = /\b(make|let)\s+(me|i)\b|\b(i|me)\s+(go|gon|wan|want|for|will|go go)\b|\bmy\s+own\b/i;
const DONE_WORD = /\balready\b|\bdon\b|\bdone\b/;
const DAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
const DAY_RE = /\b(today|tonight|tomorrow|weekend|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
const TIME_RE = /\b(\d{1,2})(?::(\d{2}))?\s?(am|pm)\b/i;
const CLOCK_RE = /\b(\d{1,2}):(\d{2})\b/;
const PART_RE = /\b(morning|afternoon|evening|night)\b/i;
const MONEY_RE = /(₦|naira|\b\d[\d,]{2,}\s?k\b)/i;
const LEAD_JUNK = /\b(abeg|please|pls|make\s+sure|remember\s+to|remind\s+me\s+to|dont\s+forget\s+to|don't\s+forget\s+to|no\s+forget\s+to|note\s+that|o\s*[,!]|oh|sha|abi|now|then|well|so|ok|okay)\b/gi;

function escRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function tokenize(t) {
  return String(t).toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
}

function overlap(a, b) {
  const A = tokenize(a), B = new Set(tokenize(b));
  if (!A.length) return 0;
  let n = 0;
  A.forEach((w) => { if (B.has(w)) n++; });
  return n / A.length;
}

function dayName(d) { return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]; }

const NEG_RE = /\b(no|not|dont|don't|wont|won't)\s+(go|gon|come|attend|pay|buy|send|do|bring|carry|fetch)\b/i;

function resolveDue(clause, fromMs) {
  const base = new Date(fromMs || Date.now());
  const labels = [];
  const dm = clause.match(DAY_RE);
  const tm = clause.match(TIME_RE) || clause.match(CLOCK_RE);
  const pm = clause.match(PART_RE);
  if (!dm && !tm && !pm) return null;
  let d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  if (dm) {
    const w = dm[1].toLowerCase();
    if (w === "today" || w === "tonight") labels.push(w === "tonight" ? "tonight" : "today");
    else if (w === "tomorrow") { d.setDate(d.getDate() + 1); labels.push("tomorrow"); }
    else if (w === "weekend") { d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7)); labels.push("weekend"); }
    else { const target = DAYS[w]; let diff = (target - d.getDay() + 7) % 7; if (diff === 0) diff = 7; d.setDate(d.getDate() + diff); labels.push(w); }
  }
  if (tm) {
    let h = parseInt(tm[1], 10);
    const min = tm[2] ? parseInt(tm[2], 10) : 0;
    if (/pm/i.test(tm[3] || "") && h < 12) h += 12;
    if (/am/i.test(tm[3] || "") && h === 12) h = 0;
    d.setHours(h, min, 0, 0);
    labels.push(tm[0].trim());
  } else if (pm) {
    const p = pm[1].toLowerCase();
    d.setHours(p === "morning" ? 9 : p === "afternoon" ? 14 : p === "evening" ? 17 : 21, 0, 0, 0);
    labels.push(p);
  } else {
    d.setHours(21, 0, 0, 0);
  }
  if (d.getTime() < base.getTime() && !/tomorrow|weekend|sunday|monday|tuesday|wednesday|thursday|friday|saturday/.test((dm || [])[1] || "")) d.setDate(d.getDate() + 1);
  const allDays = (clause.match(new RegExp(DAY_RE.source, "gi")) || []).map((x) => x.toLowerCase());
  const conflict = new Set(allDays).size > 1;
  return { label: labels.join(" "), ms: d.getTime(), iso: d.toISOString(), conflict: conflict };
}

function cleanTask(text, done) {
  let t = " " + String(text).trim() + " ";
  let prev = null;
  let guard = 0;
  while (prev !== t && guard < 8) {
    prev = t;
    t = t.replace(LEAD_JUNK, " ");
    if (done) t = t.replace(/\b(don|done|already)\b/gi, " ");
    t = t.replace(/\bmake\s+[a-z']+\s+(?:no\s+|not\s+)?(?:forget\s+)?(?:to\s+)?/i, " ");
    t = t.replace(/\b(?:say\s+na|na)\s+/i, " ");
    t = t.replace(new RegExp("^\\s*(make\\s+)?(me|i|myself)\\s+(go|gon|wan|want|for|will|go\\s+go|don|done)?\\s*", "i"), " ");
    t = t.replace(new RegExp("^\\s*(tell|ask|remind)\\s+[a-z']+\\s+(to|say|make|say\\s+make)?\\s*", "i"), " ");
    t = t.replace(/^\s*(no|not|dont|don't)\s+forget\s+(to\s+)?/i, "remember to ");
    t = t.replace(new RegExp("^\\s*[a-z']+\\s+(go|gon|wan|want|for|suppose|supposed\\s+to|will|don|done)\\s+", "i"), " ");
    t = t.replace(/^\s*(to|for\s+me\s+to|and\s+then|then|plus|also)\s+/i, " ");
    t = t.replace(/\s+/g, " ");
    guard++;
  }
  t = t.replace(/\s+o\b[.,;!?\s]*$/i, " ");
  return t.trim().replace(/[.,;!?\s]+$/, "");
}

function ownerOf(clause, names, reminder) {
  const c = clause.trim();
  const told = c.match(/\b(tell|ask|remind)\s+([a-zA-Z']+)\b/i);
  const makeX = c.match(/\bmake\s+([a-zA-Z']+)\s+(?:no|not)?\s*(?:forget\s+)?(?:to\s+)?/i);
  if (told && /^(me|i|myself)$/i.test(told[2])) return "Me";
  if (makeX && /^(we|us)$/i.test(makeX[1])) return "Us";
  if (makeX && names.indexOf(makeX[1].toLowerCase()) !== -1) return cap(makeX[1]);
  if (SELF_RE.test(c) || SELF_MID.test(c)) return "Me";
  if (WE_RE.test(c)) return "Us";
  if (told && names.indexOf(told[2].toLowerCase()) !== -1) return cap(told[2]);
  if (reminder) return null;
  const lead = c.match(/^([a-zA-Z']+)\s+(go|gon|wan|want|for|suppose|will|don|done)\b/i);
  if (lead && names.indexOf(lead[1].toLowerCase()) !== -1) return cap(lead[1]);
  const mid = c.match(new RegExp("\\b(" + names.map(escRe).join("|") + ")\\b", "i"));
  if (mid && names.length) return cap(mid[1]);
  if (VERB_RE.test(c) && c.search(VERB_RE) === 0) return "Me";
  return null;
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function splitClauses(text) {
  return String(text)
    .replace(/([.!?])\s+/g, "$1\n")
    .split(/\n|,\s*|\s+and\s+then\s+|\s+plus\s+|\s+also\s+/i)
    .map((s) => s.trim().replace(/[.,;!?\s]+$/, ""))
    .filter((s) => s.length > 3);
}

function understandClause(clause, names, fromMs) {
  const c = String(clause).trim();
  if (!VERB_RE.test(c)) return null;
  const reminder = REMIND_RE.test(c) || REMIND_ME.test(c);
  if (!reminder && NEG_RE.test(c)) return null;
  const done = DON_RE.test(c) || (DONE_WORD.test(c) && VERB_RE.test(c) && /\b(don|done)\b/.test(c));
  const owner = ownerOf(c, names, reminder) || (reminder ? "Me" : null);
  const due = resolveDue(c, fromMs);
  const money = c.match(MONEY_RE);
  let task = cleanTask(c, done);
  if (reminder && !/^remember/i.test(task)) task = "Remember: " + task;
  if (!task || task.length < 4) return null;
  const verbHit = task.match(VERB_RE);
  if (!verbHit && !reminder) return null;
  return {
    task: task.slice(0, 140),
    owner: owner,
    due: due ? { label: due.label, ms: due.ms, iso: due.iso } : null,
    conflict: due ? due.conflict : false,
    done: !!done && !reminder,
    money: money ? money[0].trim() : null,
    evidence: c,
  };
}

function understand(text, names, fromMs) {
  const out = [];
  const seen = new Set();
  for (const clause of splitClauses(text || "")) {
    const t = understandClause(clause, names || [], fromMs);
    if (!t) continue;
    const key = tokenize(t.task).slice(0, 5).join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    const re = understandClause(t.evidence, names || [], fromMs);
    t.verified = !!re && re.owner === t.owner && (re.due ? re.due.label : null) === (t.due ? t.due.label : null) && re.done === t.done && overlap(re.task, t.task) > 0.6;
    out.push(t);
  }
  return out;
}

function digest(tasks) {
  const owners = {};
  tasks.forEach((t) => { if (!t.done) owners[t.owner || "Unassigned"] = (owners[t.owner || "Unassigned"] || 0) + 1; });
  return {
    total: tasks.length,
    open: tasks.filter((t) => !t.done).length,
    done: tasks.filter((t) => t.done).length,
    tonight: tasks.filter((t) => t.due && /tonight|today/.test(t.due.label)).length,
    conflicts: tasks.filter((t) => t.conflict).length,
    unverified: tasks.filter((t) => !t.verified).length,
    unassigned: tasks.filter((t) => !t.owner && !t.done).length,
    owners: owners,
  };
}

function runSelfTest(set, names) {
  let pass = 0;
  const fails = [];
  const nm = names && names.length ? names : (typeof NAMES_DEFAULT !== "undefined" ? NAMES_DEFAULT : []);
  (set || []).forEach((c) => {
    const got = understand(c.said, c.names || nm, c.at || Date.now());
    const d = digest(got);
    const ok =
      (c.expect.tasks === undefined || got.length === c.expect.tasks) &&
      (c.expect.owner === undefined || (got[0] && got[0].owner === c.expect.owner)) &&
      (c.expect.done === undefined || (got[0] && got[0].done === c.expect.done)) &&
      (c.expect.due === undefined || (got[0] && got[0].due && got[0].due.label.indexOf(c.expect.due) !== -1)) &&
      (c.expect.unassigned === undefined || d.unassigned === c.expect.unassigned) &&
      (c.expect.conflict === undefined || d.conflicts === c.expect.conflict);
    if (ok) pass++;
    else fails.push(c.said + "  ->  " + JSON.stringify(got.map((t) => [t.task, t.owner, t.due && t.due.label, t.done])));
  });
  return { pass: pass, total: (set || []).length, fails: fails };
}
