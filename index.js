require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const express = require("express");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);
const PORT = process.env.PORT || 3000;
const RAILWAY_URL = process.env.RAILWAY_PUBLIC_DOMAIN;

// ─── Stores ────────────────────────────────────────────────────────────────────
const pending = {};
const userAIHistory = {}; // conversation history for AI chat

// ─── Persist language ──────────────────────────────────────────────────────────
const LANG_FILE = "/tmp/userLang.json";

function loadLangs() {
  try {
    if (fs.existsSync(LANG_FILE)) return JSON.parse(fs.readFileSync(LANG_FILE, "utf8"));
  } catch (e) { console.error("Failed to load lang file:", e); }
  return {};
}
function saveLangs(langs) {
  try { fs.writeFileSync(LANG_FILE, JSON.stringify(langs)); }
  catch (e) { console.error("Failed to save lang file:", e); }
}
const userLang = loadLangs();
function setLang(userId, lang) { userLang[userId] = lang; saveLangs(userLang); }

// ─── User state (tracks what flow user is in) ──────────────────────────────────
const userState = {}; // e.g. { 123: "performance_ai" }

// ─── Strings ───────────────────────────────────────────────────────────────────
const strings = {
  en: {
    lang_prompt: "🌍 Please select your language / Tafadhali chagua lugha yako:",
    welcome: "👋 Welcome to Greenwheels!\n\nWhat would you like to do?",
    menu_bike: "🛵 Bike",
    menu_finance: "💰 Finance",
    menu_support: "🎧 Customer Support",
    menu_performance: "📊 Performance",
    menu_settings: "⚙️ Settings",
    back_main: "🔙 Main Menu",
    coming_soon: "🚧 This feature is coming soon. Stay tuned!",
    // Bike
    bike_menu: "🛵 *Bike*\n\nWhat would you like to do?",
    bike_info: "📋 My Bike Info",
    bike_locate: "📍 Locate my Bike",
    bike_service: "🔧 Book a Service",
    bike_battery: "🔋 Battery Health",
    bike_history: "🗺 Trip History",
    // Finance
    finance_menu: "💰 *Finance*\n\nWhat would you like to do?",
    finance_balance: "💳 Check my Balance",
    finance_detailed: "📊 Detailed Balance",
    finance_payment: "💸 Make a Payment",
    finance_pause: "⏸ Pause my Lease",
    finance_history: "🧾 Payment History",
    // Performance
    performance_menu: "📊 *Performance*\n\nWhat would you like to do?",
    performance_ai: "🤖 Chat with AI Coach",
    performance_summary: "📈 Weekly Summary",
    performance_safety: "🦺 Safety Score",
    performance_earnings: "💵 Earnings Tracker",
    // Support
    support_menu: "🎧 *Customer Support*\n\nWhat would you like to do?",
    support_lease: "📅 Lease End Date",
    support_uuid: "🪪 Check my UUID",
    support_agent: "💬 Chat to Agent",
    support_sos: "🆘 Emergency SOS",
    support_incident: "⚠️ Report an Incident",
    // Settings
    settings_menu: "⚙️ *Settings*\n\nWhat would you like to change?",
    settings_language: "🌍 Change Language",
    settings_notifications: "🔔 Notification Preferences",
    settings_phone: "📱 Update Phone Number",
    lang_changed_en: "✅ Language changed to English.",
    lang_changed_sw: "✅ Lugha imebadilishwa kuwa Kiswahili.",
    // UUID
    enter_phone: "📱 Please enter your phone number:\n\n_(include country code e.g. +254712345678)_",
    invalid_phone: "⚠️ Invalid number. Try e.g. *+254712345678*",
    looking_up_uuid: "🔍 Looking up your UUID, please wait...",
    uuid_found: "✅ *UUID found!*\n\nPhone: `{phone}`\nUUID: `{uuid}`",
    uuid_not_found: "❌ *No account found*\n\nWe couldn't find a Greenwheels account linked to `{phone}`.\n\nPlease check the number and try again.",
    // Balance
    looking_up_balance: "🔍 Fetching your balance, please wait...",
    balance_found: "💰 *Your Balance*\n\n`{balance}`",
    balance_not_found: "❌ *No account found*\n\nWe couldn't find a balance linked to your Telegram account.",
    // AI
    ai_intro: "🤖 *Greenwheels AI Performance Coach*\n\nHi! I'm your personal coach. Ask me anything about your trips, earnings, safety, battery, or maintenance.\n\nType *exit* or tap the button below to leave.\n\n_What would you like to know?_",
    ai_exit: "👋 Exiting AI Coach. Type *menu* to return to the main menu.",
    ai_exit_btn: "🚪 Exit AI Coach",
    ai_thinking: "🤔 Thinking...",
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
    menu_performance: "📊 Utendaji",
    menu_settings: "⚙️ Mipangilio",
    back_main: "🔙 Menyu Kuu",
    coming_soon: "🚧 Huduma hii inakuja hivi karibuni!",
    bike_menu: "🛵 *Baiskeli*\n\nUngependa kufanya nini?",
    bike_info: "📋 Taarifa za Baiskeli yangu",
    bike_locate: "📍 Pata Baiskeli yangu",
    bike_service: "🔧 Panga Huduma",
    bike_battery: "🔋 Hali ya Betri",
    bike_history: "🗺 Historia ya Safari",
    finance_menu: "💰 *Fedha*\n\nUngependa kufanya nini?",
    finance_balance: "💳 Angalia Salio langu",
    finance_detailed: "📊 Salio la Kina",
    finance_payment: "💸 Fanya Malipo",
    finance_pause: "⏸ Simamisha Kukodisha kwangu",
    finance_history: "🧾 Historia ya Malipo",
    performance_menu: "📊 *Utendaji*\n\nUngependa kufanya nini?",
    performance_ai: "🤖 Zungumza na Kocha wa AI",
    performance_summary: "📈 Muhtasari wa Wiki",
    performance_safety: "🦺 Alama ya Usalama",
    performance_earnings: "💵 Kufuatilia Mapato",
    support_menu: "🎧 *Huduma kwa Wateja*\n\nUngependa kufanya nini?",
    support_lease: "📅 Tarehe ya Mwisho wa Kukodisha",
    support_uuid: "🪪 Angalia UUID yangu",
    support_agent: "💬 Zungumza na Wakala",
    support_sos: "🆘 Msaada wa Dharura",
    support_incident: "⚠️ Ripoti Tukio",
    settings_menu: "⚙️ *Mipangilio*\n\nUngependa kubadilisha nini?",
    settings_language: "🌍 Badilisha Lugha",
    settings_notifications: "🔔 Mapendeleo ya Arifa",
    settings_phone: "📱 Sasisha Nambari ya Simu",
    lang_changed_en: "✅ Language changed to English.",
    lang_changed_sw: "✅ Lugha imebadilishwa kuwa Kiswahili.",
    enter_phone: "📱 Tafadhali ingiza nambari yako ya simu:\n\n_(jumuisha nambari ya nchi mfano +254712345678)_",
    invalid_phone: "⚠️ Nambari si sahihi. Jaribu mfano *+254712345678*",
    looking_up_uuid: "🔍 Inatafuta UUID yako, tafadhali subiri...",
    uuid_found: "✅ *UUID imepatikana!*\n\nSimu: `{phone}`\nUUID: `{uuid}`",
    uuid_not_found: "❌ *Akaunti haikupatikana*\n\nHaikupata akaunti ya Greenwheels inayohusiana na `{phone}`.\n\nTafadhali angalia nambari na ujaribu tena.",
    looking_up_balance: "🔍 Inapata salio lako, tafadhali subiri...",
    balance_found: "💰 *Salio Lako*\n\n`{balance}`",
    balance_not_found: "❌ *Akaunti haikupatikana*\n\nHaikupata salio linalohusiana na akaunti yako ya Telegram.",
    ai_intro: "🤖 *Kocha wa Utendaji wa Greenwheels AI*\n\nHabari! Mimi ni kocha wako binafsi. Niulize chochote kuhusu safari zako, mapato, usalama, betri, au matengenezo.\n\nAndika *toka* au bonyeza kitufe hapa chini kutoka.\n\n_Ungependa kujua nini?_",
    ai_exit: "👋 Umetoka kwa Kocha wa AI. Andika *menu* kurudi kwenye menyu kuu.",
    ai_exit_btn: "🚪 Toka kwa Kocha wa AI",
    ai_thinking: "🤔 Inafikiri...",
    error: "⚠️ Kuna hitilafu. Tafadhali jaribu tena.",
    system_error: "❌ Imeshindwa kufikia mfumo wetu. Tafadhali jaribu tena.",
  },
};

