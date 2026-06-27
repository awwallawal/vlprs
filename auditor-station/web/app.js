// Auditor Station — plain streaming chat (no framework). Talks to the local station API.

const $ = (id) => document.getElementById(id);
const log = $("log");
const form = $("form");
const qBox = $("q");
const pinBox = $("pin");
const sendBtn = $("send");

const TOOL_LABEL = {
  search_beneficiary: "searching the catalog…",
  get_mda_summary: "summarizing the MDA…",
  verify_loan_computation: "verifying the computation…",
  query_catalog: "querying the records…",
};

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function addUser(text) {
  const m = el("div", "msg user", text);
  log.appendChild(m);
  m.scrollIntoView({ block: "end" });
}

// Returns handles to update the assistant bubble as the stream arrives.
function addAssistant() {
  const wrap = el("div", "msg assistant");
  const progress = el("div", "progress", "thinking…");
  const body = el("div", "body");
  const cites = el("div", "cites");
  wrap.append(progress, body, cites);
  log.appendChild(wrap);
  wrap.scrollIntoView({ block: "end" });
  return {
    setProgress: (t) => { progress.textContent = t; },
    clearProgress: () => progress.remove(),
    appendText: (t) => { body.textContent += t; wrap.scrollIntoView({ block: "end" }); },
    setText: (t) => { body.textContent = t; },
    setCitations: (list) => {
      cites.innerHTML = "";
      (list || []).forEach((c) => cites.appendChild(el("span", "chip", c)));
    },
    addNote: (t) => { body.appendChild(el("div", "note", t)); },
    error: (t) => { progress.remove(); body.appendChild(el("div", "note", t)); },
  };
}

async function loadMeta() {
  try {
    const res = await fetch("/api/meta");
    const data = await res.json();
    $("banner").textContent = data.banner || "snapshot ready";
  } catch {
    $("banner").textContent = "Could not reach the station.";
  }
}

// Parse a Server-Sent Events stream, invoking onEvent for each JSON data: block.
async function readSSE(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = block.split("\n").find((l) => l.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)));
    }
  }
}

async function ask(question) {
  const ui = addAssistant();
  sendBtn.disabled = true;
  try {
    const res = await fetch("/api/ask/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, pin: pinBox.value || undefined }),
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      ui.error(data.error || `Request failed (${res.status}).`);
      if (res.status === 400 && /pin/i.test(data.error || "")) $("pin-row").classList.remove("hidden");
      return;
    }
    let streamed = false;
    await readSSE(res, (ev) => {
      if (ev.type === "tool") ui.setProgress(TOOL_LABEL[ev.name] || `running ${ev.name}…`);
      else if (ev.type === "text") { streamed = true; ui.appendText(ev.chunk); }
      else if (ev.type === "done") {
        ui.clearProgress();
        // The sanitized answer is authoritative — replace any raw streamed text with it.
        if (ev.answer != null) ui.setText(ev.answer);
        ui.setCitations(ev.citations);
        if (ev.violations && ev.violations.length) ui.addNote("Phrasing adjusted to neutral language.");
      } else if (ev.type === "error") {
        ui.error(ev.error || "Something went wrong.");
        if (/pin/i.test(ev.error || "")) $("pin-row").classList.remove("hidden");
      }
    });
    if (!streamed) ui.clearProgress();
  } catch (e) {
    ui.error("Could not reach the station.");
  } finally {
    sendBtn.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = qBox.value.trim();
  if (!q) return;
  addUser(q);
  qBox.value = "";
  ask(q);
});

// Submit on Enter (Shift+Enter for newline).
qBox.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});

loadMeta();
