require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);
const PORT = process.env.PORT || 3000;
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN;

// ─── Stores ────────────────────────────────────────────────────────────────────
const pending = {};
const userLang = {};

// ─── Strings ───────────────────────────────────────────────────────────────────
const strings = {
  en: {
    // Language
    lang_prompt: "🌍 Please select your language / Tafadhali chagua lugha yako:",
    // Main menu
    welcome: "👋 Welcome to Greenwheels!\n\nWhat would you like to do?",
    menu_bike: "🛵 Bike",
    menu_finance: "💰 Finance",
    menu_support: "🎧 Customer Support",
    back_main: "🔙 Main Menu",
    coming_soon: "🚧 This feature is coming soon. Stay tuned!",
    // Bike submenu
    bike_menu: "🛵 *Bike*\n\nWhat would you like to do?",
    bike_info: "📋 My Bike Info",
    bike_locate: "📍 Locate my Bike",
    bike_service: "🔧 Book a Service",
    // Finance submenu
    finance_menu: "💰 *Finance*\n\nWhat would you like to do?",
    finance_balance: "💳 Check my Balance",
    finance_detailed: "📊 Detailed Balance",
    finance_payment: "💸 Make a Payment",
    finance_pause: "⏸ Pause my Lease",
    // Support submenu
    support_menu: "🎧 *Customer Support*\n\nWhat would you like to do?",
    support_lease: "📅 Lease End Date",
    support_uuid: "🪪 Check my UUID",
    support_agent: "💬 Chat to Agent",
    // UUID flow
    enter_phone: "📱 Please enter your phone number:\n\n_(include country code e.g. +254712345678)_",
    invalid_phone: "⚠️ Invalid number. Try e.g. *+254712345678*",
    looking_up_uuid: "🔍 Looking up your UUID, please wait...",
    uuid_found: "✅ *UUID found!*\n\nPhone: `{phone}`\nUUID: `{uuid}`",
    uuid_not_found: "❌ *No account found*\n\nWe couldn't find a Greenwheels account linked to `{phone}`.\n\nPlease check the number and try again.",
    // Balance flow
    looking_up_balance: "🔍 Fetching your balance, please wait...",
    balance_found: "💰 *Your Balance*\n\n`{balance}`",
    balance_not_found: "❌ *No account found*\n\nWe couldn't find a balance linked to your Telegram account.",
    // Errors
    error: "⚠️ Something went wrong. Please try again.",
    system_error: "❌ Could not reach our system. Please try again.",
  },
  sw: {
    lang_prompt: "🌍 Please select your language / Tafadhali chagua lugha yako:",
    welcome: "👋 Karibu Greenwheels!\n\nUngependa kufanya nini?",
    menu_bike: "🛵 Baiskeli",
    menu_finance: "💰 Fedha",
    menu_support: "🎧 Huduma kwa Wateja",
    back_main: "🔙 Menyu Kuu",
    coming_soon: "🚧 Huduma hii inakuja hivi karibuni. Endelea kutuangalia!",
    bike_menu: "🛵 *Baiskeli*\n\nUngependa kufanya nini?",
    bike_info: "📋 Taarifa za Baiskeli yangu",
    bike_locate: "📍 Pata Baiskeli yangu",
    bike_service: "🔧 Panga Huduma",
    finance_menu: "💰 *Fedha*\n\nUngependa kufanya nini?",
    finance_balance: "💳 Angalia Salio langu",
    finance_detailed: "📊 Salio la Kina",
    finance_payment: "💸 Fanya Malipo",
    finance_pause: "⏸ Simamisha Kukodisha kwangu",
    support_menu: "🎧 *Huduma kwa Wateja*\n\nUngependa kufanya nini?",
    support_lease: "📅 Tarehe ya Mwisho wa Kukodisha",
    support_uuid: "🪪 Angalia UUID yangu",
    support_agent: "💬 Zungumza na Wakala",
    enter_phone: "📱 Tafadhali ingiza nambari yako ya simu:\n\n_(jumuisha nambari ya nchi mfano +254712345678)_",
    invalid_phone: "⚠️ Nambari si sahihi. Jaribu mfano *+254712345678*",
    looking_up_uuid: "🔍 Inatafuta UUID yako, tafadhali subiri...",
    uuid_found: "✅ *UUID imepatikana!*\n\nSimu: `{phone}`\nUUID: `{uuid}`",
    uuid_not_found: "❌ *Akaunti haikupatikana*\n\nHaikupata akaunti ya Greenwheels inayohusiana na `{phone}`.\n\nTafadhali angalia nambari na ujaribu tena.",
    looking_up_balance: "🔍 Inapata salio lako, tafadhali subiri...",
    balance_found: "💰 *Salio Lako*\n\n`{balance}`",
    balance_not_found: "❌ *Akaunti haikupatikana*\n\nHaikupata salio linalohusiana na akaunti yako ya Telegram.",
    error: "⚠️ Kuna hitilafu. Tafadhali jaribu tena.",
    system_error: "❌ Imeshindwa kufikia mfumo wetu. Tafadhali jaribu tena.",
  },
};