function t(userId, key, vars = {}) {
  const lang = userLang[userId] || "en";
  let str = strings[lang][key] || strings.en[key];
  for (const [k, v] of Object.entries(vars)) str = str.replace(`{${k}}`, v);
  return str;
}

// ─── Menus ─────────────────────────────────────────────────────────────────────
function showLangMenu(ctx) {
  ctx.reply(strings.en.lang_prompt, Markup.inlineKeyboard([
    [Markup.button.callback("🇬🇧 English", "lang_en")],
    [Markup.button.callback("🇰🇪 Kiswahili", "lang_sw")],
  ]));
}

function showMainMenu(ctx) {
  const id = ctx.from.id;
  ctx.reply(t(id, "welcome"), Markup.inlineKeyboard([
    [Markup.button.callback(t(id, "menu_bike"), "menu_bike")],
    [Markup.button.callback(t(id, "menu_finance"), "menu_finance")],
    [Markup.button.callback(t(id, "menu_performance"), "menu_performance")],
    [Markup.button.callback(t(id, "menu_support"), "menu_support")],
    [Markup.button.callback(t(id, "menu_settings"), "menu_settings")],
  ]));
}

function showBikeMenu(ctx) {
  const id = ctx.from.id;
  ctx.reply(t(id, "bike_menu"), { parse_mode: "Markdown", ...Markup.inlineKeyboard([
    [Markup.button.callback(t(id, "bike_info"), "bike_info"), Markup.button.callback(t(id, "bike_battery"), "bike_battery")],
    [Markup.button.callback(t(id, "bike_locate"), "bike_locate"), Markup.button.callback(t(id, "bike_history"), "bike_history")],
    [Markup.button.callback(t(id, "bike_service"), "bike_service")],
    [Markup.button.callback(t(id, "back_main"), "main_menu")],
  ])});
}

