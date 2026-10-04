/* HumanAI Concierge — website admin (no server, no dependencies).
   Loads the site's HTML files, lets the owner edit them visually inside an iframe,
   and publishes all changed files to GitHub in a single commit (or downloads a zip offline). */
(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var KNOWN_PAGES = ["index.html", "services.html", "how-we-work.html", "team.html", "pricing.html", "contact.html",
    "disclaimer.html", "refund-policy.html", "privacy.html", "terms.html", "404.html"];
  var SITE_ROOT = new URL("../", location.href).href;

  var S = {
    mode: "github", owner: "", repo: "", branch: "main", token: "",
    files: {},          // path -> { original, current, isNew, binary(base64) }
    pages: [],          // html paths
    page: null,         // current path
    sel: null,          // selected element in iframe
    settings: null      // assets/site.json contents
  };

  /* ---------------- utils ---------------- */
  function toast(msg, ms) { var t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, ms || 2600); }
  function store(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function replaceAll(str, a, b) { return a ? str.split(a).join(b) : str; }
  function draftKey(p) { return "hac-draft:" + S.owner + "/" + S.repo + ":" + p; }

  /* ---------------- GitHub API ---------------- */
  function gh(method, path, body, accept) {
    return fetch("https://api.github.com/repos/" + S.owner + "/" + S.repo + path, {
      method: method,
      headers: { "Authorization": "Bearer " + S.token, "Accept": accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(r.status + " " + t.slice(0, 200)); });
      return accept && accept.indexOf("raw") !== -1 ? r.text() : r.json();
    });
  }
  function readFile(path) {
    if (S.mode === "local") return fetch(SITE_ROOT + path, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error(path + " " + r.status); return r.text(); });
    return gh("GET", "/contents/" + encodeURI(path) + "?ref=" + encodeURIComponent(S.branch), null, "application/vnd.github.raw+json");
  }
  function listPages() {
    if (S.mode === "local") return Promise.resolve(KNOWN_PAGES.slice());
    return gh("GET", "/git/trees/" + encodeURIComponent(S.branch) + "?recursive=1").then(function (t) {
      var htmls = t.tree.filter(function (x) { return x.type === "blob" && /^[^/]+\.html$/.test(x.path); }).map(function (x) { return x.path; });
      htmls.sort(function (a, b) { var ia = KNOWN_PAGES.indexOf(a), ib = KNOWN_PAGES.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); });
      return htmls;
    });
  }

  /* ---------------- file state ---------------- */
  function ensureFile(path) {
    if (S.files[path]) return Promise.resolve(S.files[path]);
    return readFile(path).then(function (txt) {
      var f = { original: txt, current: txt };
      var d = load(draftKey(path));
      if (d && d !== txt) f.current = d;
      S.files[path] = f; return f;
    });
  }
  function setFile(path, txt) {
    var f = S.files[path] || (S.files[path] = { original: "", current: "", isNew: true });
    f.current = txt;
    if (f.current !== f.original) store(draftKey(path), txt); else store(draftKey(path), null);
    updateChanged();
  }
  function changedPaths() { return Object.keys(S.files).filter(function (p) { var f = S.files[p]; return f.binary || f.current !== f.original; }); }
  function updateChanged() {
    var c = changedPaths();
    $("#changedInfo").textContent = c.length ? c.length + " file" + (c.length > 1 ? "s" : "") + " with unpublished changes" : "No unpublished changes";
    $("#btnPublish").textContent = S.mode === "local" ? "Download changes" : "Publish";
    renderPageList();
  }

  /* ---------------- editor (iframe) ---------------- */
  var EDITOR_CSS = "[data-hac-sel]{outline:3px solid #4f46e5!important;outline-offset:2px}" +
    "[data-hac-hover]{outline:2px dashed #a5a0ff!important;outline-offset:2px}" +
    ".acc .acc-panel{grid-template-rows:1fr!important}.acc .acc-content li{opacity:1!important;transform:none!important}" +
    ".tab-panel{display:grid!important;margin-bottom:22px}.marquee-track{animation:none!important;flex-wrap:wrap;width:auto!important}" +
    ".reveal{opacity:1!important;transform:none!important;filter:none!important;clip-path:none!important}.msg{opacity:1!important;transform:none!important}" +
    "body{cursor:text}[contenteditable]:focus{outline:none}";

  function toEditorHTML(src) {
    var doc = new DOMParser().parseFromString(src, "text/html");
    doc.querySelectorAll("script").forEach(function (s) { s.setAttribute("data-hac-type", s.getAttribute("type") || ""); s.setAttribute("type", "text/hac-off"); });
    doc.querySelectorAll("details").forEach(function (d) { if (!d.hasAttribute("open")) { d.setAttribute("open", ""); d.setAttribute("data-hac-closed", ""); } });
    var base = doc.createElement("base"); base.href = SITE_ROOT; base.setAttribute("data-hac", ""); doc.head.insertBefore(base, doc.head.firstChild);
    var st = doc.createElement("style"); st.textContent = EDITOR_CSS; st.setAttribute("data-hac", ""); doc.head.appendChild(st);
    return "<!doctype html>\n" + doc.documentElement.outerHTML;
  }
  function fromEditorDoc(idoc) {
    var html = idoc.documentElement.cloneNode(true);
    html.querySelectorAll("[data-hac]").forEach(function (n) { n.remove(); });
    html.querySelectorAll("[data-hac-sel],[data-hac-hover]").forEach(function (n) { n.removeAttribute("data-hac-sel"); n.removeAttribute("data-hac-hover"); });
    html.querySelectorAll("[contenteditable]").forEach(function (n) { n.removeAttribute("contenteditable"); });
    html.querySelectorAll("[spellcheck]").forEach(function (n) { n.removeAttribute("spellcheck"); });
    html.querySelectorAll("details[data-hac-closed]").forEach(function (d) { d.removeAttribute("open"); d.removeAttribute("data-hac-closed"); });
    html.querySelectorAll("script[data-hac-type]").forEach(function (s) { var t = s.getAttribute("data-hac-type"); if (t) s.setAttribute("type", t); else s.removeAttribute("type"); s.removeAttribute("data-hac-type"); });
    var body = html.querySelector("body"); if (body && !body.getAttribute("style")) body.removeAttribute("style");
    return "<!doctype html>\n" + html.outerHTML + "\n";
  }

  var frame = $("#frame"), syncTimer = null;
  function idoc() { return frame.contentDocument; }
  function syncNow() {
    if (!S.page || !idoc() || !idoc().body) return;
    var out = fromEditorDoc(idoc());
    if (out !== S.files[S.page].current) setFile(S.page, out);
  }
  function scheduleSync() { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 400); }

  function openPage(path, noSync) {
    if (S.page && !noSync) syncNow();
    return ensureFile(path).then(function (f) {
      S.page = path; S.sel = null; showSel();
      $("#pageSel").value = path;
      frame.onload = function () { wireFrame(); fillPagePane(); };
      frame.srcdoc = toEditorHTML(f.current);
      renderPageList();
    }).catch(function (e) { toast("Could not open " + path + ": " + e.message, 5000); });
  }

  function wireFrame() {
    var d = idoc(); if (!d || !d.body) return;
    d.body.setAttribute("contenteditable", "true");
    d.body.setAttribute("spellcheck", "true");
    d.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a,button,summary,label");
      if (a) e.preventDefault();
      select(e.target.nodeType === 1 ? e.target : e.target.parentElement);
    }, true);
    d.addEventListener("submit", function (e) { e.preventDefault(); }, true);
    d.addEventListener("mouseover", function (e) { var o = d.querySelector("[data-hac-hover]"); if (o) o.removeAttribute("data-hac-hover"); if (e.target !== d.body && e.target.setAttribute) e.target.setAttribute("data-hac-hover", ""); });
    d.addEventListener("input", scheduleSync);
    d.addEventListener("keydown", function (e) {
      // Enter inside buttons/links/headings: avoid creating broken markup → insert line break instead
      if (e.key === "Enter" && !e.shiftKey) {
        var blk = e.target.ownerDocument.getSelection().anchorNode;
        var el = blk && (blk.nodeType === 1 ? blk : blk.parentElement);
        if (el && el.closest("a,button,h1,h2,h3,h4,summary,span,b,small,label,td,th")) { e.preventDefault(); d.execCommand("insertLineBreak"); }
      }
    });
    new MutationObserver(scheduleSync).observe(d.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["href", "src", "alt", "class", "target", "style"] });
  }

  /* ---------------- selection panel ---------------- */
  function label(el) {
    var t = el.tagName.toLowerCase(), c = (el.className && typeof el.className === "string") ? el.className.split(" ").filter(function (x) { return x && x.indexOf("hac") !== 0 && x !== "reveal" && x !== "in" && x !== "spot" && x !== "tilt"; })[0] : "";
    return t + (c ? "." + c : "");
  }
  function select(el) {
    var d = idoc(); if (!el || !d) return;
    var o = d.querySelector("[data-hac-sel]"); if (o) o.removeAttribute("data-hac-sel");
    if (el === d.body || el === d.documentElement) { S.sel = null; showSel(); return; }
    S.sel = el; el.setAttribute("data-hac-sel", ""); showSel();
    switchTab("pEdit");
  }
  function showSel() {
    var el = S.sel;
    $("#selNone").style.display = el ? "none" : "";
    $("#selBox").style.display = el ? "" : "none";
    if (!el) return;
    var chain = [], n = el;
    while (n && n.tagName && n.tagName !== "BODY") { chain.unshift(n); n = n.parentElement; }
    chain = chain.slice(-6);
    $("#crumbs").innerHTML = "";
    chain.forEach(function (c) {
      var b = document.createElement("button"); b.textContent = label(c); if (c === el) b.className = "cur";
      b.onclick = function () { select(c); }; $("#crumbs").appendChild(b);
    });
    var a = el.closest("a");
    $("#linkBox").style.display = a ? "" : "none";
    if (a) { $("#lHref").value = a.getAttribute("href") || ""; $("#lNew").checked = a.getAttribute("target") === "_blank"; }
    var img = el.tagName === "IMG" ? el : null;
    $("#imgHint").textContent = img ? "Replace the selected image." : "Insert a photo into the selected area (it replaces what's inside it).";
    $("#imgAlt").value = img ? (img.getAttribute("alt") || "") : "";
    var clone = el.cloneNode(true); clone.removeAttribute("data-hac-sel"); clone.removeAttribute("data-hac-hover");
    $("#htmlEd").value = clone.outerHTML;
  }
  function act(fn) { if (!S.sel) return toast("Select something first"); fn(S.sel); syncNow(); showSel(); }
  $("#aDup").onclick = function () { act(function (el) { var c = el.cloneNode(true); c.removeAttribute("data-hac-sel"); el.after(c); select(c); }); };
  $("#aUp").onclick = function () { act(function (el) { var p = el.previousElementSibling; if (p) p.before(el); }); };
  $("#aDown").onclick = function () { act(function (el) { var n = el.nextElementSibling; if (n) n.after(el); }); };
  $("#aDel").onclick = function () { if (!S.sel) return; if (!confirm("Delete the selected " + label(S.sel) + "?")) return; var p = S.sel.parentElement; S.sel.remove(); S.sel = null; syncNow(); select(p); };
  $("#lApply").onclick = function () { act(function (el) { var a = el.closest("a"); if (!a) return; a.setAttribute("href", $("#lHref").value.trim()); if ($("#lNew").checked) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); } else { a.removeAttribute("target"); a.removeAttribute("rel"); } toast("Link updated"); }); };
  $("#htmlApply").onclick = function () {
    act(function (el) {
      var tpl = idoc().createElement("template"); tpl.innerHTML = $("#htmlEd").value.trim();
      var nodes = Array.prototype.slice.call(tpl.content.childNodes); if (!nodes.length) return;
      el.replaceWith.apply(el, nodes); var first = nodes.filter(function (x) { return x.nodeType === 1; })[0]; S.sel = null; if (first) select(first);
    });
  };
  function readAsDataURL(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); }); }
  function safeName(n) { return n.toLowerCase().replace(/[^a-z0-9.\-]+/g, "-").replace(/-+/g, "-"); }
  $("#imgApply").onclick = function () {
    var f = $("#imgFile").files[0]; if (!S.sel) return toast("Select something first"); if (!f) return toast("Choose an image file first");
    if (f.size > 2.5 * 1024 * 1024) return toast("Please use an image smaller than 2.5 MB", 4000);
    readAsDataURL(f).then(function (url) {
      var path = "assets/img/uploads/" + Date.now() + "-" + safeName(f.name);
      S.files[path] = { original: "", current: "", binary: url.split(",")[1], isNew: true };
      var alt = $("#imgAlt").value.trim();
      act(function (el) {
        if (el.tagName === "IMG") { el.setAttribute("src", path); el.setAttribute("alt", alt); }
        else { el.innerHTML = '<img src="' + path + '" alt="' + esc(alt) + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">'; }
      });
      updateChanged(); toast("Image added — publish to make it live");
    });
  };

  /* ---------------- page pane ---------------- */
  function fillPagePane() {
    var d = idoc(); if (!d) return;
    $("#pgTitle").value = d.title;
    var m = d.querySelector('meta[name="description"]'); $("#pgDesc").value = m ? m.getAttribute("content") : "";
  }
  $("#pgApply").onclick = function () {
    var d = idoc(); d.title = $("#pgTitle").value;
    ["og:title"].forEach(function (p) { var m = d.querySelector('meta[property="' + p + '"]'); if (m) m.setAttribute("content", $("#pgTitle").value); });
    ["description"].forEach(function () {
      var m = d.querySelector('meta[name="description"]'); if (m) m.setAttribute("content", $("#pgDesc").value);
      var o = d.querySelector('meta[property="og:description"]'); if (o) o.setAttribute("content", $("#pgDesc").value);
    });
    syncNow(); toast("Page details updated");
  };

  /* ---------------- header/footer sync ---------------- */
  function sharedParts(html) {
    var doc = new DOMParser().parseFromString(html, "text/html");
    var h = doc.querySelector("header.site-header"), f = doc.querySelector("footer.site-footer"), w = doc.querySelector("a.wa-float");
    return { header: h ? h.outerHTML : "", footer: f ? f.outerHTML : "", wa: w ? w.outerHTML : "" };
  }
  function applyShared(fromPath) {
    var src = S.files[fromPath]; if (!src) return Promise.resolve(0);
    var before = sharedParts(src.original), after = sharedParts(src.current);
    if (before.header === after.header && before.footer === after.footer && before.wa === after.wa) return Promise.resolve(0);
    var tmp = new DOMParser().parseFromString(src.current, "text/html");
    return Promise.all(S.pages.filter(function (p) { return p !== fromPath; }).map(ensureFile)).then(function () {
      var n = 0;
      S.pages.forEach(function (p) {
        if (p === fromPath) return;
        var doc = new DOMParser().parseFromString(S.files[p].current, "text/html");
        [["header.site-header"], ["footer.site-footer"], ["a.wa-float"]].forEach(function (sel) {
          var mine = doc.querySelector(sel[0]), theirs = tmp.querySelector(sel[0]);
          if (mine && theirs) mine.replaceWith(doc.importNode(theirs, true));
        });
        doc.querySelectorAll(".nav-links a").forEach(function (a) { if (a.getAttribute("href") === p) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
        var out = "<!doctype html>\n" + doc.documentElement.outerHTML + "\n";
        if (out !== S.files[p].current) { setFile(p, out); n++; }
      });
      return n;
    });
  }

  /* ---------------- site settings ---------------- */
  function getSettings() {
    if (S.settings) return Promise.resolve(S.settings);
    return ensureFile("assets/site.json").then(function (f) { S.settings = JSON.parse(f.current); return S.settings; });
  }
  function fillSettings() {
    getSettings().then(function (s) {
      $("#sName").value = s.name; $("#sProp").value = s.proprietor; $("#sPhone").value = s.phone_display; $("#sWa").value = s.wa;
      $("#sEmail").value = s.email; $("#sHours").value = s.hours; $("#sGst").value = s.gstin || ""; $("#sReview").value = s.google_review_url || ""; $("#sMaps").value = s.google_maps_url || ""; $("#sInsta").value = s.instagram_url || ""; $("#sFb").value = s.facebook_url || ""; $("#sLi").value = s.linkedin_url || ""; $("#sPlay").value = s.play_store_url || ""; $("#sWorker").value = s.worker_url || "";
    }).catch(function () { /* ignore */ });
    ensureFile("assets/css/style.css").then(function (f) {
      var root = f.current.slice(f.current.indexOf(":root {"), f.current.indexOf("}", f.current.indexOf(":root {")));
      function v(name) { var m = root.match(new RegExp("--" + name + ":\\s*(#[0-9a-fA-F]{6})")); return m ? m[1] : "#000000"; }
      $("#cBrand").value = v("brand"); $("#cBrand2").value = v("brand-2"); $("#cHuman").value = v("human"); $("#cAi").value = v("ai");
    });
  }
  $("#sApply").onclick = function () {
    syncNow();
    getSettings().then(function (old) {
      var nw = { name: $("#sName").value.trim(), proprietor: $("#sProp").value.trim(), phone_display: $("#sPhone").value.trim(), wa: $("#sWa").value.replace(/\D/g, ""),
        email: $("#sEmail").value.trim(), hours: $("#sHours").value.trim(), gstin: $("#sGst").value.trim().toUpperCase(), google_review_url: $("#sReview").value.trim(), google_maps_url: $("#sMaps").value.trim(), instagram_url: $("#sInsta").value.trim(), facebook_url: $("#sFb").value.trim(), linkedin_url: $("#sLi").value.trim(), play_store_url: $("#sPlay").value.trim(), worker_url: $("#sWorker").value.trim().replace(/\/$/, "") };
      nw.phone_tel = "+" + nw.wa;
      return Promise.all(S.pages.map(ensureFile)).then(function () {
        S.pages.forEach(function (p) {
          var t = S.files[p].current;
          t = replaceAll(t, "wa.me/" + old.wa, "wa.me/" + nw.wa);
          t = replaceAll(t, 'data-wa="' + old.wa + '"', 'data-wa="' + nw.wa + '"');
          t = replaceAll(t, "tel:" + old.phone_tel, "tel:" + nw.phone_tel);
          t = replaceAll(t, old.phone_display, nw.phone_display);
          t = replaceAll(t, old.email, nw.email);
          t = replaceAll(t, old.hours, nw.hours);
          t = replaceAll(t, old.proprietor, nw.proprietor);
          if (old.name !== nw.name) t = replaceAll(t, old.name, nw.name);
          var doc = new DOMParser().parseFromString(t, "text/html"), touched = false;
          doc.querySelectorAll('[data-site="gstin"]').forEach(function (n) { n.textContent = nw.gstin; touched = true; });
          [["google-review", nw.google_review_url], ["google-maps", nw.google_maps_url], ["instagram", nw.instagram_url], ["facebook", nw.facebook_url], ["linkedin", nw.linkedin_url], ["play-store", nw.play_store_url]].forEach(function (g) {
            doc.querySelectorAll('[data-site="' + g[0] + '"]').forEach(function (n) { if (g[1]) { n.setAttribute("href", g[1]); n.removeAttribute("hidden"); } else { n.setAttribute("href", "#"); n.setAttribute("hidden", ""); } touched = true; });
          });
          doc.querySelectorAll('[data-site="gstin-wrap"]').forEach(function (n) { if (nw.gstin) n.removeAttribute("hidden"); else n.setAttribute("hidden", ""); touched = true; });
          if (touched) t = "<!doctype html>\n" + doc.documentElement.outerHTML + "\n";
          setFile(p, t);
        });
        S.settings = nw;
        setFile("assets/site.json", JSON.stringify(nw, null, 2) + "\n");
        openPage(S.page, true);
        toast("Updated on all pages — publish to make it live");
      });
    }).catch(function (e) { toast("Could not update settings: " + e.message, 5000); });
  };
  function setColors(map) {
    return ensureFile("assets/css/style.css").then(function (f) {
      var css = f.current, a = css.indexOf(":root {"), b = css.indexOf("}", a), root = css.slice(a, b);
      Object.keys(map).forEach(function (k) { root = root.replace(new RegExp("(--" + k + ":\\s*)#[0-9a-fA-F]{6}"), "$1" + map[k]); });
      setFile("assets/css/style.css", css.slice(0, a) + root + css.slice(b));
      openPage(S.page, true);
    });
  }
  function fillAssistant() { ensureFile("assets/assistant.json").then(function (f) { $("#aiJson").value = f.current; }).catch(function () { $("#aiJson").value = ""; }); }
  $("#aiApply").onclick = function () {
    var t = $("#aiJson").value;
    try { var j = JSON.parse(t); if (!j.answers || !j.answers.length) throw new Error("answers list is empty"); }
    catch (e) { return toast("Not saved — the format has a mistake: " + e.message, 6000); }
    setFile("assets/assistant.json", JSON.stringify(j, null, 2) + "\n"); toast("Assistant answers saved — publish to make them live");
  };
  $("#cApply").onclick = function () { syncNow(); setColors({ "brand": $("#cBrand").value, "brand-2": $("#cBrand2").value, "human": $("#cHuman").value, "ai": $("#cAi").value }).then(function () { toast("Colours updated — publish to make them live"); }); };
  $("#cReset").onclick = function () { setColors({ "brand": "#4f46e5", "brand-2": "#6d5efc", "human": "#f2994a", "ai": "#14b8a6" }).then(fillSettings); };
  $("#logoApply").onclick = function () {
    var f = $("#logoFile").files[0]; if (!f) return toast("Choose a logo file first");
    if (f.size > 1.5 * 1024 * 1024) return toast("Please use a logo smaller than 1.5 MB", 4000);
    syncNow();
    readAsDataURL(f).then(function (url) {
      var isSvg = /svg/.test(f.type), path = isSvg ? "assets/img/logo.svg" : "assets/img/logo.png";
      S.files[path] = { original: "", current: "", binary: url.split(",")[1] };
      if (isSvg) S.files["assets/img/favicon.svg"] = { original: "", current: "", binary: url.split(",")[1] };
      return Promise.all(S.pages.map(ensureFile)).then(function () {
        if (!isSvg) S.pages.forEach(function (p) {
          var t = S.files[p].current;
          t = replaceAll(t, 'src="assets/img/logo.svg"', 'src="assets/img/logo.png"');
          t = replaceAll(t, 'href="assets/img/favicon.svg" type="image/svg+xml"', 'href="assets/img/logo.png" type="image/png"');
          setFile(p, t);
        });
        updateChanged(); openPage(S.page, true); toast("Logo replaced — publish to make it live (preview updates after publishing)", 4500);
      });
    });
  };

  /* ---------------- pages pane ---------------- */
  function renderPageList() {
    var box = $("#pageList"); if (!box) return;
    box.innerHTML = "";
    S.pages.forEach(function (p) {
      var f = S.files[p], dirty = f && f.current !== f.original;
      var it = document.createElement("div"); it.className = "it" + (p === S.page ? " cur" : "");
      it.innerHTML = "<span>" + esc(p) + "</span>" + (dirty ? '<span class="dot" title="Unpublished changes"></span>' : "");
      it.onclick = function () { openPage(p); }; box.appendChild(it);
    });
    var sel = $("#pageSel"), cur = sel.value; sel.innerHTML = "";
    S.pages.forEach(function (p) { var o = document.createElement("option"); o.value = p; o.textContent = p; sel.appendChild(o); });
    if (cur || S.page) sel.value = S.page || cur;
  }
  $("#pageSel").onchange = function () { openPage(this.value); };
  $("#newApply").onclick = function () {
    var n = safeName($("#newName").value.trim()); if (!n) return toast("Type a file name");
    if (!/\.html$/.test(n)) n += ".html";
    if (S.pages.indexOf(n) !== -1) return toast("That page already exists");
    syncNow();
    S.files[n] = { original: "", current: S.files[S.page].current, isNew: true };
    S.pages.push(n); store(draftKey(n), S.files[n].current); updateChanged(); openPage(n);
    toast("Page created — edit it, link to it from the menu, then publish", 4500);
  };

  /* ---------------- publish ---------------- */
  function bumpSW() {
    return ensureFile("sw.js").then(function (f) {
      var t = f.current.replace(/const CACHE = "[^"]*";/, 'const CACHE = "hac-' + Date.now() + '";');
      S.files["sw.js"].current = t;
    }).catch(function () { /* no service worker */ });
  }
  $("#btnPublish").onclick = function () {
    syncNow();
    var chk = $("#syncHF").checked ? applyShared(S.page) : Promise.resolve(0);
    chk.then(function (n) {
      if (n) toast("Header/footer copied to " + n + " other page" + (n > 1 ? "s" : ""));
      var c = changedPaths();
      if (!c.length) return toast("Nothing to publish yet");
      $("#pubList").innerHTML = "<b>" + c.length + " file(s) will be " + (S.mode === "local" ? "downloaded" : "published") + ":</b><br>" + c.map(esc).join("<br>");
      $("#pubGo").textContent = S.mode === "local" ? "Download zip" : "Publish now";
      $("#pubStatus").textContent = ""; $("#pubModal").classList.add("on");
    });
  };
  $("#pubCancel").onclick = function () { $("#pubModal").classList.remove("on"); };
  $("#pubGo").onclick = function () {
    var btn = this; btn.disabled = true;
    bumpSW().then(function () {
      var paths = changedPaths().concat(S.files["sw.js"] && S.files["sw.js"].current !== S.files["sw.js"].original ? ["sw.js"] : []);
      paths = paths.filter(function (p, i) { return paths.indexOf(p) === i; });
      if (S.mode === "local") { downloadZip(paths); return finish(paths); }
      $("#pubStatus").textContent = "Publishing…";
      var ref, baseTree;
      return gh("GET", "/git/ref/heads/" + encodeURIComponent(S.branch)).then(function (r) { ref = r.object.sha; return gh("GET", "/git/commits/" + ref); })
        .then(function (c) {
          baseTree = c.tree.sha;
          return Promise.all(paths.map(function (p) {
            var f = S.files[p];
            if (f.binary) return gh("POST", "/git/blobs", { content: f.binary, encoding: "base64" }).then(function (b) { return { path: p, mode: "100644", type: "blob", sha: b.sha }; });
            return { path: p, mode: "100644", type: "blob", content: f.current };
          }));
        })
        .then(function (entries) { return gh("POST", "/git/trees", { base_tree: baseTree, tree: entries }); })
        .then(function (t) { return gh("POST", "/git/commits", { message: $("#pubMsg").value || "Website update", tree: t.sha, parents: [ref] }); })
        .then(function (c) { return gh("PATCH", "/git/refs/heads/" + encodeURIComponent(S.branch), { sha: c.sha }); })
        .then(function () { finish(paths); });
    }).catch(function (e) { $("#pubStatus").textContent = "Publishing failed: " + e.message + ". Your changes are still saved as a draft on this computer."; })
      .then(function () { btn.disabled = false; });
  };
  function finish(paths) {
    paths.forEach(function (p) { var f = S.files[p]; if (!f) return; if (f.binary) { delete S.files[p]; } else { f.original = f.current; f.isNew = false; } store(draftKey(p), null); });
    updateChanged();
    $("#pubStatus").textContent = S.mode === "local" ? "Downloaded. Upload these files to your website host." : "Published! The live site updates in about 1 minute.";
    setTimeout(function () { $("#pubModal").classList.remove("on"); }, 2200);
    toast(S.mode === "local" ? "Zip downloaded" : "Published ✓", 3000);
  }

  /* minimal ZIP writer (store, no compression) */
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function downloadZip(paths) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    paths.forEach(function (p) {
      var f = S.files[p], data = f.binary ? Uint8Array.from(atob(f.binary), function (ch) { return ch.charCodeAt(0); }) : enc.encode(f.current);
      var name = enc.encode(p), crc = crc32(data), h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, 0, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, data);
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (s, x) { return s + x.length; }, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, paths.length, true); e.setUint16(10, paths.length, true); e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    var blob = new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: "application/zip" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "website-changes-" + new Date().toISOString().slice(0, 10) + ".zip"; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------------- discard / misc ---------------- */
  $("#btnDiscard").onclick = function () {
    if (!changedPaths().length) return toast("No changes to discard");
    if (!confirm("Discard ALL unpublished changes on every page?")) return;
    Object.keys(S.files).forEach(function (p) { var f = S.files[p]; store(draftKey(p), null); if (f.binary || f.isNew) delete S.files[p]; else f.current = f.original; });
    S.pages = S.pages.filter(function (p) { return S.files[p] || KNOWN_PAGES.indexOf(p) !== -1; });
    S.settings = null; fillSettings(); updateChanged(); openPage(S.pages.indexOf(S.page) !== -1 ? S.page : "index.html", true);
  };
  $("#btnView").onclick = function () { window.open(SITE_ROOT, "_blank", "noopener"); };
  $("#btnLogout").onclick = function () { if (changedPaths().length && !confirm("You have unpublished changes (they stay saved as a draft on this computer). Sign out?")) return; store("hac-admin", null); location.reload(); };
  function switchTab(id) { $$(".tabs button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-pane") === id); }); $$(".pane").forEach(function (p) { p.classList.toggle("on", p.id === id); }); }
  $$(".tabs button").forEach(function (b) { b.onclick = function () { switchTab(b.getAttribute("data-pane")); if (b.getAttribute("data-pane") === "pSite") { fillSettings(); fillAssistant(); } }; });
  $$(".stage-bar [data-w]").forEach(function (b) { b.onclick = function () { frame.style.maxWidth = b.getAttribute("data-w"); }; });
  window.addEventListener("beforeunload", function (e) { syncNow(); });

  /* ---------------- start ---------------- */
  function start(mode) {
    S.mode = mode; S.owner = $("#owner").value.trim(); S.repo = $("#repo").value.trim(); S.branch = $("#branch").value.trim() || "main"; S.token = $("#token").value.trim();
    if (mode === "github" && !S.token) { $("#loginMsg").textContent = "Paste your GitHub access token first (or use Edit offline)."; return; }
    $("#loginMsg").textContent = "Loading…";
    var check = mode === "github" ? gh("GET", "") : Promise.resolve({ permissions: { push: true } });
    check.then(function (info) {
      if (mode === "github" && info.permissions && !info.permissions.push) throw new Error("This token can read but not write to the repository.");
      if (mode === "github" && $("#remember").checked) store("hac-admin", JSON.stringify({ owner: S.owner, repo: S.repo, branch: S.branch, token: S.token }));
      return listPages();
    }).then(function (pages) {
      S.pages = pages;
      $("#login").style.display = "none"; $("#app").style.display = "grid";
      $("#modeBadge").textContent = mode === "local" ? "Offline mode" : S.owner + "/" + S.repo; $("#modeBadge").classList.toggle("local", mode === "local");
      updateChanged(); return openPage(pages.indexOf("index.html") !== -1 ? "index.html" : pages[0]);
    }).catch(function (e) { $("#loginMsg").textContent = "Could not sign in: " + e.message; });
  }
  window.HAC = { auth: function () { return { mode: S.mode, owner: S.owner, repo: S.repo, branch: S.branch, token: S.token }; } };
  document.getElementById("openStudio").onclick = function () { window.HACLetters && window.HACLetters.open(); };
  $("#btnLogin").onclick = function () { start("github"); };
  $("#btnLocal").onclick = function () { start("local"); };
  var saved = load("hac-admin");
  if (saved) { try { var s = JSON.parse(saved); $("#owner").value = s.owner; $("#repo").value = s.repo; $("#branch").value = s.branch; $("#token").value = s.token; $("#remember").checked = true; } catch (e) { /* ignore */ } }
})();
