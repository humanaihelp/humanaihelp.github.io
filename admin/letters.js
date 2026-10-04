/* Letter Studio — create letters on the official letterhead, download / print as PDF,
   and keep a register of every letter in a PRIVATE GitHub repository (or this browser when offline). */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var SITE = null, LIST = [], CUR = null;
  var LOGO = new URL("../assets/img/icon-192.png", location.href).href;

  var TEMPLATES = {
    blank: { name: "Blank letter", subject: "", body: "<p>Dear [Name],</p><p>[Write your letter here.]</p><p>Thank you.</p>" },
    appreciation: { name: "Appreciation / contribution", subject: "Letter of Appreciation & Contribution",
      body: "<p>To Whom It May Concern,</p><p>This is to certify that <b>[Full name]</b> contributed to {name}, Bengaluru, as a <b>[volunteer / intern / freelance contributor]</b> from <b>[DD Month YYYY]</b> to <b>[DD Month YYYY]</b>.</p><p>During this period, [he/she/they] contributed to:</p><ul><li>[Contribution 1 — only work actually done]</li><li>[Contribution 2]</li></ul><p>We thank [him/her/them] for this contribution and wish [him/her/them] every success.</p><p>For verification, please contact {phone} or {email}.</p>" },
    service: { name: "Service confirmation", subject: "Confirmation of Services",
      body: "<p>Dear [Client name],</p><p>Thank you for choosing {name}. This letter confirms that we will provide <b>[service]</b> as per quotation no. <b>[HAC-Q-___]</b>, starting <b>[date]</b>.</p><p>Your concierge will be <b>[name, phone]</b>. Third-party costs are billed at actuals, and we will never ask for OTPs, PINs or passwords.</p><p>We look forward to helping you.</p>" },
    payment: { name: "Payment acknowledgement", subject: "Acknowledgement of Payment",
      body: "<p>Dear [Client name],</p><p>We acknowledge with thanks the receipt of <b>₹[amount]</b> on <b>[date]</b> by <b>[UPI / bank transfer]</b> (reference <b>[UTR]</b>) towards <b>[invoice / quotation no.]</b>.</p><p>This is an acknowledgement letter; the tax invoice is issued separately.</p>" },
    familyreport: { name: "Monthly Family Report (NRI plans)", subject: "Monthly Family Report — [Month YYYY]",
      body: "<p>Dear [Client name],</p><p>Here is this month's summary for <b>[Parent's name]</b> at <b>[area, Bengaluru]</b>.</p>" +
        "<table class='rep'><tr><th colspan='3'>Visits &amp; calls</th></tr><tr><td>[DD Mon]</td><td>Home visit</td><td>[Mood, wellbeing, anything noticed]</td></tr><tr><td>[DD Mon]</td><td>Phone call</td><td>[Notes]</td></tr></table>" +
        "<table class='rep'><tr><th colspan='3'>Doctor appointments</th></tr><tr><td>[DD Mon]</td><td>[Doctor / hospital]</td><td>[Outcome as shared by the doctor · next visit DD Mon]</td></tr></table>" +
        "<table class='rep'><tr><th colspan='3'>Medicines &amp; tests</th></tr><tr><td>[DD Mon]</td><td>[Refill / lab test]</td><td>[Next due DD Mon]</td></tr></table>" +
        "<table class='rep'><tr><th colspan='3'>Home &amp; errands</th></tr><tr><td>[DD Mon]</td><td>[Repair / errand]</td><td>[Vendor, cost at actuals]</td></tr></table>" +
        "<table class='rep'><tr><th colspan='3'>Coming up next month</th></tr><tr><td>[DD Mon]</td><td>[Renewal / appointment / festival]</td><td>[Action planned]</td></tr></table>" +
        "<p><b>Note from your concierge:</b> [A warm, honest 2–3 line note.]</p><p>Photos from this month have been shared on WhatsApp. Medical details above are as shared by the treating doctor; please confirm any medical decision with the doctor directly.</p>" },
    noc: { name: "To whom it may concern (general)", subject: "To Whom It May Concern",
      body: "<p>To Whom It May Concern,</p><p>[State the facts to be certified clearly and briefly.]</p><p>This letter is issued on request for [purpose].</p>" }
  };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fill(t) { return t.replace(/\{(\w+)\}/g, function (_, k) { var v = SITE ? (k === "phone" ? SITE.phone_display : SITE[k]) : ""; return esc(v == null ? "" : v); }); }
  function toast(m) { var t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2800); }
  function auth() { return window.HAC ? window.HAC.auth() : { mode: "local" }; }
  function lettersRepo() { return ($("#lsRepo").value || "humanai-letters").trim(); }
  function today() { var d = new Date(); return d.toISOString().slice(0, 10); }
  function prettyDate(iso) { var d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }); }
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function unb64(s) { return decodeURIComponent(escape(atob(s.replace(/\n/g, "")))); }

  /* ---------- GitHub (private letters repo) ---------- */
  function gh(method, path, body) {
    var a = auth();
    return fetch("https://api.github.com/repos/" + a.owner + "/" + lettersRepo() + path, {
      method: method, headers: { "Authorization": "Bearer " + a.token, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { if (r.status === 404) { var e = new Error("not found"); e.code = 404; throw e; } if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + " " + t.slice(0, 160)); }); return r.json(); });
  }
  function putFile(path, contentB64, msg) {
    return gh("GET", "/contents/" + path).then(function (f) { return f.sha; }, function () { return null; })
      .then(function (sha) { var body = { message: msg, content: contentB64 }; if (sha) body.sha = sha; return gh("PUT", "/contents/" + path, body); });
  }

  /* ---------- register ---------- */
  function loadList() {
    var a = auth();
    if (a.mode !== "github") {
      try { LIST = JSON.parse(localStorage.getItem("hac-letters") || "[]"); } catch (e) { LIST = []; }
      renderList(); return Promise.resolve();
    }
    $("#lsStatus").textContent = "Loading letters…";
    return gh("GET", "").then(function (repo) {
      if (!repo.private) $("#lsStatus").innerHTML = "⚠️ The letters repository is <b>public</b>. Make it private in GitHub → Settings → Danger zone → Change visibility.";
      else $("#lsStatus").textContent = "Saved privately in " + a.owner + "/" + lettersRepo();
      return gh("GET", "/contents/letters/index.json").then(function (f) { LIST = JSON.parse(unb64(f.content)); LIST._sha = f.sha; }, function () { LIST = []; });
    }).then(renderList).catch(function (e) {
      LIST = []; renderList();
      $("#lsStatus").innerHTML = e.code === 404
        ? "Create a <b>private</b> repository named <b>" + esc(lettersRepo()) + "</b> in your GitHub organisation (tick “Add a README”), and give your token access to it (Contents: Read and write). Then reopen this tab."
        : "Could not load letters: " + esc(e.message);
    });
  }
  function renderList() {
    var box = $("#lsList"); box.innerHTML = "";
    if (!LIST.length) { box.innerHTML = '<p class="hint">No letters yet.</p>'; return; }
    LIST.slice().sort(function (a, b) { return (b.createdAt || "").localeCompare(a.createdAt || ""); }).forEach(function (l) {
      var it = document.createElement("div"); it.className = "it";
      it.innerHTML = "<span><b>" + esc(l.ref) + "</b><br><span class='hint'>" + esc(prettyDate(l.date)) + " · " + esc(l.subject || "(no subject)") + " · " + esc((l.to || "").split("\n")[0]) + "</span></span><span class='acts' style='margin:0'></span>";
      var acts = it.querySelector(".acts");
      [["Open", function () { openLetter(l); }], ["PDF", function () { openLetter(l); setTimeout(downloadPdf, 300); }], ["Copy as new", function () { openLetter(Object.assign({}, l, { ref: null, date: today(), createdAt: null })); }]].forEach(function (b) {
        var x = document.createElement("button"); x.className = "btn sm"; x.textContent = b[0]; x.onclick = function (e) { e.stopPropagation(); b[1](); }; acts.appendChild(x);
      });
      box.appendChild(it);
    });
  }
  function nextRef() {
    var y = today().slice(0, 4), n = LIST.filter(function (l) { return (l.ref || "").indexOf("HAC/L/" + y + "/") === 0; }).length + 1;
    return "HAC/L/" + y + "/" + String(n).padStart(3, "0");
  }

  /* ---------- letter rendering ---------- */
  function letterHTML(l) {
    var s = SITE || {};
    var sig = l.signatory === "muttu" ? ["Muttu Biradar", "Operations &amp; Technology Lead"] : [esc(s.proprietor || "Deepa Garasangi"), "Founder &amp; Proprietor"];
    var foot1 = esc(s.name) + " · Proprietor: " + esc(s.proprietor) + (s.gstin ? " · GSTIN: " + esc(s.gstin) : "");
    var foot2 = esc(s.phone_display) + " (call / WhatsApp) · " + esc(s.email) + " · " + esc(location.host + location.pathname.replace(/admin\/.*$/, "")) + " · Bengaluru, Karnataka, India";
    return '<div class="lh-page">' +
      '<div class="lh-head"><img src="' + LOGO + '" alt=""><div><b>HumanAI Concierge</b><small>SERVICES</small></div><span class="lh-tag">Real people. Smarter help.</span></div>' +
      '<div class="lh-meta"><div>Date: ' + esc(prettyDate(l.date)) + '</div><div>Ref: ' + esc(l.ref || "(assigned on save)") + '</div></div>' +
      (l.to ? '<div class="lh-to">' + esc(l.to).replace(/\n/g, "<br>") + '</div>' : "") +
      (l.subject ? '<div class="lh-subj"><b>Subject:</b> ' + esc(l.subject) + '</div>' : "") +
      '<div class="lh-body">' + l.body + '</div>' +
      '<div class="lh-sign"><div>For ' + esc(s.name) + ',</div><div class="lh-space"></div><b>' + sig[0] + '</b><div>' + sig[1] + '</div></div>' +
      '<div class="lh-foot"><div>' + foot1 + '</div><div>' + foot2 + '</div></div>' +
      '</div>';
  }
  var LH_CSS = "*{box-sizing:border-box}body{margin:0;font-family:Calibri,'Segoe UI',Arial,sans-serif;color:#16182c}" +
    ".lh-page{width:210mm;min-height:297mm;padding:16mm 20mm 34mm;position:relative;background:#fff;font-size:11.5pt;line-height:1.5}" +
    ".lh-head{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1.5px solid #e3e1ec}.lh-head img{width:44px;height:44px}" +
    ".lh-head b{display:block;font-size:17pt;letter-spacing:-.02em;font-family:Arial,sans-serif}.lh-head small{letter-spacing:.25em;color:#636782;font-size:7.5pt}" +
    ".lh-tag{margin-left:auto;font-style:italic;color:#4f46e5;font-family:Georgia,serif}" +
    ".lh-meta{text-align:right;color:#636782;margin:14px 0 18px;font-size:10.5pt}.lh-to{margin-bottom:14px}.lh-subj{margin-bottom:14px}" +
    ".lh-body table.rep{width:100%;border-collapse:collapse;margin:0 0 10px;font-size:10pt}.lh-body table.rep th{background:#eceafe;color:#4f46e5;text-align:left;padding:4px 8px}.lh-body table.rep td{border:1px solid #e3e1ec;padding:4px 8px;vertical-align:top}.lh-body table.rep td:first-child{width:16%;white-space:nowrap}.lh-body table.rep td:nth-child(2){width:30%}" +
    ".lh-body p{margin:0 0 10px}.lh-body ul{margin:0 0 10px 18px;padding:0}.lh-sign{margin-top:26px}.lh-space{height:46px}" +
    ".lh-foot{position:absolute;left:20mm;right:20mm;bottom:12mm;border-top:1.5px solid #e3e1ec;padding-top:6px;text-align:center;color:#636782;font-size:8pt;line-height:1.5}" +
    "@page{size:A4;margin:0}@media print{.lh-page{min-height:296mm}}";

  function current() {
    return { ref: CUR && CUR.ref, date: $("#lsDate").value || today(), to: $("#lsTo").value, subject: $("#lsSubject").value,
      body: $("#lsBody").innerHTML, signatory: $("#lsSign").value, template: $("#lsTpl").value, createdAt: CUR && CUR.createdAt };
  }
  function preview() { var f = $("#lsPreview"); f.srcdoc = "<!doctype html><html><head><meta charset='utf-8'><style>" + LH_CSS + "body{background:#e9e7f1;padding:16px}.lh-page{margin:0 auto;box-shadow:0 10px 30px rgba(0,0,0,.15)}</style></head><body>" + letterHTML(current()) + "</body></html>"; }
  function openLetter(l) {
    CUR = l; $("#lsDate").value = l.date || today(); $("#lsTo").value = l.to || ""; $("#lsSubject").value = l.subject || "";
    $("#lsBody").innerHTML = l.body || ""; $("#lsSign").value = l.signatory || "deepa"; $("#lsTpl").value = l.template || "blank"; preview();
  }
  function useTemplate() { var t = TEMPLATES[$("#lsTpl").value]; if (!t) return; if ($("#lsBody").textContent.trim() && !confirm("Replace the current letter text with this template?")) return; $("#lsSubject").value = t.subject; $("#lsBody").innerHTML = fill(t.body); preview(); }

  /* ---------- PDF & print ---------- */
  function pdfBlob() {
    if (!window.html2pdf) return Promise.reject(new Error("PDF library not loaded (check internet). Use Print → Save as PDF instead."));
    var holder = document.createElement("div"); holder.style.cssText = "position:fixed;left:-10000px;top:0";
    holder.innerHTML = "<style>" + LH_CSS + ".lh-page{min-height:295mm}</style>" + letterHTML(current()); document.body.appendChild(holder);
    return html2pdf().set({ margin: 0, filename: "letter.pdf", image: { type: "jpeg", quality: 0.96 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"] } })
      .from(holder.querySelector(".lh-page")).outputPdf("blob").then(function (b) { holder.remove(); return b; }, function (e) { holder.remove(); throw e; });
  }
  function fileName(l) { return (l.ref || "draft").replace(/\//g, "-") + (l.subject ? "-" + l.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 40) : "") + ".pdf"; }
  function downloadPdf() {
    pdfBlob().then(function (b) { var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = fileName(current()); document.body.appendChild(a); a.click(); a.remove(); })
      .catch(function (e) { toast(e.message); });
  }
  function printLetter() {
    var w = window.open("", "_blank"); if (!w) return toast("Allow pop-ups to print");
    w.document.write("<!doctype html><html><head><meta charset='utf-8'><title>" + esc(current().ref || "Letter") + "</title><style>" + LH_CSS + "</style></head><body>" + letterHTML(current()) + "<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>");
    w.document.close();
  }

  /* ---------- save ---------- */
  function save() {
    var l = current();
    if (!l.body.replace(/<[^>]+>/g, "").trim()) return toast("Write the letter first");
    if (!l.ref) l.ref = nextRef();
    if (!l.createdAt) l.createdAt = new Date().toISOString();
    CUR = l; preview();
    var a = auth();
    if (a.mode !== "github") {
      LIST = LIST.filter(function (x) { return x.ref !== l.ref; }).concat([l]);
      try { localStorage.setItem("hac-letters", JSON.stringify(LIST)); } catch (e) { /* ignore */ }
      renderList(); downloadPdf(); toast("Saved in this browser and PDF downloaded"); return;
    }
    $("#lsStatus").textContent = "Saving " + l.ref + "…";
    var base = "letters/" + l.date.slice(0, 4) + "/" + l.ref.replace(/\//g, "-");
    pdfBlob().then(function (blob) {
      return new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result.split(",")[1]); }; r.readAsDataURL(blob); });
    }).catch(function () { return null; }).then(function (pdf64) {
      var steps = putFile(base + ".json", b64(JSON.stringify(l, null, 2)), "Letter " + l.ref);
      if (pdf64) steps = steps.then(function () { return putFile(base + ".pdf", pdf64, "Letter PDF " + l.ref); });
      return steps.then(function () {
        LIST = LIST.filter(function (x) { return x.ref !== l.ref; }).concat([{ ref: l.ref, date: l.date, to: l.to, subject: l.subject, body: l.body, signatory: l.signatory, template: l.template, createdAt: l.createdAt, pdf: pdf64 ? base + ".pdf" : null }]);
        return putFile("letters/index.json", b64(JSON.stringify(LIST, null, 2)), "Update letters register");
      });
    }).then(function () { renderList(); $("#lsStatus").textContent = "Saved " + l.ref + " (PDF + copy) privately in " + a.owner + "/" + lettersRepo(); toast("Letter saved ✓"); })
      .catch(function (e) { $("#lsStatus").textContent = "Saving failed: " + e.message; });
  }

  /* ---------- open studio ---------- */
  function openStudio() {
    $("#letterStudio").classList.add("on");
    var a = auth();
    var p = a.mode === "github" ? fetch(new URL("../assets/site.json", location.href).href, { cache: "no-store" }) : fetch(new URL("../assets/site.json", location.href).href, { cache: "no-store" });
    p.then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (s) {
      SITE = s; if (!CUR) openLetter({ date: today(), template: "blank", body: fill(TEMPLATES.blank.body), signatory: "deepa" }); else preview(); loadList();
    });
  }
  window.HACLetters = { open: openStudio };
  document.addEventListener("DOMContentLoaded", function () {
    var sel = $("#lsTpl"); Object.keys(TEMPLATES).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = TEMPLATES[k].name; sel.appendChild(o); });
    $("#lsUseTpl").onclick = useTemplate;
    ["#lsDate", "#lsTo", "#lsSubject", "#lsSign"].forEach(function (id) { $(id).addEventListener("input", preview); });
    $("#lsBody").addEventListener("input", function () { clearTimeout(preview._t); preview._t = setTimeout(preview, 250); });
    $("#lsNew").onclick = function () { CUR = null; openLetter({ date: today(), template: "blank", body: fill(TEMPLATES.blank.body), signatory: "deepa" }); };
    $("#lsSave").onclick = save; $("#lsPdf").onclick = downloadPdf; $("#lsPrint").onclick = printLetter;
    $("#lsClose").onclick = function () { $("#letterStudio").classList.remove("on"); };
    $("#lsRepo").addEventListener("change", loadList);
    document.querySelectorAll("[data-fmt]").forEach(function (b) { b.onclick = function () { document.execCommand(b.getAttribute("data-fmt"), false, null); $("#lsBody").focus(); preview(); }; });
  });
})();
