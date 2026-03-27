require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);
const PORT = process.env.PORT || 3000;
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN;

// ─── Pending requests store ────────────────────────────────────────────────────
const pending = {};

// ─── Main menu ─────────────────────────────────────────────────────────────────
bot.start((ctx) => {
  console.log("✅ /start received from", ctx.from.id);
  ctx.reply(
    "👋 Welcome to Greenwheels!\n\nWhat would you like to do?",
    Markup.inlineKeyboard([
      [Markup.button.callback("🪪 Get my UUID", "get_uuid")],
      [Markup.button.callback("💰 Check my balance", "check_balance")],
    ])
  );
});

// ─── Get UUID flow ─────────────────────────────────────────────────────────────
bot.action("get_uuid", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply(
    "📱 Please enter your phone number:\n\n_(include country code e.g. +254712345678)_",
    { parse_mode: "Markdown" }
  );
});

// ─── Check balance flow ────────────────────────────────────────────────────────
bot.action("check_balance", (ctx) => {
  ctx.answerCbQuery();
  const telegramId = ctx.from.id;
  const chatId = ctx.chat.id;

  pending["balance_" + telegramId] = chatId;

  ctx.reply("🔍 Fetching your balance, please wait...");

  fetch("https://hooks.zapier.com/hooks/catch/15146927/un127yd/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      telegram_id: telegramId,
      callback_url: `https://${RAILWAY_URL}/balance-callback`,
    }),
  })
    .then((r) => r.text())
    .then((body) => console.log("Balance Zapier response:", body))
    .catch((err) => {
      console.error("Balance Zapier error:", err);
      bot.telegram.sendMessage(chatId, "❌ Could not reach our system. Please try again.");
      delete pending["balance_" + telegramId];
    });
});

// ─── Text handler (UUID phone number input) ────────────────────────────────────
bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return;

  if (!/^\+?[\d\s\-]{7,15}$/.test(text)) {
    ctx.reply("⚠️ Invalid number. Try e.g. *+254712345678*", { parse_mode: "Markdown" });
    return;
  }

  const chatId = ctx.chat.id;
  pending[text] = chatId;
  await ctx.reply("🔍 Looking up your UUID, please wait...");

  try {
    console.log("Sending to Zapier:", text);
    const zapRes = await fetch("https://hooks.zapier.com/hooks/catch/15146927/unmxgq5/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: text,
        callback_url: `https://${RAILWAY_URL}/zapier-callback`,
      }),
    });
    console.log("Zapier status:", zapRes.status);
    console.log("Zapier body:", await zapRes.text());
  } catch (err) {
    console.error("Zapier error:", err);
    ctx.reply("❌ Could not reach our system. Please try again.");
    delete pending[text];
  }
});

// ─── Express app ───────────────────────────────────────────────────────────────
const app = express();

app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

const WEBHOOK_PATH = "/bot-webhook";
app.use(WEBHOOK_PATH, express.json(), (req, res) => {
  console.log("📨 Webhook body:", JSON.stringify(req.body));
  bot.handleUpdate(req.body, res);
});

app.use(express.json());

// ─── UUID callback ─────────────────────────────────────────────────────────────
app.post("/zapier-callback", async (req, res) => {
  console.log("UUID callback received:", req.body);
  const { phone, uuid, status } = req.body;

  if (!phone) return res.status(400).json({ error: "Missing phone" });

  const chatId = pending[phone];
  if (!chatId) return res.status(404).json({ error: "No pending request" });

  if (status === "not_found") {
    await bot.telegram.sendMessage(
      chatId,
      "❌ *No account found*\n\nWe couldn't find a Greenwheels account linked to `" + phone + "`.\n\nPlease check the number and try again.",
      { parse_mode: "Markdown" }
    );
  } else if (uuid) {
    await bot.telegram.sendMessage(
      chatId,
      "✅ *UUID found!*\n\nPhone: `" + phone + "`\nUUID: `" + uuid + "`",
      { parse_mode: "Markdown" }
    );
  } else {
    await bot.telegram.sendMessage(chatId, "⚠️ Something went wrong. Please try again.");
  }

  delete pending[phone];
  res.json({ success: true });
});

// ─── Balance callback ──────────────────────────────────────────────────────────
app.post("/balance-callback", async (req, res) => {
  console.log("Balance callback received:", req.body);
  const { telegram_id, balance, status } = req.body;

  if (!telegram_id) return res.status(400).json({ error: "Missing telegram_id" });

  const chatId = pending["balance_" + telegram_id];
  if (!chatId) return res.status(404).json({ error: "No pending request" });

  if (status === "not_found") {
    await bot.telegram.sendMessage(
      chatId,
      "❌ *No account found*\n\nWe couldn't find a balance linked to your Telegram account.",
      { parse_mode: "Markdown" }
    );
  } else if (balance !== undefined) {
    await bot.telegram.sendMessage(
      chatId,
      "💰 *Your Balance*\n\n`" + balance + "`",
      { parse_mode: "Markdown" }
    );
  } else {
    await bot.telegram.sendMessage(chatId, "⚠️ Something went wrong fetching your balance. Please try again.");
  }

  delete pending["balance_" + telegram_id];
  res.json({ success: true });
});

// ─── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("✅ Greenwheels bot is running."));

// ─── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log("✅ Express running on port " + PORT));

if (RAILWAY_URL) {
  const WEBHOOK_URL = `https://${RAILWAY_URL}${WEBHOOK_PATH}`;
  bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
    console.log("✅ Webhook set:", WEBHOOK_URL);
  });
  console.log("✅ Bot running via webhook...");
} else {
  bot.launch();
  console.log("✅ Bot running via polling...");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
