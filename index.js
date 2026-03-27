require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN;

// ─── Pending requests store ────────────────────────────────────────────────────
const pending = {};

// ─── Main menu ─────────────────────────────────────────────────────────────────
bot.start((ctx) => {
  ctx.reply(
    "👋 Welcome to Greenwheels!\n\nWhat would you like to do?",
    Markup.inlineKeyboard([
      [Markup.button.callback("🪪 Get my UUID", "get_uuid")],
    ])
  );
});

// ─── Button pressed → ask for phone number ─────────────────────────────────────
bot.action("get_uuid", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply(
    "📱 Please enter your phone number:\n\n_(include country code e.g. +254712345678)_",
    { parse_mode: "Markdown" }
  );
});

// ─── Receive phone number → POST to Zapier ─────────────────────────────────────
bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();

  if (text.startsWith("/")) return;

  if (!/^\+?[\d\s\-]{7,15}$/.test(text)) {
    ctx.reply(
      "⚠️ That doesn't look like a valid phone number.\n\nPlease try again with your country code e.g. *+254712345678*",
      { parse_mode: "Markdown" }
    );
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
    const zapBody = await zapRes.text();
    console.log("Zapier response status:", zapRes.status);
    console.log("Zapier response body:", zapBody);
  } catch (err) {
    console.error("Error calling Zapier:", err);
    ctx.reply("❌ Could not reach our system. Please try again in a moment.");
    delete pending[text];
  }
});

// ─── Zapier callback endpoint ──────────────────────────────────────────────────
app.post("/zapier-callback", async (req, res) => {
  console.log("Zapier callback received:", req.body);

  const { phone, uuid } = req.body;

  if (!phone || !uuid) {
    return res.status(400).json({ error: "Missing phone or uuid" });
  }

  const chatId = pending[phone];

  if (!chatId) {
    console.warn("No pending request for phone:", phone);
    return res.status(404).json({ error: "No pending request for this phone" });
  }

  await bot.telegram.sendMessage(
    chatId,
    "✅ *UUID found!*\n\nPhone: `" + phone + "`\nUUID: `" + uuid + "`",
    { parse_mode: "Markdown" }
  );

  delete pending[phone];
  res.json({ success: true });
});

// ─── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("✅ Greenwheels bot is running.");
});

// ─── Start ─────────────────────────────────────────────────────────────────────
if (RAILWAY_URL) {
  // Webhook mode — register BEFORE app.listen
  const WEBHOOK_PATH = "/bot-webhook";
  const WEBHOOK_URL = `https://${RAILWAY_URL}${WEBHOOK_PATH}`;

  app.use(bot.webhookCallback(WEBHOOK_PATH));

  app.listen(PORT, () => {
    console.log("✅ Express server running on port " + PORT);
  });

  bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
    console.log("✅ Webhook set:", WEBHOOK_URL);
  });

  console.log("✅ Greenwheels bot running via webhook...");
} else {
  // Polling mode for local dev
  app.listen(PORT, () => {
    console.log("✅ Express server running on port " + PORT);
  });

  bot.launch();
  console.log("✅ Greenwheels bot running via polling...");

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
