/**
 * HumanAI Concierge — free AI chatbot (website "Ask us" bubble + WhatsApp bot)
 * Runs on a Cloudflare Worker (free plan) using Workers AI (free plan: 10,000 neurons/day, never billed —
 * when the daily allowance is used up, requests fail and the website/WhatsApp fall back to standard replies).
 *
 * Paste this whole file into: Cloudflare dashboard → Workers & Pages → your worker → Edit code → Deploy.
 * Bindings (Settings → Bindings):  Workers AI  → variable name  AI
 * Variables (Settings → Variables and Secrets):
 *   SITE_URL         https://humanaihelp.github.io      (plain text)
 *   BOT_MODE         after_hours   (WhatsApp bot replies only outside Mon–Sat 9am–7pm IST)  or  always
 *   WA_VERIFY_TOKEN  any secret word you choose (also typed into Meta's webhook settings)   (secret)
 *   WA_TOKEN         WhatsApp Cloud API access token                                         (secret)
 *   WA_PHONE_ID      WhatsApp phone number ID from Meta                                      (secret)
 *   WA_APP_SECRET    Meta app secret — used to check messages really come from Meta          (secret, recommended)
 *   ADMIN_KEY        a long password you choose — the admin page uses it to read the enquiry log      (secret)
 * KV namespace (Settings → Bindings → KV namespace) → variable name  ENQ   (free plan: 1,000 writes/day — plenty)
 * No secrets are written in this file. The website chat works without the WA_* values.
 */

const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_IN = 600;          // max characters accepted per user message
const HISTORY = 6;           // previous turns sent to the model (website)
let KNOW = { text: "", at: 0 };

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const origin = req.headers.get("Origin") || "";
    let allowed = ""; try { allowed = new URL(env.SITE_URL).origin; } catch {}   // compare origins only (works for project sites with a /path too)
    const cors = { "Access-Control-Allow-Origin": origin === allowed ? origin : allowed, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Vary": "Origin" };

    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname === "/" || url.pathname === "/health") return new Response("HumanAI chatbot is running.", { headers: { "content-type": "text/plain" } });

    /* ---------- Website chat ---------- */
    if (url.pathname === "/chat" && req.method === "POST") {
      if (allowed && origin && origin !== allowed) return json({ error: "origin" }, 403, cors);
      let body; try { body = await req.json(); } catch { return json({ error: "bad request" }, 400, cors); }
      const msgs = Array.isArray(body.messages) ? body.messages.slice(-HISTORY) : [];
      const clean = msgs.filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
                        .map(m => ({ role: m.role, content: m.content.slice(0, MAX_IN) }));
      if (!clean.length || clean[clean.length - 1].role !== "user") return json({ error: "no question" }, 400, cors);
      try {
        const reply = await askAI(env, clean, "website");
        return json({ reply }, 200, cors);
      } catch (e) {
        return json({ error: "unavailable" }, 503, cors);   // website falls back to its built-in answers
      }
    }

    /* ---------- Enquiry log: website contact form ---------- */
    if (url.pathname === "/enquiry" && req.method === "POST") {
      if (allowed && origin && origin !== allowed) return json({ error: "origin" }, 403, cors);
      let b; try { b = await req.json(); } catch { return json({ error: "bad request" }, 400, cors); }
      if (!b || !b.name || !b.message || b.consent !== "yes") return json({ error: "missing fields" }, 400, cors);
      await logEnquiry(env, { source: "Website form", name: b.name, phone: b.phone, location: b.location, service: b.service, message: b.message, page: b.page });
      return json({ ok: true }, 200, cors);
    }

    /* ---------- Enquiry log: admin access (needs ADMIN_KEY) ---------- */
    if (url.pathname.startsWith("/enquiries")) {
      const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!env.ADMIN_KEY || auth !== env.ADMIN_KEY) return json({ error: "unauthorised" }, 401, { ...cors, "Access-Control-Allow-Origin": origin || "*" });
      const c2 = { ...cors, "Access-Control-Allow-Origin": origin || "*" };
      if (!env.ENQ) return json({ error: "ENQ KV binding missing" }, 500, c2);
      if (req.method === "GET") {
        const list = await env.ENQ.list({ prefix: "enq:", limit: 1000 });
        const items = list.keys.map(k => ({ id: k.name, ...(k.metadata || {}) })).sort((a, b) => (b.time || "").localeCompare(a.time || ""));
        return json({ items }, 200, c2);
      }
      if (req.method === "POST" && url.pathname === "/enquiries/status") {
        let b; try { b = await req.json(); } catch { return json({ error: "bad request" }, 400, c2); }
        const cur = await env.ENQ.getWithMetadata(b.id);
        if (!cur || !cur.metadata) return json({ error: "not found" }, 404, c2);
        const meta = { ...cur.metadata, status: String(b.status || "New").slice(0, 20), note: String(b.note || cur.metadata.note || "").slice(0, 120) };
        await env.ENQ.put(b.id, "1", { metadata: meta });
        return json({ ok: true }, 200, c2);
      }
      if (req.method === "POST" && url.pathname === "/enquiries/delete") {
        let b; try { b = await req.json(); } catch { return json({ error: "bad request" }, 400, c2); }
        await env.ENQ.delete(b.id); return json({ ok: true }, 200, c2);
      }
    }

    /* ---------- WhatsApp webhook: verification ---------- */
    if (url.pathname === "/whatsapp" && req.method === "GET") {
      if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === env.WA_VERIFY_TOKEN)
        return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
      return new Response("forbidden", { status: 403 });
    }

    /* ---------- WhatsApp webhook: incoming messages ---------- */
    if (url.pathname === "/whatsapp" && req.method === "POST") {
      const raw = await req.text();
      if (env.WA_APP_SECRET && !(await validSignature(raw, req.headers.get("X-Hub-Signature-256"), env.WA_APP_SECRET)))
        return new Response("bad signature", { status: 401 });
      let data; try { data = JSON.parse(raw); } catch { return new Response("ok"); }
      ctx.waitUntil(handleWhatsApp(data, env));
      return new Response("ok");   // always answer Meta quickly
    }

    return new Response("not found", { status: 404 });
  },
};

