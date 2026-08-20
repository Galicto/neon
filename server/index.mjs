/**
 * Neo Integrations ops server — auth, RBAC, contact mail, static site.
 * Sessions are httpOnly cookies. Passwords are scrypt hashes in SQLite.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OPS = path.join(ROOT, "ops");
const DATA = path.join(ROOT, "data");
mkdirSync(DATA, { recursive: true });
dotenv.config({ path: path.join(ROOT, ".env") });

const PORT = Number(process.env.PORT || 8080);
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";
const COOKIE = "neo_staff_sid";
const SESSION_MS = 8 * 60 * 60 * 1000;
const CONTACT_TO = process.env.CONTACT_TO || "Info@neointegrations.com";
const WHATSAPP_TO = String(process.env.WHATSAPP_TO || "918789359477").replace(/\D/g, "");
const CONTACT_FROM =
  process.env.CONTACT_FROM || "Neo Integrations <Info@neointegrations.com>";

function requireSecret() {
  let secret = process.env.SESSION_SECRET || "";
  if (secret.length >= 32) return secret;
  if (IS_PROD) {
    console.error("SESSION_SECRET must be set to 32+ characters in production.");
    process.exit(1);
  }
  secret = randomBytes(32).toString("hex");
  console.warn("SESSION_SECRET missing — generated a dev-only secret. Set it in .env for production.");
  return secret;
}

const SESSION_SECRET = requireSecret();

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

function verifyPassword(password, stored) {
  const [saltHex, hashHex] = String(stored || "").split(":");
  if (!saltHex || !hashHex) return false;
  const hash = scryptSync(password, Buffer.from(saltHex, "hex"), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashHex, "hex");
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

function randomPassword() {
  return randomBytes(18).toString("base64url");
}

function signSid(id) {
  const mac = createHash("sha256").update(SESSION_SECRET + ":" + id).digest("hex");
  return `${id}.${mac}`;
}

function parseSid(raw) {
  const value = String(raw || "");
  const i = value.lastIndexOf(".");
  if (i < 1) return null;
  const id = value.slice(0, i);
  const mac = value.slice(i + 1);
  const expected = createHash("sha256").update(SESSION_SECRET + ":" + id).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return id;
}

const db = new DatabaseSync(path.join(DATA, "ops.sqlite"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    bottleneck TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
  );
`);

function nowIso() {
  return new Date().toISOString();
}

function seedStaff() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
  if (count > 0) return;

  const adminEmail = (process.env.STAFF_ADMIN_EMAIL || "admin@neointegrations.com").trim().toLowerCase();
  const managerEmail = (process.env.STAFF_MANAGER_EMAIL || "manager@neointegrations.com").trim().toLowerCase();
  const adminPass = process.env.STAFF_ADMIN_PASSWORD || randomPassword();
  const managerPass = process.env.STAFF_MANAGER_PASSWORD || randomPassword();
  const generated = !process.env.STAFF_ADMIN_PASSWORD || !process.env.STAFF_MANAGER_PASSWORD;

  db.prepare(
    "INSERT INTO users (email, password_hash, role, active, created_at) VALUES (?, ?, 'admin', 1, ?)"
  ).run(adminEmail, hashPassword(adminPass), nowIso());
  db.prepare(
    "INSERT INTO users (email, password_hash, role, active, created_at) VALUES (?, ?, 'manager', 1, ?)"
  ).run(managerEmail, hashPassword(managerPass), nowIso());

  const lines = [
    "CHANGE THESE IMMEDIATELY. Generated because STAFF_*_PASSWORD was empty.",
    `Admin:   ${adminEmail}  /  ${adminPass}`,
    `Manager: ${managerEmail}  /  ${managerPass}`,
    "",
  ].join("\n");

  if (generated) {
    writeFileSync(path.join(DATA, "INITIAL_CREDENTIALS.txt"), lines, { mode: 0o600 });
  }
  console.log("\n=== Staff accounts (change immediately) ===");
  console.log(`Admin:   ${adminEmail}`);
  console.log(`Manager: ${managerEmail}`);
  if (generated) console.log("Passwords written to data/INITIAL_CREDENTIALS.txt (gitignored).\n");
  else console.log("Passwords taken from environment.\n");
}

seedStaff();

function audit(userId, action, detail) {
  db.prepare(
    "INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)"
  ).run(userId || null, action, detail || "", nowIso());
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many login attempts. Try again in 15 minutes." },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: "Too many requests from this network. Try again later." },
});

function expectedHosts() {
  const hosts = new Set();
  if (process.env.PUBLIC_ORIGIN) {
    try {
      hosts.add(new URL(process.env.PUBLIC_ORIGIN).host);
    } catch {
      /* ignore */
    }
  }
  hosts.add(`localhost:${PORT}`);
  hosts.add(`127.0.0.1:${PORT}`);
  return hosts;
}