function showFinanceMenu(ctx) {
  const id = ctx.from.id;
  ctx.reply(t(id, "finance_menu"), { parse_mode: "Markdown", ...Markup.inlineKeyboard([
    [Markup.button.callback(t(id, "finance_balance"), "check_balance")],
    [Markup.button.callback(t(id, "finance_detailed"), "finance_detailed"), Markup.button.callback(t(id, "finance_history"), "finance_history")],
    [Markup.button.callback(t(id, "finance_payment"), "finance_payment"), Markup.button.callback(t(id, "finance_pause"), "finance_pause")],
    [Markup.button.callback(t(id, "back_main"), "main_menu")],
  ])});
}

function showPerformanceMenu(ctx) {
  const id = ctx.from.id;
  ctx.reply(t(id, "performance_menu"), { parse_mode: "Markdown", ...Markup.inlineKeyboard([
    [Markup.button.callback(t(id, "performance_ai"), "performance_ai")],
    [Markup.button.callback(t(id, "performance_summary"), "performance_summary"), Markup.button.callback(t(id, "performance_safety"), "performance_safety")],
    [Markup.button.callback(t(id, "performance_earnings"), "performance_earnings")],
    [Markup.button.callback(t(id, "back_main"), "main_menu")],
  ])});
}

function showSupportMenu(ctx) {
  const id = ctx.from.id;
  ctx.reply(t(id, "support_menu"), { parse_mode: "Markdown", ...Markup.inlineKeyboard([
    [Markup.button.callback(t(id, "support_sos"), "support_sos"), Markup.button.callback(t(id, "support_incident"), "support_incident")],
    [Markup.button.callback(t(id, "support_lease"), "support_lease"), Markup.button.callback(t(id, "support_uuid"), "get_uuid")],
    [Markup.button.callback(t(id, "support_agent"), "support_agent")],
    [Markup.button.callback(t(id, "back_main"), "main_menu")],
  ])});
}

function showSettingsMenu(ctx) {
  const id = ctx.from.id;
  ctx.reply(t(id, "settings_menu"), { parse_mode: "Markdown", ...Markup.inlineKeyboard([
    [Markup.button.callback(t(id, "settings_language"), "settings_language")],
    [Markup.button.callback(t(id, "settings_notifications"), "settings_notifications"), Markup.button.callback(t(id, "settings_phone"), "settings_phone")],
    [Markup.button.callback(t(id, "back_main"), "main_menu")],
  ])});
}

// ─── Start triggers ────────────────────────────────────────────────────────────
function handleStart(ctx) {
  const id = ctx.from.id;
  userState[id] = null; // clear any active AI session
  if (userLang[id]) { showMainMenu(ctx); } else { showLangMenu(ctx); }
}

bot.start((ctx) => handleStart(ctx));
bot.hears(/^(hello|start|menu|hi)$/i, (ctx) => handleStart(ctx));