async function handleWhatsApp(data, env) {
  const value = data?.entry?.[0]?.changes?.[0]?.value;
  const msg = value?.messages?.[0];
  if (!msg) return;
  await logEnquiry(env, { source: "WhatsApp", name: value?.contacts?.[0]?.profile?.name || "", phone: "+" + msg.from, message: msg.type === "text" ? (msg.text?.body || "") : "[" + msg.type + " message]" });
  if (!env.WA_TOKEN || !env.WA_PHONE_ID) return;
  if ((env.BOT_MODE || "after_hours") === "after_hours" && isWorkingHours()) return;   // a person replies during working hours
  const to = msg.from;
  if (msg.type !== "text") return sendWA(env, to, "Thank you! 🙏 Our team will look at this and reply in working hours (Mon–Sat, 9am–7pm IST). For emergencies call 112 / 108.");
  const text = (msg.text?.body || "").slice(0, MAX_IN);
  if (/^\s*(human|agent|person|team|call me)\s*$/i.test(text))
    return sendWA(env, to, "Sure — a real person from our team will reply here in working hours (Mon–Sat, 9am–7pm IST). 🙏");
  let reply;
  try { reply = await askAI(env, [{ role: "user", content: text }], "whatsapp"); }
  catch { reply = "Thank you for your message! 🙏 Our team will reply in working hours (Mon–Sat, 9am–7pm IST). For emergencies call 112 / 108."; }
  return sendWA(env, to, reply + "\n\n— HumanAI Assistant (automated). Type HUMAN to talk to our team.");
}

async function askAI(env, messages, channel) {
  const knowledge = await getKnowledge(env);
  const system = [
    "You are the HumanAI Assistant for HumanAI Concierge Services, a concierge business in Bengaluru, India (proprietor: Deepa G Garasangi).",
    "Answer ONLY using the business information below. If the answer is not there, say you're not sure and suggest messaging the team on WhatsApp +91 94492 30088.",
    "Be warm, short (max 80 words), and clear. Reply in the user's language if they write in Kannada or Hindi.",
    "Never give medical, legal, tax, financial or immigration advice. For emergencies tell them to call 112 or 108 first.",
    "Never ask for or accept OTPs, PINs, passwords, card or bank details, Aadhaar or other ID numbers. Never quote prices — say we give a free quote after understanding the need.",
    "Never promise outcomes that depend on third parties. Never invent services, prices, timings, staff names or reviews.",
    channel === "website" ? "End with a short suggestion to WhatsApp the team for anything specific." : "",
    "",
    "BUSINESS INFORMATION:",
    knowledge,
  ].join("\n");
  const out = await env.AI.run(MODEL, { messages: [{ role: "system", content: system }, ...messages], max_tokens: 220, temperature: 0.3 });
  const reply = (out && (out.response || out.result?.response) || "").trim();
  if (!reply) throw new Error("empty");
  return reply.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[removed]");   // never echo anything that looks like an ID number
}

async function getKnowledge(env) {
  if (KNOW.text && Date.now() - KNOW.at < 10 * 60 * 1000) return KNOW.text;
  const base = (env.SITE_URL || "").replace(/\/$/, "");   // full site address incl. any /path
  let text = "";
  try { text += await (await fetch(base + "/assets/knowledge.txt", { cf: { cacheTtl: 600 } })).text(); } catch {}
  try {
    const kb = await (await fetch(base + "/assets/assistant.json", { cf: { cacheTtl: 600 } })).json();
    text += "\n\nFAQ:\n" + kb.answers.map(a => "- " + a.answer).join("\n");
  } catch {}
  KNOW = { text: text.slice(0, 7000), at: Date.now() };
  return KNOW.text;
}

function isWorkingHours() {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const day = ist.getUTCDay(), h = ist.getUTCHours();
  return day >= 1 && day <= 6 && h >= 9 && h < 19;
}

async function sendWA(env, to, body) {
  await fetch("https://graph.facebook.com/v21.0/" + env.WA_PHONE_ID + "/messages", {
    method: "POST",
    headers: { "Authorization": "Bearer " + env.WA_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: body.slice(0, 4000) } }),
  });
}

async function validSignature(raw, header, secret) {
  if (!header || !header.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === header.slice(7);
}

async function logEnquiry(env, e) {
  if (!env.ENQ) return;
  const clip = (v, n) => String(v || "").replace(/\s+/g, " ").trim().slice(0, n);
  const time = new Date().toISOString();
  const id = "enq:" + time + ":" + Math.random().toString(36).slice(2, 7);
  // everything lives in KV metadata (max ~1 KB) so the admin list needs no extra reads; delete after 12 months
  const meta = { time, source: clip(e.source, 20), name: clip(e.name, 60), phone: clip(e.phone, 25), location: clip(e.location, 40),
                 service: clip(e.service, 40), message: clip(e.message, 500), page: clip(e.page, 40), status: "New", note: "" };
  try { await env.ENQ.put(id, "1", { metadata: meta, expirationTtl: 60 * 60 * 24 * 365 }); } catch {}
}

function json(obj, status, headers) { return new Response(JSON.stringify(obj), { status, headers: { ...headers, "content-type": "application/json" } }); }