function t(userId, key, vars = {}) {
  const lang = userLang[userId] || "en";
  let str = strings[lang][key] || strings.en[key];
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

// ─── Language selection ────────────────────────────────────────────────────────
function showLangMenu(ctx) {
  ctx.reply(
    strings.en.lang_prompt,
    Markup.inlineKeyboard([
      [Markup.button.callback("🇬🇧 English", "lang_en")],
      [Markup.button.callback("🇰🇪 Kiswahili", "lang_sw")],
    ])
  );
}

// ─── Main menu ─────────────────────────────────────────────────────────────────
function showMainMenu(ctx) {
  const id = ctx.from.id;
  ctx.reply(
    t(id, "welcome"),
    Markup.inlineKeyboard([
      [Markup.button.callback(t(id, "menu_bike"), "menu_bike")],
      [Markup.button.callback(t(id, "menu_finance"), "menu_finance")],
      [Markup.button.callback(t(id, "menu_support"), "menu_support")],
    ])
  );
}

// ─── Submenus ──────────────────────────────────────────────────────────────────
function showBikeMenu(ctx) {
  const id = ctx.from.id;
  ctx.reply(
    t(id, "bike_menu"),
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t(id, "bike_info"), "bike_info")],
        [Markup.button.callback(t(id, "bike_locate"), "bike_locate")],
        [Markup.button.callback(t(id, "bike_service"), "bike_service")],
        [Markup.button.callback(t(id, "back_main"), "main_menu")],
      ]),
    }
  );
}

function showFinanceMenu(ctx) {
  const id = ctx.from.id;
  ctx.reply(
    t(id, "finance_menu"),
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t(id, "finance_balance"), "check_balance")],
        [Markup.button.callback(t(id, "finance_detailed"), "finance_detailed")],
        [Markup.button.callback(t(id, "finance_payment"), "finance_payment")],
        [Markup.button.callback(t(id, "finance_pause"), "finance_pause")],
        [Markup.button.callback(t(id, "back_main"), "main_menu")],
      ]),
    }
  );
}

function showSupportMenu(ctx) {
  const id = ctx.from.id;
  ctx.reply(
    t(id, "support_menu"),
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t(id, "support_lease"), "support_lease")],
        [Markup.button.callback(t(id, "support_uuid"), "get_uuid")],
        [Markup.button.callback(t(id, "support_agent"), "support_agent")],
        [Markup.button.callback(t(id, "back_main"), "main_menu")],
      ]),
    }
  );
}

// ─── Triggers: /start, hello, start, menu ─────────────────────────────────────
bot.start((ctx) => {
  console.log("✅ /start from", ctx.from.id);
  showLangMenu(ctx);
});

bot.hears(/^(hello|start|menu|hi)$/i, (ctx) => {
  console.log("✅ Text trigger from", ctx.from.id);
  showLangMenu(ctx);
});

// ─── Language actions ──────────────────────────────────────────────────────────
bot.action("lang_en", (ctx) => {
  userLang[ctx.from.id] = "en";
  ctx.answerCbQuery();
  showMainMenu(ctx);
});

bot.action("lang_sw", (ctx) => {
  userLang[ctx.from.id] = "sw";
  ctx.answerCbQuery();
  showMainMenu(ctx);
});

// ─── Main menu actions ─────────────────────────────────────────────────────────
bot.action("main_menu", (ctx) => {
  ctx.answerCbQuery();
  showMainMenu(ctx);
});

bot.action("menu_bike", (ctx) => {
  ctx.answerCbQuery();
  showBikeMenu(ctx);
});

bot.action("menu_finance", (ctx) => {
  ctx.answerCbQuery();
  showFinanceMenu(ctx);
});

bot.action("menu_support", (ctx) => {
  ctx.answerCbQuery();
  showSupportMenu(ctx);
});

// ─── Dummy actions (coming soon) ───────────────────────────────────────────────
const dummyActions = ["bike_info", "bike_locate", "bike_service", "finance_detailed", "finance_payment", "finance_pause", "support_lease", "support_agent"];
dummyActions.forEach((action) => {
  bot.action(action, (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(t(ctx.from.id, "coming_soon"));
  });
});

// ─── Get UUID flow ─────────────────────────────────────────────────────────────
bot.action("get_uuid", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply(t(ctx.from.id, "enter_phone"), { parse_mode: "Markdown" });
});

// ─── Check balance flow ────────────────────────────────────────────────────────
bot.action("check_balance", (ctx) => {
  ctx.answerCbQuery();
  const telegramId = ctx.from.id;
  const chatId = ctx.chat.id;

  pending["balance_" + telegramId] = chatId;
  ctx.reply(t(telegramId, "looking_up_balance"));

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
      bot.telegram.sendMessage(chatId, t(telegramId, "system_error"));
      delete pending["balance_" + telegramId];
    });
});

// ─── Text handler (phone number input) ────────────────────────────────────────
bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return;
  if (/^(hello|start|menu|hi)$/i.test(text)) return;

  if (!/^\+?[\d\s\-]{7,15}$/.test(text)) {
    ctx.reply(t(ctx.from.id, "invalid_phone"), { parse_mode: "Markdown" });
    return;
  }

  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  pending[text] = chatId;
  await ctx.reply(t(userId, "looking_up_uuid"));

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
    ctx.reply(t(userId, "system_error"));
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

  const lang = userLang[chatId] || "en";

  if (status === "not_found") {
    await bot.telegram.sendMessage(
      chatId,
      strings[lang].uuid_not_found.replace("{phone}", phone),
      { parse_mode: "Markdown" }
    );
  } else if (uuid) {
    await bot.telegram.sendMessage(
      chatId,
      strings[lang].uuid_found.replace("{phone}", phone).replace("{uuid}", uuid),
      { parse_mode: "Markdown" }
    );
  } else {
    await bot.telegram.sendMessage(chatId, strings[lang].error);
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

  const lang = userLang[telegram_id] || "en";

  if (status === "not_found") {
    await bot.telegram.sendMessage(chatId, strings[lang].balance_not_found, { parse_mode: "Markdown" });
  } else if (balance !== undefined) {
    await bot.telegram.sendMessage(
      chatId,
      strings[lang].balance_found.replace("{balance}", balance),
      { parse_mode: "Markdown" }
    );
  } else {
    await bot.telegram.sendMessage(chatId, strings[lang].error);
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
