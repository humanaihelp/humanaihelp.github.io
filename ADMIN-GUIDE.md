# HumanAI Concierge Services — Admin Guide

This guide is written for the website owner. No coding is needed.

**Website address:** https://humanaihelp.github.io
**Admin page:** https://humanaihelp.github.io/admin/
**Brand kit (logos, cards, templates):** inside the admin page → *Brand kit* tab

---

## 1. How the website is organised

| Folder / file | What it is | How to change it |
|---|---|---|
| `index.html`, `services.html`, `how-we-work.html`, `team.html`, `pricing.html`, `contact.html` | The main pages | Admin page (click and type) |
| `disclaimer.html`, `refund-policy.html`, `privacy.html`, `terms.html` | Legal pages | Admin page |
| `404.html` | "Page not found" page | Admin page |
| `assets/site.json` | Business name, proprietor, phone, WhatsApp, email, hours, GSTIN | Admin → *Site settings* |
| `assets/assistant.json` | Questions & answers for the "Ask us" chat assistant | Admin → *Site settings* → *Chat assistant answers* |
| `assets/css/style.css` | Design and colours | Admin → *Site settings* → *Brand colours* |
| `assets/js/` | Animations, menu, chat assistant (no need to touch) | — |
| `assets/img/` | Logo, icons, uploaded photos | Admin → *Site settings* → *Logo* / *Selected* → *Image* |
| `admin/` | The admin page itself | — |
| `brand-kit/` | Logos, social images, visiting cards, office templates, Play Store images | Download from admin → *Brand kit* |
| `sw.js`, `site.webmanifest` | Make the website installable as a phone app | Updated automatically when you publish |
| `.well-known/assetlinks.json` | Needed only for the Play Store app (section 6) | Once, when publishing the app |

---

## 2. Put the website online (GitHub Pages — free)

You do this **once**.

1. **Create a GitHub account** at <https://github.com/signup> using the business Gmail.
2. **Organisation — rename it to `humanaihelp` (step 1, do this first):**
   - Check the name is still free: open https://github.com/humanaihelp — a "404 / page not found" means it's available.
   - Open https://github.com/HumanAI-concierge-services → *Settings* → *General* → scroll to **Rename organization** → type **`humanaihelp`** → confirm.
   - Your organisation is now https://github.com/humanaihelp and the website address will be **https://humanaihelp.github.io**.
3. **Create the repository:** in the organisation click *Repositories* → *New repository*.
   - Owner: **humanaihelp**. Repository name: **`humanaihelp.github.io`** (exactly this, all lowercase).
   - Choose *Public* (required for free hosting). Click *Create repository*.
4. **Upload the website:** on the new empty repository page click *uploading an existing file*. Unzip `humanai-concierge-website.zip` on your computer, open the folder, select **everything inside it** (including the `.well-known` folder and `.nojekyll` file — on Mac press `Cmd+Shift+.` to see hidden files; on Windows enable *View → Hidden items*) and drag it into the browser. Click *Commit changes*.
   - Tip: if dragging a folder doesn't work, use **GitHub Desktop** (free app): *File → Clone repository*, copy the files into the cloned folder, then *Commit* and *Push*.
5. **Turn on Pages:** repository → *Settings* → *Pages* → *Source: Deploy from a branch* → Branch **main** / **(root)** → *Save*.
6. Wait 1–2 minutes and open **https://humanaihelp.github.io**. 🎉

Note: GitHub Pages is meant for information websites. Our site has no payments on it — payments happen through UPI or payment links — so it fits.

### 2a. Optional later: switch to a shorter address

Today the address is **humanaihelp.github.io** (it comes from the organisation name). If you later want a different name or your own domain (e.g. `humanaihelp.in`), do it **before printing visiting cards**:

**Option A — rename the GitHub organisation (free)**
1. Check the new name is free: open `https://github.com/<new-name>` — a "404" page means it's available.
2. GitHub → organisation → *Settings* → *General* → *Rename organization* → type the new name.
3. Repository → *Settings* → *General* → rename the repository to `<new-name>.github.io` (lowercase).
4. Admin page sign-in screen: change *GitHub account / organisation* and *Repository* to the new names.
5. In the admin page → *Site settings* nothing else is needed, but the old address is also written inside the files `sitemap.xml`, `robots.txt` and each page's hidden "canonical/og" lines — ask your technology lead (or Claude) to regenerate the site with the new address, and to regenerate the brand kit (visiting cards, social images, templates, email signature) which show the address.
6. The old address stops working after the rename — update WhatsApp Business profile, Google profile and social bios.