function requireSameOrigin(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const origin = req.headers.origin;
  if (!origin) {
    if (IS_PROD) return res.status(403).json({ ok: false, error: "Missing origin." });
    return next();
  }
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    return res.status(403).json({ ok: false, error: "Bad origin." });
  }
  if (!expectedHosts().has(host) && host !== req.headers.host) {
    return res.status(403).json({ ok: false, error: "Bad origin." });
  }
  next();
}

app.use("/api", requireSameOrigin);

function loadUser(req) {
  const sid = parseSid(req.cookies[COOKIE]);
  if (!sid) return null;
  const session = db.prepare("SELECT * FROM sessions WHERE id = ?").get(sid);
  if (!session || session.expires_at < Date.now()) {
    if (session) db.prepare("DELETE FROM sessions WHERE id = ?").run(sid);
    return null;
  }
  const user = db.prepare(
    "SELECT id, email, role, active FROM users WHERE id = ?"
  ).get(session.user_id);
  if (!user || !user.active) return null;
  return user;
}

function setSessionCookie(res, sid) {
  res.cookie(COOKIE, signSid(sid), {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    path: "/",
    maxAge: SESSION_MS,
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: "lax", secure: IS_PROD, path: "/" });
}

function requireAuth(...roles) {
  return (req, res, next) => {
    const user = loadUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "Sign in required." });
    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({ ok: false, error: "Not allowed for this role." });
    }
    req.user = user;
    next();
  };
}

function noIndex(res) {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Cache-Control", "no-store");
}

function sendOps(res, file) {
  noIndex(res);
  res.sendFile(path.join(OPS, file));
}

let transporterPromise = null;

async function getTransporter() {
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    if (process.env.RESEND_API_KEY) {
      return { kind: "resend", key: process.env.RESEND_API_KEY };
    }
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const port = Number(process.env.SMTP_PORT || 587);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      return { kind: "smtp", transport };
    }
    return { kind: "none" };
  })();
  return transporterPromise;
}

function leadCopy({ name, email, company, bottleneck }) {
  const subject = `New client onboarding — ${name}`;
  const text = [
    "A new client submitted the NeoIntegration audit form.",
    "",
    `Name: ${name}`,
    `Work email: ${email}`,
    `Company / website: ${company || "—"}`,
    "",
    "Biggest workflow bottleneck / query:",
    bottleneck,
  ].join("\n");
  return { subject, text };
}