// ─── Language actions ──────────────────────────────────────────────────────────
bot.action("lang_en", (ctx) => { setLang(ctx.from.id, "en"); ctx.answerCbQuery(); showMainMenu(ctx); });
bot.action("lang_sw", (ctx) => { setLang(ctx.from.id, "sw"); ctx.answerCbQuery(); showMainMenu(ctx); });

// Change language from settings
bot.action("settings_language", (ctx) => {
  ctx.answerCbQuery();
  showLangMenu(ctx);
});

// ─── Nav actions ───────────────────────────────────────────────────────────────
bot.action("main_menu", (ctx) => { ctx.answerCbQuery(); userState[ctx.from.id] = null; showMainMenu(ctx); });
bot.action("menu_bike", (ctx) => { ctx.answerCbQuery(); showBikeMenu(ctx); });
bot.action("menu_finance", (ctx) => { ctx.answerCbQuery(); showFinanceMenu(ctx); });
bot.action("menu_performance", (ctx) => { ctx.answerCbQuery(); showPerformanceMenu(ctx); });
bot.action("menu_support", (ctx) => { ctx.answerCbQuery(); showSupportMenu(ctx); });
bot.action("menu_settings", (ctx) => { ctx.answerCbQuery(); showSettingsMenu(ctx); });

// ─── Performance AI ────────────────────────────────────────────────────────────
bot.action("performance_ai", (ctx) => {
  ctx.answerCbQuery();
  const id = ctx.from.id;
  userState[id] = "performance_ai";
  userAIHistory[id] = []; // reset conversation
  ctx.reply(t(id, "ai_intro"), {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([[Markup.button.callback(t(id, "ai_exit_btn"), "exit_ai")]]),
  });
});

bot.action("exit_ai", (ctx) => {
  ctx.answerCbQuery();
  const id = ctx.from.id;
  userState[id] = null;
  userAIHistory[id] = [];
  ctx.reply(t(id, "ai_exit"), { parse_mode: "Markdown" });
});

// ─── Dummy actions ─────────────────────────────────────────────────────────────
const dummyActions = [
  "bike_info", "bike_locate", "bike_service", "bike_battery", "bike_history",
  "finance_detailed", "finance_payment", "finance_pause", "finance_history",
  "performance_summary", "performance_safety", "performance_earnings",
  "support_lease", "support_agent", "support_sos", "support_incident",
  "settings_notifications", "settings_phone",
];
dummyActions.forEach((action) => {
  bot.action(action, (ctx) => { ctx.answerCbQuery(); ctx.reply(t(ctx.from.id, "coming_soon")); });
});

// ─── Get UUID ──────────────────────────────────────────────────────────────────
bot.action("get_uuid", (ctx) => {
  ctx.answerCbQuery();
  ctx.reply(t(ctx.from.id, "enter_phone"), { parse_mode: "Markdown" });
});

// ─── Check balance ─────────────────────────────────────────────────────────────
bot.action("check_balance", (ctx) => {
  ctx.answerCbQuery();
  const telegramId = ctx.from.id;
  const chatId = ctx.chat.id;
  pending["balance_" + telegramId] = chatId;
  ctx.reply(t(telegramId, "looking_up_balance"));
  fetch("https://hooks.zapier.com/hooks/catch/15146927/un127yd/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telegram_id: telegramId, callback_url: `https://${RAILWAY_URL}/balance-callback` }),
  }).then((r) => r.text()).then((body) => console.log("Balance Zapier:", body))
    .catch((err) => { console.error("Balance error:", err); bot.telegram.sendMessage(chatId, t(telegramId, "system_error")); delete pending["balance_" + telegramId]; });
});