**Option B — use your own domain (about ₹800–1,500 per year)**
1. Buy the domain (e.g. from GoDaddy, Hostinger, Namecheap).
2. Repository → *Settings* → *Pages* → *Custom domain* → enter `www.yourdomain.in` → *Save*; tick *Enforce HTTPS* when available.
3. At the domain seller add a **CNAME** record: `www` → `humanaihelp.github.io`.
4. Regenerate the files and brand kit with the new address (as in step 5 above). The github.io address keeps working and forwards to your domain.

---

## 3. Signing in and going live (no GitHub key)

The admin page uses **no GitHub key**. It can only change files on your own computer. Going live always happens in **VS Code**, with your own GitHub sign-in.

**One-time setup (computer):**
- Clone the repository in VS Code (*Source Control → Clone Repository → humanaihelp/humanaihelp.github.io*) into `HumanAI\humanaihelp.github.io`.
- Sign in to GitHub in VS Code when it asks.

**Every time:**
1. Open **https://humanaihelp.github.io/admin/** in Chrome or Edge on the computer. Enter your **mobile number** (admin list: 94492 30088, 96202 16059, 78921 99834).
2. Edit the pages.
3. Click **Save changes → Save into my website folder**. The first time, choose the `humanaihelp.github.io` folder. Chrome remembers it and only asks to *Allow* again later.
4. In VS Code: **Source Control** → check the changed files → type a short message → **Commit** → **Sync Changes / Push**. The live site updates in about 1 minute.

**On a phone** (no folder access), *Save changes* downloads a zip. Unzip it into the repo folder on the computer later, then commit and push.

**Important:** the admin page loads pages from the *live* site. Always **push** your VS Code commits before starting a new admin session. Otherwise you'd be editing an older version.

**About the mobile number:** it is a front door, not a lock. Numbers are stored as scrambled codes (hashes). Nobody can change the live site without pushing from a GitHub account that has access to the organisation. To add or remove a number, ask Claude to update `ADMIN_PHONE_HASHES` in `admin/admin.js`.

**If you created a GitHub token earlier:** it's no longer needed. Delete it in GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → *Website admin* → **Delete**.

---

## 4. Using the admin page

Open **https://humanaihelp.github.io/admin/** and enter your mobile number (section 3).

| I want to… | Do this |
|---|---|
| Change any text | Click on the words in the page preview and type. `Ctrl+Z` undoes. |
| Add a service point, FAQ, card | Click the item → in *Selected* choose the right level (e.g. `li` or `div.acc`) → **Duplicate** → edit the copy |
| Remove something | Select it → **Delete** |
| Reorder | Select it → **Move up / Move down** |
| Change a button/link | Select the button → *Link* box → change address → **Apply link** |
| Add a team photo | Select the photo box (initials) → choose image → **Insert / replace image** |
| Change phone, WhatsApp, email, hours, GSTIN, proprietor | *Site settings* → **Apply to all pages** |
| Change colours | *Site settings* → *Brand colours* → **Apply colours** |
| Change the logo | *Site settings* → *Logo* → upload → **Replace logo** |
| Edit the chat assistant | *Site settings* → *Chat assistant answers* → edit → **Save assistant answers** |
| Change page title for Google | *Page* tab |
| Change menu or footer | Edit on any page — it's copied to all pages when you publish (*Page* tab checkbox) |
| Create a new page | *Pages* tab → *Create a new page* → then add a menu link (select a menu item → Duplicate → edit text & link) |
| Write an official letter / PDF | **Letters** tab → **Open Letter Studio** (section 4a) |
| See who contacted you (form + WhatsApp) | **Enquiries** tab (section 9) |
| Make changes live | **Save changes** → **Save into my website folder** → VS Code **Commit** → **Push**. Live in ~1 minute. |
| Undo everything not yet published | **Discard changes** |

Unpublished changes are saved on your computer automatically as a draft.

**Adding your GSTIN:** *Site settings* → GSTIN → *Apply to all pages* → *Save changes* → commit & push. It then appears in the footer of every page.

### 4a. Letter Studio — official letters as PDF

Admin → **Letters** tab → **Open Letter Studio**.

**Where letters go:** each saved letter is added to the register in this browser (on this computer) and downloaded as a PDF. File the PDFs in `HumanAI\HumanAI-Documents\Letters`. Use the same computer and browser for letters so the reference numbers continue (HAC/L/2026/001, 002 …).

**Writing a letter:**
1. Pick a template (Blank, Appreciation/contribution, Service confirmation, Payment acknowledgement, To whom it may concern) → **Use template**.
2. Fill *To*, *Subject*, and edit the text — replace every [bracketed] part. Choose who signs.
3. The preview on the right shows the official letterhead: logo, business name, proprietor, **GSTIN**, phone, email and website.
4. **Save letter** → gets the next reference number (e.g. `HAC/L/2026/001`), keeps an editable copy in this browser's register and downloads the PDF. The *Saved letters* list shows all letters with **Open**, **PDF** and **Copy as new**.
5. **Download PDF** saves to your computer; **Print** opens the print window (choose your printer, or *Save as PDF*).
6. Sign by hand (or add a scanned signature if you wish) before sending official letters.

