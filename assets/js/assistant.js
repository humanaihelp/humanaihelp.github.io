/* HumanAI Assistant — a free, private, on-page helper.
   Answers common questions from assets/assistant.json (editable in the admin page)
   and hands over to a real person on WhatsApp. No data leaves the visitor's browser. */
(function () {
  "use strict";
  var KB = null, lastQ = "", HIST = [], WA = document.body.getAttribute("data-wa") || "";
  var ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>';

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function norm(s) { return " " + s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ") + " "; }

  var btn = el("button", "ai-fab", ICON + "<span>Ask us</span>");
  btn.type = "button"; btn.setAttribute("aria-label", "Open chat assistant"); btn.setAttribute("aria-expanded", "false");
  var panel = el("div", "ai-panel"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Chat assistant"); panel.hidden = true;
  panel.innerHTML =
    '<div class="ai-head"><span class="ai-badge">' + ICON + '</span><div><b class="ai-name">HumanAI Assistant</b><small>Automated helper · real people on WhatsApp</small></div>' +
    '<button type="button" class="ai-x" aria-label="Close">×</button></div>' +
    '<div class="ai-log" aria-live="polite"></div>' +
    '<div class="ai-chips"></div>' +
    '<form class="ai-form"><input type="text" class="ai-in" placeholder="Type your question…" aria-label="Your question" autocomplete="off"><button type="submit" class="ai-send" aria-label="Send">➤</button></form>' +
    '<a class="ai-human" target="_blank" rel="noopener">Ask a person on WhatsApp</a>' +
    '<p class="ai-disc"></p>';
  document.body.appendChild(btn); document.body.appendChild(panel);
  var log = panel.querySelector(".ai-log"), chips = panel.querySelector(".ai-chips"), input = panel.querySelector(".ai-in"), human = panel.querySelector(".ai-human");

  function setHuman() {
    var t = "Hi HumanAI Concierge! " + (lastQ ? "My question: " + lastQ : "I have a question.");
    human.href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(t);
  }
  function say(text, who, link) {
    var m = el("div", "ai-msg " + who);
    m.innerHTML = esc(text) + (link ? '<a class="ai-link" href="' + esc(link.href) + '">' + esc(link.text) + " →</a>" : "");
    log.appendChild(m); log.scrollTop = log.scrollHeight;
  }
  function typing(cb) {
    var t = el("div", "ai-msg bot ai-typing", "<i></i><i></i><i></i>"); log.appendChild(t); log.scrollTop = log.scrollHeight;
    setTimeout(function () { t.remove(); cb(); }, 450 + Math.random() * 350);
  }
  function answer(q) {
    var n = norm(q), best = null, bestScore = 0;
    KB.answers.forEach(function (a) {
      var s = 0;
      a.keys.forEach(function (k) { if (n.indexOf(" " + k.toLowerCase() + " ") !== -1 || (k.length > 4 && n.indexOf(k.toLowerCase()) !== -1)) s += k.split(" ").length * 2; });
      if (s > bestScore) { bestScore = s; best = a; }
    });
    var indic = /[ಀ-೿ऀ-ॿ]/.test(q);
    if (best) return { text: best.answer + (indic ? " (A person can reply in Kannada or Hindi on WhatsApp.)" : ""), link: best.link ? { href: best.link, text: best.linkText || "Learn more" } : null };
    return { text: KB.fallback + (indic ? " ನಮಗೆ WhatsApp ಮಾಡಿ / हमें WhatsApp करें." : ""), link: null };
  }
  function ask(q) {
    q = q.trim(); if (!q) return;
    lastQ = q; setHuman(); say(q, "me");
    var local = answer(q);
    if (!KB.ai_url || /emergency|ambulance|112|108/i.test(q)) { typing(function () { say(local.text, "bot", local.link); }); return; }
    var t = el("div", "ai-msg bot ai-typing", "<i></i><i></i><i></i>"); log.appendChild(t); log.scrollTop = log.scrollHeight;
    HIST.push({ role: "user", content: q.slice(0, 600) });
    var ctrl = window.AbortController ? new AbortController() : null, timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 12000);
    fetch(KB.ai_url.replace(/\/$/, "") + "/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: HIST.slice(-6) }), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { if (!j.reply) throw new Error("empty"); HIST.push({ role: "assistant", content: j.reply }); t.remove(); say(j.reply, "bot", local.link); })
      .catch(function () { HIST.pop(); t.remove(); say(local.text, "bot", local.link); })
      .then(function () { clearTimeout(timer); });
  }
  function init() {
    panel.querySelector(".ai-name").textContent = KB.name || "HumanAI Assistant";
    panel.querySelector(".ai-disc").textContent = KB.disclaimer || "";
    say(KB.greeting, "bot");
    (KB.suggestions || []).forEach(function (s) { var c = el("button", "ai-chip", esc(s)); c.type = "button"; c.onclick = function () { ask(s); }; chips.appendChild(c); });
    setHuman();
  }
  function open(v) {
    panel.hidden = !v; btn.setAttribute("aria-expanded", v ? "true" : "false"); btn.classList.toggle("on", v);
    if (v && !KB) {
      fetch("assets/assistant.json", { cache: "no-cache" }).then(function (r) { return r.json(); })
        .then(function (j) { KB = j; return fetch("assets/site.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (c) { if (!KB.ai_url && c.worker_url) KB.ai_url = c.worker_url; }).catch(function () {}); })
        .then(function () { init(); })
        .catch(function () { KB = { answers: [], greeting: "Hi! Please message us on WhatsApp and a person will help you.", fallback: "Please message us on WhatsApp.", suggestions: [] }; init(); });
    }
    if (v) setTimeout(function () { input.focus(); }, 50);
  }
  btn.onclick = function () { open(panel.hidden); };
  panel.querySelector(".ai-x").onclick = function () { open(false); btn.focus(); };
  panel.querySelector(".ai-form").onsubmit = function (e) { e.preventDefault(); ask(input.value); input.value = ""; };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) open(false); });
})();