async function sendViaFormSubmit({ name, email, company, bottleneck, subject, text }) {
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CONTACT_TO)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: subject,
      _template: "box",
      _captcha: "false",
      _replyto: email,
      name,
      email,
      company: company || "—",
      bottleneck,
      message: text,
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`FormSubmit failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return { via: "formsubmit" };
}

async function sendContactMail(lead) {
  const { subject, text } = leadCopy(lead);
  const mail = await getTransporter();

  if (mail.kind === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mail.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CONTACT_FROM,
        to: [CONTACT_TO],
        reply_to: lead.email,
        subject,
        text,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend failed (${res.status}): ${body.slice(0, 200)}`);
    }
    return { via: "resend" };
  }

  if (mail.kind === "smtp") {
    await mail.transport.sendMail({
      from: CONTACT_FROM,
      to: CONTACT_TO,
      replyTo: lead.email,
      subject,
      text,
    });
    return { via: "smtp" };
  }

  return sendViaFormSubmit({ ...lead, subject, text });
}

async function sendWhatsApp(lead) {
  const { subject, text } = leadCopy(lead);
  const message = `*${subject}*\n\n${text}`.slice(0, 4000);

  if (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const res = await fetch(`https://graph.facebook.com/v21.0/${id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: WHATSAPP_TO,
        type: "text",
        text: { preview_url: false, body: message },
      }),
    });
    if (!res.ok) {
      throw new Error(`WhatsApp Cloud API (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    return "cloud";
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
        To: `whatsapp:+${WHATSAPP_TO}`,
        Body: message,
      }),
    });
    if (!res.ok) {
      throw new Error(`Twilio WhatsApp (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    return "twilio";
  }

  if (process.env.CALLMEBOT_APIKEY) {
    const url = new URL("https://api.callmebot.com/whatsapp.php");
    url.searchParams.set("phone", WHATSAPP_TO);
    url.searchParams.set("text", message);
    url.searchParams.set("apikey", process.env.CALLMEBOT_APIKEY);
    const res = await fetch(url);
    const body = await res.text();
    if (!res.ok || /error|invalid/i.test(body)) {
      throw new Error(`CallMeBot failed: ${body.slice(0, 200)}`);
    }
    return "callmebot";
  }

  if (process.env.WHATSAPP_WEBHOOK_URL) {
    const res = await fetch(process.env.WHATSAPP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: `+${WHATSAPP_TO}`,
        subject,
        text,
        name: lead.name,
        email: lead.email,
        company: lead.company || "",
        bottleneck: lead.bottleneck,
      }),
    });
    if (!res.ok) {
      throw new Error(`WhatsApp webhook (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    return "webhook";
  }

  const err = new Error("WhatsApp is not configured.");
  err.code = "WA_UNCONFIGURED";
  throw err;
}

function ntfyTopic() {
  if (process.env.NTFY_TOPIC) return process.env.NTFY_TOPIC.trim();
  const file = path.join(DATA, "ntfy-topic.txt");
  if (existsSync(file)) {
    const existing = readFileSync(file, "utf8").trim();
    if (existing) return existing;
  }
  const topic = "neo-leads-" + randomBytes(12).toString("hex");
  writeFileSync(file, topic, { mode: 0o600 });
  return topic;
}

function ntfyUrl() {
  const base = (process.env.NTFY_URL || "https://ntfy.sh").replace(/\/$/, "");
  return `${base}/${ntfyTopic()}`;
}

function writeAlertCard() {
  const url = ntfyUrl();
  const card = [
    "Neo Integrations — phone alerts (no CallMeBot)",
    "",
    "1. Install ntfy on the phone that should get every audit form:",
    "   iPhone:  https://apps.apple.com/app/ntfy/id1625396347",
    "   Android: https://play.google.com/store/apps/details?id=io.heckel.ntfy",
    "2. In the app: Subscribe to topic, paste this URL:",
    `   ${url}`,
    "3. Keep the topic private — it carries client names and emails.",
    "",
    "Optional Telegram (BotFather always replies, unlike CallMeBot):",
    "  TELEGRAM_BOT_TOKEN=... in .env, then message your bot /start and restart the server.",
    "",
  ].join("\n");
  writeFileSync(path.join(DATA, "PHONE_ALERTS.txt"), card, { mode: 0o600 });
  return url;
}

async function sendNtfy(lead) {
  const { subject, text } = leadCopy(lead);
  const res = await fetch(ntfyUrl(), {
    method: "POST",
    headers: {
      Title: subject,
      Priority: "high",
      Tags: "envelope,office",
    },
    body: text,
  });
  if (!res.ok) {
    throw new Error(`ntfy failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return "ntfy";
}

async function resolveTelegramChatId(token) {
  if (process.env.TELEGRAM_CHAT_ID) return process.env.TELEGRAM_CHAT_ID.trim();
  const file = path.join(DATA, "telegram-chat-id.txt");
  if (existsSync(file)) {
    const saved = readFileSync(file, "utf8").trim();
    if (saved) return saved;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Telegram getUpdates: ${JSON.stringify(data).slice(0, 200)}`);
  }
  const chatId = [...(data.result || [])]
    .reverse()
    .map((u) => u.message?.chat?.id)
    .find(Boolean);
  if (!chatId) {
    const err = new Error("Telegram bot has no chat yet. Open the bot and tap Start.");
    err.code = "TG_NO_CHAT";
    throw err;
  }
  writeFileSync(file, String(chatId), { mode: 0o600 });
  return String(chatId);
}

async function sendTelegram(lead) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    const err = new Error("Telegram is not configured.");
    err.code = "TG_UNCONFIGURED";
    throw err;
  }
  const { subject, text } = leadCopy(lead);
  const chatId = await resolveTelegramChatId(token);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `*${subject}*\n\n${text}`.slice(0, 4000),
      parse_mode: "Markdown",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(`Telegram send failed: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return "telegram";
}

function whatsappConfigured() {
  return Boolean(
    (process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) ||
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) ||
      process.env.CALLMEBOT_APIKEY ||
      process.env.WHATSAPP_WEBHOOK_URL
  );
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, env: NODE_ENV });
});

app.post("/api/auth/login", loginLimiter, (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: "Email and password are required." });
  }
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  const dummy = hashPassword("timing-guard");
  const ok = user && user.active && verifyPassword(password, user.password_hash);
  if (!ok) {
    if (!user) verifyPassword(password, dummy);
    audit(user?.id || null, "login_failed", email);
    return res.status(401).json({ ok: false, error: "Invalid email or password." });
  }
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?").run(user.id, Date.now());
  const sid = randomBytes(24).toString("hex");
  db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)").run(
    sid,
    user.id,
    Date.now() + SESSION_MS
  );
  setSessionCookie(res, sid);
  audit(user.id, "login", user.role);
  res.json({ ok: true, user: { email: user.email, role: user.role } });
});

app.post("/api/auth/logout", (req, res) => {
  const sid = parseSid(req.cookies[COOKIE]);
  if (sid) db.prepare("DELETE FROM sessions WHERE id = ?").run(sid);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth(), (req, res) => {
  res.json({ ok: true, user: { email: req.user.email, role: req.user.role } });
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/contact", contactLimiter, async (req, res) => {
  if (String(req.body?.website || "").trim()) {
    return res.json({ ok: true });
  }
  const name = String(req.body?.name || "").trim().slice(0, 80);
  const email = String(req.body?.email || "").trim().slice(0, 120);
  const company = String(req.body?.company || "").trim().slice(0, 120);
  const bottleneck = String(req.body?.bottleneck || "").trim().slice(0, 2000);
  if (!name || !EMAIL_RE.test(email) || bottleneck.length < 8) {
    return res.status(400).json({
      ok: false,
      error: "Enter a name, a valid work email, and a short description of the bottleneck.",
    });
  }

  db.prepare(
    "INSERT INTO submissions (name, email, company, bottleneck, status, notes, created_at) VALUES (?, ?, ?, ?, 'new', '', ?)"
  ).run(name, email, company, bottleneck, nowIso());

  const lead = { name, email, company, bottleneck };

  const mailResult = await sendContactMail(lead)
    .then((sent) => ({ ok: true, via: sent.via }))
    .catch((err) => {
      console.error("Contact mail error:", err);
      return { ok: false, error: err.message };
    });

  const waResult = whatsappConfigured()
    ? await sendWhatsApp(lead)
        .then((via) => ({ ok: true, via }))
        .catch((err) => {
          console.error("Contact WhatsApp error:", err);
          return { ok: false, error: err.message };
        })
    : { ok: false, skipped: true };

  const tgResult = process.env.TELEGRAM_BOT_TOKEN
    ? await sendTelegram(lead)
        .then((via) => ({ ok: true, via }))
        .catch((err) => {
          console.error("Contact Telegram error:", err);
          return { ok: false, error: err.message };
        })
    : { ok: false, skipped: true };

  const ntfyResult = await sendNtfy(lead)
    .then((via) => ({ ok: true, via }))
    .catch((err) => {
      console.error("Contact ntfy error:", err);
      return { ok: false, error: err.message };
    });

  if (!mailResult.ok && !waResult.ok && !tgResult.ok && !ntfyResult.ok) {
    return res.status(502).json({
      ok: false,
      error: "We saved your request but notification delivery failed. Write to Info@neointegrations.com.",
      saved: true,
    });
  }

  const parts = [];
  if (mailResult.ok) parts.push("email");
  if (waResult.ok) parts.push("WhatsApp");
  if (tgResult.ok) parts.push("Telegram");
  if (ntfyResult.ok) parts.push("phone");

  res.json({
    ok: true,
    email: mailResult.ok,
    whatsapp: waResult.ok,
    telegram: tgResult.ok,
    phone: ntfyResult.ok,
    message: "Request sent. The team is notified.",
    delivered: parts,
  });
});

app.get("/api/stats", requireAuth("admin", "manager"), (_req, res) => {
  const total = db.prepare("SELECT COUNT(*) AS n FROM submissions").get().n;
  const fresh = db.prepare("SELECT COUNT(*) AS n FROM submissions WHERE status = 'new'").get().n;
  const week = db
    .prepare("SELECT COUNT(*) AS n FROM submissions WHERE created_at >= ?")
    .get(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).n;
  const users = db.prepare("SELECT COUNT(*) AS n FROM users WHERE active = 1").get().n;
  res.json({
    ok: true,
    stats: { submissions: total, new: fresh, last7d: week, staff: users },
    placeholders: {
      siteVisits: "Not wired — no analytics provider yet",
      liveConversations: "Not wired — client OS is a product demo",
    },
  });
});

app.get("/api/submissions", requireAuth("admin", "manager"), (_req, res) => {
  const rows = db
    .prepare(
      "SELECT id, name, email, company, bottleneck, status, notes, created_at FROM submissions ORDER BY id DESC LIMIT 200"
    )
    .all();
  res.json({ ok: true, submissions: rows });
});

app.patch("/api/submissions/:id", requireAuth("admin", "manager"), (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(id);
  if (!row) return res.status(404).json({ ok: false, error: "Not found." });
  const status = String(req.body?.status || row.status);
  const allowed = new Set(["new", "in_review", "replied", "closed"]);
  if (!allowed.has(status)) return res.status(400).json({ ok: false, error: "Invalid status." });
  const notes = String(req.body?.notes ?? row.notes).slice(0, 4000);
  db.prepare("UPDATE submissions SET status = ?, notes = ? WHERE id = ?").run(status, notes, id);
  audit(req.user.id, "submission_update", String(id));
  res.json({ ok: true });
});

app.get("/api/users", requireAuth("admin"), (_req, res) => {
  const rows = db
    .prepare("SELECT id, email, role, active, created_at FROM users ORDER BY id ASC")
    .all();
  res.json({ ok: true, users: rows });
});

app.post("/api/users", requireAuth("admin"), (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = String(req.body?.role || "manager");
  if (!EMAIL_RE.test(email) || password.length < 12) {
    return res.status(400).json({ ok: false, error: "Valid email and a 12+ character password are required." });
  }
  if (role !== "manager") {
    return res.status(400).json({ ok: false, error: "New staff accounts can only be managers. Admins are provisioned from the environment." });
  }
  try {
    const info = db
      .prepare(
        "INSERT INTO users (email, password_hash, role, active, created_at) VALUES (?, ?, 'manager', 1, ?)"
      )
      .run(email, hashPassword(password), nowIso());
    audit(req.user.id, "user_create", email);
    res.json({ ok: true, id: Number(info.lastInsertRowid) });
  } catch {
    res.status(409).json({ ok: false, error: "That email is already in use." });
  }
});

app.patch("/api/users/:id", requireAuth("admin"), (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ ok: false, error: "Not found." });
  if (user.id === req.user.id) {
    return res.status(400).json({ ok: false, error: "You cannot disable your own account." });
  }
  if (typeof req.body?.active === "boolean" || req.body?.active === 0 || req.body?.active === 1) {
    const active = req.body.active ? 1 : 0;
    db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active, id);
    if (!active) db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
    audit(req.user.id, active ? "user_enable" : "user_disable", user.email);
  }
  res.json({ ok: true });
});

app.get("/api/audit-log", requireAuth("admin"), (_req, res) => {
  const rows = db
    .prepare(
      "SELECT id, user_id, action, detail, created_at FROM audit_log ORDER BY id DESC LIMIT 100"
    )
    .all();
  res.json({ ok: true, log: rows });
});

app.get("/staff/login", (req, res) => {
  const user = loadUser(req);
  if (user) return res.redirect(user.role === "admin" ? "/admin" : "/manager");
  sendOps(res, "login.html");
});

app.get("/admin", (req, res) => {
  const user = loadUser(req);
  if (!user) return res.redirect("/staff/login");
  if (user.role !== "admin") return sendOps(res.status(403), "forbidden.html");
  sendOps(res, "admin.html");
});

app.get("/manager", (req, res) => {
  const user = loadUser(req);
  if (!user) return res.redirect("/staff/login");
  if (user.role !== "manager" && user.role !== "admin") {
    return sendOps(res.status(403), "forbidden.html");
  }
  sendOps(res, "manager.html");
});

app.get("/ops/ops.css", (_req, res) => {
  noIndex(res);
  res.type("css").sendFile(path.join(OPS, "ops.css"));
});
app.get("/ops/ops.js", (_req, res) => {
  noIndex(res);
  res.type("js").sendFile(path.join(OPS, "ops.js"));
});
app.use("/ops", (_req, res) => {
  res.status(404).end();
});

const HIDDEN = new Set([
  "/server",
  "/data",
  "/node_modules",
  "/demo-dashboard",
  "/.qa",
  "/.git",
  "/.env",
  "/.env.local",
  "/package.json",
  "/package-lock.json",
]);

app.use((req, res, next) => {
  const p = req.path;
  if ([...HIDDEN].some((prefix) => p === prefix || p.startsWith(prefix + "/"))) {
    return res.status(404).end();
  }
  next();
});

app.use(
  express.static(ROOT, {
    extensions: ["html"],
    setHeaders(res, filePath) {
      const rel = path.relative(ROOT, filePath).replace(/\\/g, "/");
      if (
        rel.startsWith("ops/") ||
        rel === "login.html" ||
        rel === "dashboard.html" ||
        rel === "dashboard-app.js" ||
        rel === "dashboard-data.js"
      ) {
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
      }
    },
  })
);

db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());

app.listen(PORT, () => {
  const alerts = writeAlertCard();
  console.log(`Neo site + ops server on http://localhost:${PORT}`);
  console.log("Staff login: http://localhost:" + PORT + "/staff/login");
  console.log("Phone alerts (ntfy): " + alerts);
});