Letters contain personal information — never put them in the website repository folder.

---

## 5. Use the website as a phone app (free, today)

The site is a **Progressive Web App**. Anyone can install it:
- **Android (Chrome):** open the site → ⋮ menu → **Add to Home screen / Install app**.
- **iPhone (Safari):** open the site → Share → **Add to Home Screen**.
It opens full-screen with the HumanAI icon, like an app, and the main pages work even with a weak connection.

### 5a. The Android app file (APK) — free, live today
- Built with PWABuilder (free): package **io.github.humanaihelp.app**, version 1.0.0.0, target Android API 36.
- The public page **/app.html** offers: install from Chrome, **Download APK** (`app/HumanAI-Concierge.apk`), and iPhone steps.
- `.well-known/assetlinks.json` holds the app's certificate fingerprint, so the app opens full-screen without a browser bar. Don't edit or delete it.
- **Keep the signing key private:** `HumanAI - Google Play package.zip` contains `signing.keystore` and its passwords. Never upload it to the website repo. Keep one copy in the HumanAI folder and one in a private Google Drive folder. If it's lost you can never update the app.
- **New app version** (only needed for a new icon or name — website edits appear in the app automatically): PWABuilder → *Package for stores* → Android → **Use existing signing key** (upload `signing.keystore`) → raise the version number → replace `app/HumanAI-Concierge.apk`.
- **Free app stores:** Indus Appstore (India, developer.indusappstore.com) and Samsung Galaxy Store take the same APK/AAB. Google Play costs a one-time US$25 (section 6).

---

## 6. Publish the app on Google Play Store

This turns the website into a real Play Store app (a "Trusted Web Activity") — no separate app code needed, and website edits update the app automatically.

