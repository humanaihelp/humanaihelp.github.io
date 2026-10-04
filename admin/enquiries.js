/* Enquiry log viewer — reads the private log kept by the free Cloudflare Worker (tools/ai-chatbot-worker.js). */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var ITEMS = [], FILTER = "All", STATUSES = ["New", "Contacted", "Quoted", "Won", "Closed"];
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function toast(m) { var t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600); }
  function base() {
    return fetch(new URL("../assets/site.json", location.href).href, { cache: "no-store" }).then(function (r) { return r.json(); })
      .then(function (s) { if (!s.worker_url) throw new Error("Set the chatbot & enquiry service address in Site settings first (ADMIN-GUIDE section 9)."); return s.worker_url.replace(/\/$/, ""); });
  }
  function key() { return $("#enqKey").value.trim(); }
  function call(path, opts) {
    return base().then(function (b) {
      opts = opts || {}; opts.headers = Object.assign({ "Authorization": "Bearer " + key(), "Content-Type": "application/json" }, opts.headers || {});
      return fetch(b + path, opts).then(function (r) { if (r.status === 401) throw new Error("Wrong password (ADMIN_KEY)."); if (!r.ok) throw new Error("Service error " + r.status); return r.json(); });
    });
  }
  function load() {
    if (!key()) return toast("Enter the enquiry log password");
    try { if ($("#enqRemember").checked) localStorage.setItem("hac-enq-key", key()); else localStorage.removeItem("hac-enq-key"); } catch (e) { /* ignore */ }
    $("#enqStatus").textContent = "Loading…";
    call("/enquiries").then(function (j) { ITEMS = j.items || []; render(); }).catch(function (e) { $("#enqStatus").textContent = e.message; });
  }
  function render() {
    var counts = { All: ITEMS.length }; STATUSES.forEach(function (s) { counts[s] = ITEMS.filter(function (i) { return (i.status || "New") === s; }).length; });
    $("#enqFilter").innerHTML = "";
    ["All"].concat(STATUSES).forEach(function (s) {
      var b = document.createElement("button"); b.className = "btn sm" + (FILTER === s ? " primary" : ""); b.textContent = s + " (" + counts[s] + ")";
      b.onclick = function () { FILTER = s; render(); }; $("#enqFilter").appendChild(b);
    });
    var list = ITEMS.filter(function (i) { return FILTER === "All" || (i.status || "New") === FILTER; });
    $("#enqStatus").textContent = list.length + " enquiries";
    var box = $("#enqList"); box.innerHTML = "";
    list.forEach(function (i) {
      var d = new Date(i.time), when = d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
      var digits = (i.phone || "").replace(/\D/g, "");
      var it = document.createElement("div"); it.className = "it"; it.style.cursor = "default"; it.style.flexDirection = "column"; it.style.alignItems = "stretch";
      it.innerHTML = "<div style='display:flex;justify-content:space-between;gap:8px'><b>" + esc(i.name || "(no name)") + "</b><span class='hint'>" + esc(when) + " · " + esc(i.source) + "</span></div>" +
        "<div class='hint'>" + esc([i.phone, i.location, i.service].filter(Boolean).join(" · ")) + "</div>" +
        "<div style='margin:6px 0;white-space:pre-wrap'>" + esc(i.message) + "</div>" +
        "<div class='acts' style='margin:0'><select class='st' style='width:auto'>" + STATUSES.map(function (s) { return "<option" + ((i.status || "New") === s ? " selected" : "") + ">" + s + "</option>"; }).join("") + "</select>" +
        (digits ? "<a class='btn sm' target='_blank' rel='noopener' href='https://wa.me/" + digits + "'>WhatsApp</a><a class='btn sm' href='tel:+" + digits + "'>Call</a>" : "") +
        "<button class='btn sm danger del'>Delete</button></div>";
      it.querySelector(".st").onchange = function (e) { var v = e.target.value; call("/enquiries/status", { method: "POST", body: JSON.stringify({ id: i.id, status: v }) }).then(function () { i.status = v; render(); toast("Status updated"); }).catch(function (er) { toast(er.message); }); };
      it.querySelector(".del").onclick = function () { if (!confirm("Delete this enquiry permanently?")) return; call("/enquiries/delete", { method: "POST", body: JSON.stringify({ id: i.id }) }).then(function () { ITEMS = ITEMS.filter(function (x) { return x !== i; }); render(); }).catch(function (er) { toast(er.message); }); };
      box.appendChild(it);
    });
  }
  function csv() {
    if (!ITEMS.length) return toast("Load enquiries first");
    var cols = ["time", "source", "status", "name", "phone", "location", "service", "message"];
    var rows = [cols.join(",")].concat(ITEMS.map(function (i) { return cols.map(function (c) { return '"' + String(i[c] || "").replace(/"/g, '""') + '"'; }).join(","); }));
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + rows.join("\n")], { type: "text/csv" }));
    a.download = "enquiries-" + new Date().toISOString().slice(0, 10) + ".csv"; document.body.appendChild(a); a.click(); a.remove();
  }
  document.addEventListener("DOMContentLoaded", function () {
    try { var k = localStorage.getItem("hac-enq-key"); if (k) { $("#enqKey").value = k; $("#enqRemember").checked = true; } } catch (e) { /* ignore */ }
    $("#enqLoad").onclick = load; $("#enqCsv").onclick = csv;
  });
})();