// ─── Text handler ──────────────────────────────────────────────────────────────
bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;

  if (text.startsWith("/")) return;
  if (/^(hello|start|menu|hi)$/i.test(text)) return;

  // ── AI performance chat ──
  if (userState[userId] === "performance_ai") {
    if (/^(exit|toka)$/i.test(text)) {
      userState[userId] = null;
      userAIHistory[userId] = [];
      ctx.reply(t(userId, "ai_exit"), { parse_mode: "Markdown" });
      return;
    }

    const thinking = await ctx.reply(t(userId, "ai_thinking"));

    // Build conversation history
    if (!userAIHistory[userId]) userAIHistory[userId] = [];
    userAIHistory[userId].push({ role: "user", content: text });

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: `You are a performance coach for Greenwheels, a two-wheel electric vehicle fleet operator in Nairobi, Kenya. You help motorcycle (boda boda) riders improve their performance. You have expertise in:
- Trip performance and earnings optimisation (peak hours in Nairobi, best routes, daily/weekly targets)
- Safety coaching (safe riding, accident prevention, Nairobi traffic)
- Battery and range management (charging habits, range anxiety, efficiency tips)
- Maintenance compliance (service schedules, what to check before a ride)

Keep responses concise, practical, and encouraging. Use simple language. If asked about specific data (e.g. exact earnings, trip count), explain that live data integration is coming soon but give general coaching advice. Respond in ${userLang[userId] === "sw" ? "Swahili" : "English"}.`,
          messages: userAIHistory[userId],
        }),
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || t(userId, "error");

      // Add assistant reply to history (keep last 10 messages)
      userAIHistory[userId].push({ role: "assistant", content: reply });
      if (userAIHistory[userId].length > 10) userAIHistory[userId] = userAIHistory[userId].slice(-10);

      await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});
      ctx.reply(reply, {
        ...Markup.inlineKeyboard([[Markup.button.callback(t(userId, "ai_exit_btn"), "exit_ai")]]),
      });
    } catch (err) {
      console.error("AI error:", err);
      await ctx.telegram.deleteMessage(ctx.chat.id, thinking.message_id).catch(() => {});
      ctx.reply(t(userId, "error"));
    }
    return;
  }

  // ── Phone number input (UUID lookup) ──
  if (!/^\+?[\d\s\-]{7,15}$/.test(text)) {
    ctx.reply(t(userId, "invalid_phone"), { parse_mode: "Markdown" });
    return;
  }

  const chatId = ctx.chat.id;
  pending[text] = chatId;
  await ctx.reply(t(userId, "looking_up_uuid"));

  try {
    const zapRes = await fetch("https://hooks.zapier.com/hooks/catch/15146927/unmxgq5/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: text, callback_url: `https://${RAILWAY_URL}/zapier-callback` }),
    });
    console.log("UUID Zapier status:", zapRes.status);
  } catch (err) {
    console.error("Zapier error:", err);
    ctx.reply(t(userId, "system_error"));
    delete pending[text];
  }
});

// ─── Express ───────────────────────────────────────────────────────────────────
const app = express();

app.use((req, res, next) => { console.log(`📥 ${req.method} ${req.path}`); next(); });

const WEBHOOK_PATH = "/bot-webhook";
app.use(WEBHOOK_PATH, express.json(), (req, res) => { bot.handleUpdate(req.body, res); });
app.use(express.json());

app.post("/zapier-callback", async (req, res) => {
  const { phone, uuid, status } = req.body;
  if (!phone) return res.status(400).json({ error: "Missing phone" });
  const chatId = pending[phone];
  if (!chatId) return res.status(404).json({ error: "No pending request" });
  const lang = userLang[chatId] || "en";
  if (status === "not_found") {
    await bot.telegram.sendMessage(chatId, strings[lang].uuid_not_found.replace("{phone}", phone), { parse_mode: "Markdown" });
  } else if (uuid) {
    await bot.telegram.sendMessage(chatId, strings[lang].uuid_found.replace("{phone}", phone).replace("{uuid}", uuid), { parse_mode: "Markdown" });
  } else {
    await bot.telegram.sendMessage(chatId, strings[lang].error);
  }
  delete pending[phone];
  res.json({ success: true });
});

app.post("/balance-callback", async (req, res) => {
  const { telegram_id, balance, status } = req.body;
  if (!telegram_id) return res.status(400).json({ error: "Missing telegram_id" });
  const chatId = pending["balance_" + telegram_id];
  if (!chatId) return res.status(404).json({ error: "No pending request" });
  const lang = userLang[telegram_id] || "en";
  if (status === "not_found") {
    await bot.telegram.sendMessage(chatId, strings[lang].balance_not_found, { parse_mode: "Markdown" });
  } else if (balance !== undefined) {
    await bot.telegram.sendMessage(chatId, strings[lang].balance_found.replace("{balance}", balance), { parse_mode: "Markdown" });
  } else {
    await bot.telegram.sendMessage(chatId, strings[lang].error);
  }
  delete pending["balance_" + telegram_id];
  res.json({ success: true });
});

app.get("/", (req, res) => res.send("✅ Greenwheels bot is running."));
app.listen(PORT, () => console.log("✅ Express running on port " + PORT));

if (RAILWAY_URL) {
  const WEBHOOK_URL = `https://${RAILWAY_URL}${WEBHOOK_PATH}`;
  bot.telegram.setWebhook(WEBHOOK_URL).then(() => console.log("✅ Webhook set:", WEBHOOK_URL));
  console.log("✅ Bot running via webhook...");
} else {
  bot.launch();
  console.log("✅ Bot running via polling...");
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}