### Costs and rules (checked October 2026 — re-check on the official pages before starting)
| Item | Details |
|---|---|
| Google Play developer account | **US$25 one-time** fee ([Play Console](https://play.google.com/console/signup)) |
| Account type | **Personal** (government ID) or **Organisation** (needs a free **D-U-N-S number** for the business). |
| Testing rule for new personal accounts | Accounts created after 13 Nov 2023 must run a **closed test with at least 12 testers opted in for 14 days in a row** before going live ([Google](https://support.google.com/googleplay/android-developer/answer/14151465)). Organisation accounts are reported to be exempt. |
| Target API level | New apps and updates must target **Android 16 (API 36)** from 31 Aug 2026 ([Google](https://support.google.com/googleplay/android-developer/answer/11926878)). PWABuilder packages use current targets — check the number when you generate. |
| Developer verification | Apps on Google Play are registered automatically; the wider Android verification rollout starts in some countries from Sept 2026 and globally from 2027 ([Android](https://developer.android.com/developer-verification)). |
| Privacy policy URL | https://humanaihelp.github.io/privacy.html |
| Audience | Must **not** target children (web-based apps can't). Choose 18+. |

### Steps
1. **Generate the app package (free):** go to <https://www.pwabuilder.com>, enter `https://humanaihelp.github.io` → *Package for stores* → **Android** → *Generate*.
   - Package ID: `io.github.humanaihelp.app` · App name: `HumanAI Concierge` · Launcher name: `HumanAI`.
   - Download the zip. **Keep `signing.keystore` and `signing-key-info.txt` safe forever** (you need them for every update).
2. **Verify your website owns the app:** open `assetlinks.json` from the PWABuilder zip and copy its content. On GitHub, open the file `.well-known/assetlinks.json` in the repository → click ✏️ → replace the content → *Commit changes*. Check it opens at https://humanaihelp.github.io/.well-known/assetlinks.json
3. **Create the Play Console account** (US$25), verify identity, and create a new app (*App* · *Free*).
4. **Store listing** — use the images in admin → *Brand kit* → *Google Play Store listing*:
   - App icon 512×512 · Feature graphic 1024×500 · 4 phone screenshots (1080×1920).
   - Short description (80 chars): `Real people, smarter help — NRI family care, shopping & concierge in Bengaluru.`
   - Full description: copy from the website home page and services page.
   - Category: *Lifestyle* · Contact: business email & phone · Privacy policy URL (above).
5. **App content forms:** Data safety (the app itself collects no data; WhatsApp is opened for messages), Content rating questionnaire, Target audience 18+, Ads: *No ads*, App access: *All functionality available without login*.
6. **Upload** the `.aab` file to **Testing → Closed testing**, add 12+ testers (friends/family Gmail addresses), keep them opted in for 14 days, then apply for **Production**.
7. **After Google signs your app:** Play Console → *Test and release → App integrity → App signing* → copy the **SHA-256 certificate fingerprint** and add it to `.well-known/assetlinks.json` (keep the PWABuilder one too). This removes the browser address bar inside the app.
8. **Updates:** website changes appear in the app instantly. Only rebuild the package when Google raises the target API level (usually once a year).

---

## 9. Free AI chatbot + enquiry log (Cloudflare — ₹0)

One free **Cloudflare Worker** powers three things: real AI answers in the website's **"Ask us"** bubble, an optional **WhatsApp bot** on +91 94492 30088, and the private **enquiry log** you see in the admin *Enquiries* tab.

**Why it stays free:** on Cloudflare's *Free* plan nothing can be charged — when a daily allowance is used up, requests simply fail and the website quietly falls back to its built-in answers. Workers AI free allowance: 10,000 "neurons" per day (roughly 100–200 chats). KV storage free: 1,000 saved enquiries per day. Never add a payment card and never upgrade to *Workers Paid*.

### 9a. Website chat + enquiry log (about 20 minutes)
1. Sign up free at **dash.cloudflare.com** with the business Gmail.
2. *Workers & Pages* → *Create* → *Create Worker* → name it **humanai-bot** → *Deploy*.
3. *Edit code* → delete everything → paste the whole file **`tools/ai-chatbot-worker.js`** from the website folder → *Deploy*.
4. *Storage & Databases* → *KV* → *Create* → name **humanai-enquiries**.
5. Back in the worker → *Settings* → *Bindings* → *Add*:
   - **Workers AI** → variable name **`AI`**
   - **KV namespace** → variable name **`ENQ`** → choose *humanai-enquiries*
6. *Settings* → *Variables and Secrets* → *Add*:
   - `SITE_URL` (Text) = `https://humanaihelp.github.io`
   - `ADMIN_KEY` (Secret) = a long password you make up (save it in Bitwarden)
   - `BOT_MODE` (Text) = `after_hours`
7. Copy the worker's address (like `https://humanai-bot.<name>.workers.dev`).
8. Admin page → *Site settings* → **Chatbot & enquiry service address** → paste → *Apply to all pages* → *Save changes* → commit & push.
9. Test: open the website, ask the bubble a question (AI answer), then send the contact form. Admin → **Enquiries** → enter your `ADMIN_KEY` → *Load enquiries* — your test appears. Update status (New → Contacted → Quoted → Won → Closed), WhatsApp/call back, export CSV.

### 9b. WhatsApp AI bot on 94492 30088 (optional, free, ~1–2 hours, done by Muttu)
How it works: messages arrive from Meta → the worker logs them in *Enquiries* → outside working hours (Mon–Sat 9–7 IST) the bot answers from your website information and invites the person to type **HUMAN**; during working hours it stays silent so Deepa replies personally.
1. **developers.facebook.com** → *My Apps* → *Create app* → use case **WhatsApp** → link/create your Meta Business portfolio (business verification may be requested).
2. In the app → *WhatsApp* → *API setup* → add your phone number. Meta's **"coexistence"** onboarding is meant to let you keep using the WhatsApp Business app on the same number — confirm it is offered for your number before proceeding; if not, use the bot only on the website for now.
3. Create a **permanent access token** (System user in Business settings → assign the app → generate token with *whatsapp_business_messaging*).
4. In the worker → *Variables and Secrets* add (Secret): `WA_TOKEN`, `WA_PHONE_ID` (Phone number ID from API setup), `WA_VERIFY_TOKEN` (any word you choose), `WA_APP_SECRET` (App settings → Basic → App secret).
5. Meta app → *WhatsApp* → *Configuration* → *Webhook*: Callback URL `https://humanai-bot.<name>.workers.dev/whatsapp`, Verify token = your `WA_VERIFY_TOKEN` → *Verify and save* → subscribe to **messages**.
6. Send a test message from another phone outside working hours.

**Cost check:** replying to people who message you first is free under Meta's current pricing; *sending* promotional/template messages is charged — the bot never sends those. Prices change; check Meta's pricing page before going live.
**Rules the bot follows:** answers only from your website information; never quotes prices, never gives medical/legal/financial advice, never asks for OTPs or ID numbers; emergencies → 112/108; always offers a human.

---

## 7. Regular maintenance checklist

| When | What |
|---|---|
| Weekly | Answer WhatsApp messages; check website contact form messages arrive |
| Monthly | Review pages for outdated info; add a real client story (with written permission) |
| Every 3 months | Review the chat assistant answers; test every button on a phone |
| Yearly | Review privacy/terms/disclaimer with a professional; rebuild the Play Store app if Google raises the target API |

---

## 8. Getting help
- Website or admin problems: Muttu Biradar (Operations & Technology Lead).
- If publishing fails, your changes stay saved as a draft on your computer — try again later or use *Edit offline* → download.
