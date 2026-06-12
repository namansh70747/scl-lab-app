# Sharma Clinical Laboratory — Setup Guide

Plain-English steps to switch on each feature. Do these once on the lab PC.
Open the app → **Settings** (gear icon, admin only) for everything below.

---

## 1. Email — send report PDF from the lab Gmail

Reports email from **rajeshsharmark321@gmail.com** with the PDF attached. Gmail does
**not** accept your normal password from apps — you must create a one-time **App Password**.

1. Sign in to that Gmail in a browser → **Google Account → Security**.
2. Turn on **2-Step Verification** (required before App Passwords appear).
3. Search **"App passwords"** (or visit myaccount.google.com/apppasswords).
4. App = "Mail", Device = "Other" → type `SCL Lab` → **Generate**.
5. Google shows a **16-letter password** (like `abcd efgh ijkl mnop`). Copy it.
6. In the app: **Settings → Email (SMTP)**. Host/port/username are already filled.
   Paste the 16 letters (no spaces) into **Password / app password** → **Save**.
7. Click **Send test email** → enter your own address → check it arrives.

Now the **Email** button on any approved report sends the PDF to the patient's email.

---

## 2. WhatsApp — send the report PDF (1-tap, from Dad's number)

This keeps the lab's existing WhatsApp number and is free. It is *semi-automatic*:
the app does everything except the final tap (WhatsApp bans normal numbers that send
fully on their own).

**How it works when you click WhatsApp on a report:**
1. The PDF is saved and the patient's chat opens in **WhatsApp Desktop** with the
   message already typed.
2. The PDF file is highlighted in its folder — drag it into the chat (or click 📎 →
   Document → it's the most recent file) and press **Send**.

**One-time setup:** install **WhatsApp Desktop** on the PC and sign in with the lab's
WhatsApp. That's it.

> **Want zero taps (fully automatic)?** That needs the official **WhatsApp Cloud API**:
> a **separate** phone number (the lab's personal WhatsApp can't be reused), a free Meta
> Business account, business verification, and a Meta-approved message template. It takes
> a few days of approval. Tell me if you want this and I'll wire it to the same button.

---

## 3. SMS — text the patient "report ready"

Indian law (TRAI/DLT) means automated SMS must use a registered **Sender ID** (like
`SCLLAB`), **not** a personal mobile number, and costs about ₹0.15–0.20 per message.

**One-time registration (do this on the gateway's website):**
1. Create an account at **Fast2SMS** (fast2sms.com) — simplest — or **MSG91**.
2. Complete **DLT registration** (PAN/GST of the lab; the gateway guides you).
3. Register a **Sender ID / Header** — 6 letters, e.g. `SCLLAB`.
4. Register a **template** with exactly **two variables in this order**: patient name,
   then test number. Suggested text:
   > Dear {#var#}, your lab report (Test No {#var#}) from SHARMA CLINICAL LABORATORY,
   > Nangal Bhur is ready. Thank you.
5. After approval you get a **template/message ID** and an **API key**.

**In the app:** **Settings → SMS** → choose provider → paste **API key**, **Sender ID**,
**Template ID** → **Save** → **Send test SMS** to your own number.

Now the **SMS** button on a report texts the patient.

---

## 4. CBC analyzer (ERBA H360) — auto-fill results

The H360 is wired to the PC by a **serial (COM) cable**. After running a sample you pull
its results into the report — staff confirm the numbers before they're saved.

**One-time setup — Settings → Analyzer:**
1. On the H360, set its **Host/LIS output ON** and note its **baud rate** (often 9600).
2. In the app, click **List ports**, pick the COM port the cable uses (e.g. `COM3`),
   set the same **baud rate** → **Save**.
3. Run a sample on the machine, then click **Capture raw (test)**. You should see the
   machine's text. If values show, you're done. *If the text looks unusual, send me that
   raw output and I'll tune the reader to your machine's exact format.*

**Daily use:** open the patient in **Result Entry** → run the sample → click
**Read from analyzer** → review the values → **Apply**. H/L flags are calculated
automatically.

**Histograms (the WBC/RBC/PLT graphs):** if the H360 transmits the curve data over the
cable, the app captures it and prints the **real** graphs on the CBC report. If your
machine only prints them on its own slip and doesn't send the curve, no graph is shown —
the app will never draw a fake one. (Confirm with the raw capture above.)

---

## 5. Printing — with or without your pre-printed letterhead paper

On a report, the **Layout** panel has **Print lab letterhead**:
- **ON** → prints the full header + footer (use plain paper, or for PDF/WhatsApp/email).
- **OFF** → prints only the patient data, shifted down to land inside your **pre-printed
  letterhead paper's** frame. Use the **Top gap / Bottom gap (mm)** boxes to line it up
  perfectly the first time (the setting is remembered).

**To print:** click **Print** → Windows' print box opens → pick your lab printer → Print.
PDF, WhatsApp and Email always include the full digital letterhead regardless of the toggle.

---

## 6. Money / dues

The bill shows **Total → Concession → Net → Received → Balance**. If a patient pays the
balance later, open their report → **Billing → Record payment** → enter the amount. The
balance updates everywhere (dashboard, patient list, reports).

---

## Quick first-run checklist
- [ ] Upload logo & signature — **Settings → Branding**
- [ ] Enter Gmail **App Password** — **Settings → Email**
- [ ] Install & sign in to **WhatsApp Desktop**
- [ ] (Optional) Register SMS Sender ID/template — **Settings → SMS**
- [ ] Set analyzer **COM port + baud** — **Settings → Analyzer**
- [ ] Print one report on letterhead paper and dial in the **mm gaps**
