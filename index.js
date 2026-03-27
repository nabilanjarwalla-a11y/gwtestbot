require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

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
    await fetch("https://hooks.zapier.com/hooks/catch/15146927/unmxgq5/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: text,
        callback_url: "https://divine-appreciation-production.up.railway.app/zapier-callback",
      }),
    });
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
    "✅ *UUID found!*\n\nPhone: \`" + phone + "\`\nUUID: \`" + uuid + "\`",
    { parse_mode: "Markdown" }
  );

  delete pending[phone];
  res.json({ success: true });
});

// ─── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.send("✅ Greenwheels bot is running.");
});

// ─── Start Express + Bot ───────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("✅ Express server running on port " + PORT);
});

bot.launch();
console.log("✅ Greenwheels bot running...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

const bot = new Telegraf(process.env.BOT_TOKEN);
const SUPPORT_CHAT_ID = process.env.SUPPORT_CHAT_ID;

// ─── Session store ─────────────────────────────────────────────────────────────
const sessions = {};
function getSession(chatId) {
  if (!sessions[chatId]) sessions[chatId] = { country: null, issue: null };
  return sessions[chatId];
}
function resetSession(chatId) {
  sessions[chatId] = { country: null, issue: null };
}

// ─── Country config ────────────────────────────────────────────────────────────
const COUNTRIES = {
  kenya: {
    label: "🇰🇪 Kenya",
    currency: "KES",
    support_number: "+254 700 000 000",
    payment_methods: ["M-Pesa", "Airtel Money", "Visa/Mastercard"],
  },
  uganda: {
    label: "🇺🇬 Uganda",
    currency: "UGX",
    support_number: "+256 700 000 000",
    payment_methods: ["MTN Mobile Money", "Airtel Money", "Visa/Mastercard"],
  },
  ghana: {
    label: "🇬🇭 Ghana",
    currency: "GHS",
    support_number: "+233 200 000 000",
    payment_methods: ["MTN MoMo", "Vodafone Cash", "Visa/Mastercard"],
  },
};

// ─── Keyboards ─────────────────────────────────────────────────────────────────
const countryKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("🇰🇪 Kenya", "country_kenya")],
  [Markup.button.callback("🇺🇬 Uganda", "country_uganda")],
  [Markup.button.callback("🇬🇭 Ghana", "country_ghana")],
]);

const issueKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("💳 Incorrect charge", "issue_overcharge")],
  [Markup.button.callback("❌ Payment failed", "issue_failed")],
  [Markup.button.callback("🔁 Request a refund", "issue_refund")],
  [Markup.button.callback("📄 Need a receipt / invoice", "issue_receipt")],
  [Markup.button.callback("🔒 Account suspended", "issue_suspended")],
  [Markup.button.callback("❓ Something else", "issue_other")],
]);

const doneKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("✅ This helped — close", "close")],
  [Markup.button.callback("🙋 Speak to an agent", "escalate")],
  [Markup.button.callback("🔙 Main menu", "main_menu")],
]);

// ─── Issue responses ───────────────────────────────────────────────────────────
function getIssueResponse(issue, country) {
  const c = COUNTRIES[country];
  const methods = c.payment_methods.map((m) => `• ${m}`).join("\n");

  const responses = {
    overcharge: `💳 *Incorrect Charge*\n\nSorry to hear this happened.\n\n*Steps to resolve:*\n1. Open the Greenwheels app → *My Rides*\n2. Find the ride and note the date, time & amount charged\n3. Compare it with your booking confirmation\n\nIf there's a discrepancy, we'll investigate and refund the difference within *3–5 business days*.\n\n📞 ${c.label} support: \`${c.support_number}\``,

    failed: `❌ *Payment Failed*\n\n*Accepted payment methods in ${c.label}:*\n${methods}\n\n*Common fixes:*\n• Check your mobile money balance\n• Make sure your card hasn't expired\n• Try a different payment method\n• Confirm your number is active and