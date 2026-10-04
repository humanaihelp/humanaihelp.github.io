/* HumanAI Concierge Services — site interactions (no dependencies) */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.remove("no-js");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------- Theme ---------- */
  function storedTheme() { try { return localStorage.getItem("hac-theme"); } catch (e) { return null; } }
  function saveTheme(t) { try { localStorage.setItem("hac-theme", t); } catch (e) { /* ignore */ } }
  var t = storedTheme();
  if (t === "light" || t === "dark") root.setAttribute("data-theme", t);

  document.addEventListener("DOMContentLoaded", function () {
    var WA = document.body.getAttribute("data-wa") || "";

    var themeBtn = document.querySelector(".theme-toggle");
    if (themeBtn) themeBtn.addEventListener("click", function () {
      var current = root.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = current === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next); saveTheme(next);
    });

    /* ---------- Mobile menu ---------- */
    var menuBtn = document.querySelector(".menu-toggle");
    if (menuBtn) {
      menuBtn.addEventListener("click", function () {
        var open = document.body.classList.toggle("menu-open");
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.querySelectorAll(".nav-links a").forEach(function (a) {
        a.addEventListener("click", function () { document.body.classList.remove("menu-open"); menuBtn.setAttribute("aria-expanded", "false"); });
      });
    }

    /* ---------- Header shadow + scroll progress ---------- */
    var header = document.querySelector(".site-header");
    var bar = document.querySelector(".progress");
    function onScroll() {
      if (header) header.classList.toggle("scrolled", window.scrollY > 8);
      if (bar) {
        var h = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.setProperty("--p", h > 0 ? (window.scrollY / h).toFixed(4) : 0);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

    /* ---------- Split headline into words ---------- */
    document.querySelectorAll("[data-split]").forEach(function (el) {
      var i = 0;
      function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(function (part) {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
              var w = document.createElement("span"); w.className = "w";
              var s = document.createElement("span"); s.textContent = part; s.style.setProperty("--i", i++);
              w.appendChild(s); frag.appendChild(w);
            });
            n.parentNode.replaceChild(frag, n);
          } else if (n.nodeType === 1 && n.classList.contains("grad-text")) {
            var gw = document.createElement("span"); gw.className = "w";
            var gs = document.createElement("span"); gs.style.setProperty("--i", i++);
            n.parentNode.replaceChild(gw, n); gw.appendChild(gs); gs.appendChild(n);
          } else if (n.nodeType === 1 && n.tagName !== "BR") { walk(n); }
        });
      }
      walk(el);
      el.classList.add("wsplit");
      requestAnimationFrame(function () { setTimeout(function () { el.classList.add("in"); }, 80); });
    });

    /* ---------- Reveal on scroll ---------- */
    var reveals = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && !reduce) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
      }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
      reveals.forEach(function (el) { io.observe(el); });
    } else { reveals.forEach(function (el) { el.classList.add("in"); }); }

    /* ---------- Spotlight + tilt ---------- */
    if (finePointer && !reduce) {
      document.querySelectorAll(".spot").forEach(function (el) {
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
          el.style.setProperty("--mx", x + "px"); el.style.setProperty("--my", y + "px");
          if (el.classList.contains("tilt")) {
            el.style.setProperty("--ry", ((x / r.width - 0.5) * 6).toFixed(2) + "deg");
            el.style.setProperty("--rx", ((0.5 - y / r.height) * 6).toFixed(2) + "deg");
          }
        });
        el.addEventListener("pointerleave", function () { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
      });
      document.querySelectorAll(".magnetic").forEach(function (el) {
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          el.style.setProperty("--tx", ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + "px");
          el.style.setProperty("--ty2", ((e.clientY - r.top - r.height / 2) * 0.25).toFixed(1) + "px");
        });
        el.addEventListener("pointerleave", function () { el.style.setProperty("--tx", "0px"); el.style.setProperty("--ty2", "0px"); });
      });
    }

    /* ---------- Hero word rotator ---------- */
    var rot = document.querySelector("[data-rotate]");
    if (rot && !reduce) {
      var words = rot.getAttribute("data-rotate").split("|"), wi = 0, ci = words[0].length, del = true;
      (function tick() {
        var w = words[wi];
        if (del) { ci--; if (ci <= 0) { del = false; wi = (wi + 1) % words.length; } }
        else { ci++; if (ci >= words[wi].length) { del = true; rot.textContent = words[wi]; return setTimeout(tick, 1800); } }
        rot.textContent = words[wi].slice(0, Math.max(ci, 0)) || " ";
        setTimeout(tick, del ? 45 : 85);
      })();
    }

    /* ---------- Tabs ---------- */
    document.querySelectorAll("[data-tabs]").forEach(function (wrap) {
      var tabs = wrap.querySelectorAll(".tab"), panels = wrap.querySelectorAll(".tab-panel");
      tabs.forEach(function (tab, i) {
        tab.addEventListener("click", function () {
          tabs.forEach(function (x) { x.setAttribute("aria-selected", "false"); x.tabIndex = -1; });
          panels.forEach(function (p) { p.classList.remove("active"); });
          tab.setAttribute("aria-selected", "true"); tab.tabIndex = 0; panels[i].classList.add("active");
        });
        tab.addEventListener("keydown", function (e) {
          var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!dir) return; var n = tabs[(i + dir + tabs.length) % tabs.length]; n.focus(); n.click();
        });
      });
    });

    /* ---------- Accordions ---------- */
    function setOpen(acc, open) {
      acc.classList.toggle("open", open);
      var b = acc.querySelector(".acc-head"); if (b) b.setAttribute("aria-expanded", open ? "true" : "false");
    }
    document.querySelectorAll(".acc").forEach(function (acc) {
      var head = acc.querySelector(".acc-head");
      acc.querySelectorAll(".acc-content li").forEach(function (li, i) { li.style.setProperty("--i", i); });
      head.addEventListener("click", function () { setOpen(acc, !acc.classList.contains("open")); });
    });
    document.querySelectorAll("[data-acc-all]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var open = btn.getAttribute("data-acc-all") === "open";
        document.querySelectorAll(btn.getAttribute("data-target") + " .acc:not(.is-hidden)").forEach(function (a) { setOpen(a, open); });
      });
    });
    function openFromHash() {
      if (!location.hash) return;
      var el = document.getElementById(location.hash.slice(1));
      if (el && el.classList.contains("acc")) { setOpen(el, true); setTimeout(function () { el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); }, 60); }
    }
    openFromHash(); window.addEventListener("hashchange", openFromHash);

    /* ---------- Filters ---------- */
    document.querySelectorAll("[data-filter-group]").forEach(function (group) {
      var target = document.querySelector(group.getAttribute("data-filter-group"));
      group.querySelectorAll(".chip").forEach(function (chip) {
        chip.addEventListener("click", function () {
          group.querySelectorAll(".chip").forEach(function (c) { c.setAttribute("aria-pressed", c === chip ? "true" : "false"); });
          var f = chip.getAttribute("data-filter");
          target.querySelectorAll("[data-tags]").forEach(function (item) {
            var show = f === "all" || item.getAttribute("data-tags").split(" ").indexOf(f) !== -1;
            item.classList.toggle("is-hidden", !show);
            if (show) { item.classList.remove("pop-in"); void item.offsetWidth; item.classList.add("pop-in"); }
          });
        });
      });
    });

    /* ---------- Contact form → WhatsApp ---------- */
    var form = document.querySelector("#contact-form");
    if (form) {
      var status = form.querySelector(".form-status");
      try {
        var q = new URLSearchParams(location.search), pre = q.get("service") || q.get("plan"), sel = form.querySelector("#interest");
        if (pre && sel) Array.prototype.forEach.call(sel.options, function (o) { if (o.value === pre) sel.value = pre; });
      } catch (e) { /* ignore */ }
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        var d = new FormData(form), sel = form.querySelector("#interest");
        var lines = [
          "Hello HumanAI Concierge! 👋",
          "",
          "Name: " + d.get("name"),
          d.get("phone") ? "Phone: " + d.get("phone") : null,
          d.get("location") ? "Location: " + d.get("location") : null,
          "Service: " + (sel ? sel.options[sel.selectedIndex].text : d.get("interest")),
          "",
          "Request: " + d.get("message")
        ].filter(function (x) { return x !== null; });
        var url = "https://wa.me/" + WA + "?text=" + encodeURIComponent(lines.join("\n"));
        window.open(url, "_blank", "noopener");
        // also save to the private enquiry log (if the free Worker is set up) — never blocks WhatsApp
        fetch("assets/site.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (cfg) {
          if (!cfg.worker_url) return;
          return fetch(cfg.worker_url.replace(/\/$/, "") + "/enquiry", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: d.get("name"), phone: d.get("phone"), location: d.get("location"), service: sel ? sel.options[sel.selectedIndex].text : d.get("interest"), message: d.get("message"), consent: d.get("consent") ? "yes" : "", page: "contact" }) });
        }).catch(function () { /* ignore */ });
        if (status) { status.textContent = "WhatsApp is opening with your message — just tap Send."; status.className = "form-status ok"; }
      });
    }

    /* ---------- "Install the app" button (PWA install prompt) ---------- */
    var deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault(); deferredPrompt = e;
      document.querySelectorAll("[data-install]").forEach(function (b) { b.hidden = false; });
    });
    document.querySelectorAll("[data-install]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () { deferredPrompt = null; b.hidden = true; });
      });
    });
    window.addEventListener("appinstalled", function () { document.querySelectorAll("[data-install]").forEach(function (b) { b.hidden = true; }); });

    /* ---------- Installable app (PWA) ---------- */
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("sw.js").catch(function () { /* ignore */ });
    }

    document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
  });
})();

/* Click-to-load Google map (privacy: nothing loads from Google until clicked) */
document.querySelectorAll(".map-slot").forEach(slot => {
  const b = slot.querySelector("button"); if (!b) return;
  b.addEventListener("click", () => {
    const f = document.createElement("iframe");
    f.src = slot.dataset.map; f.title = "Map of Bengaluru, our service area"; f.loading = "lazy"; f.referrerPolicy = "no-referrer-when-downgrade";
    slot.innerHTML = ""; slot.appendChild(f); slot.classList.add("loaded");
  });
});
