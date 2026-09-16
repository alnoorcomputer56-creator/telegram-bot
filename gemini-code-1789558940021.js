const { Bot, InlineKeyboard } = require("grammy");
const { fetch } = require("undici");
const fs = require("fs");
const path = require("path");

// --- Environment Variables ---
const BOT_TOKEN = process.env.BOT_TOKEN; 
const MASTER_ADMIN = parseInt(process.env.MASTER_ADMIN) || 6916044653; 
const OTP_GROUP_ID = process.env.OTP_GROUP_ID || "-1004463922857"; 

// --- Links ---
const OTP_GROUP_LINK = process.env.OTP_GROUP_LINK || "https://t.me/fast_otp0";     
const CHANNEL_CHAT_LINK = process.env.CHANNEL_CHAT_LINK || "https://t.me/fastotpchat"; 

if (!BOT_TOKEN) {
    console.error("CRITICAL ERROR: BOT_TOKEN is missing in Environment Variables!");
    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
const DB_FILE = path.join(__dirname, "bot_database.json");

let activeOtpCheckers = {};
let botInfo = null;
let adminState = {}; 
let userState = {};
let userActiveMessages = {}; 

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
    .replace(/&/g, "&")
    .replace(//g, ">")
    .replace(/"/g, """);
}

function getCountryFlag(countryName) {
    if (!countryName) return "🌐";
    
    const match = countryName.match(/\(([A-Z]{2})\)/);
    let isoCode = match ? match[1] : null;

    if (!isoCode) {
        const found = COUNTRY_DIAL_CODES.find(c => countryName.toLowerCase().includes(c.name.toLowerCase()));
        if (found) isoCode = found.iso;
    }

    if (isoCode && isoCode.length === 2) {
        const codePoints = isoCode
            .toUpperCase()
            .split('')
            .map(char => 127397 + char.charCodeAt(0));
        return String.fromCodePoint(...codePoints);
    }

    return "🌐";
}

const COUNTRY_DIAL_CODES = [
    { name: "Afghanistan", iso: "AF", code: "93" },
    { name: "Albania", iso: "AL", code: "355" },
    { name: "Algeria", iso: "DZ", code: "213" },
    { name: "Andorra", iso: "AD", code: "376" },
    { name: "Angola", iso: "AO", code: "244" },
    { name: "Argentina", iso: "AR", code: "54" },
    { name: "Armenia", iso: "AM", code: "374" },
    { name: "Australia", iso: "AU", code: "61" },
    { name: "Austria", iso: "AT", code: "43" },
    { name: "Azerbaijan", iso: "AZ", code: "994" },
    { name: "Bahrain", iso: "BH", code: "973" },
    { name: "Bangladesh", iso: "BD", code: "880" },
    { name: "Belarus", iso: "BY", code: "375" },
    { name: "Belgium", iso: "BE", code: "32" },
    { name: "Belize", iso: "BZ", code: "501" },
    { name: "Benin", iso: "BJ", code: "229" },
    { name: "Bhutan", iso: "BT", code: "975" },
    { name: "Bolivia", iso: "BO", code: "591" },
    { name: "Bosnia and Herzegovina", iso: "BA", code: "387" },
    { name: "Botswana", iso: "BW", code: "267" },
    { name: "Brazil", iso: "BR", code: "55" },
    { name: "Brunei", iso: "BN", code: "673" },
    { name: "Bulgaria", iso: "BG", code: "359" },
    { name: "Burkina Faso", iso: "BF", code: "226" },
    { name: "Burundi", iso: "BI", code: "257" },
    { name: "Cambodia", iso: "KH", code: "855" },
    { name: "Cameroon", iso: "CM", code: "237" },
    { name: "Canada", iso: "CA", code: "1" },
    { name: "Chad", iso: "TD", code: "235" },
    { name: "Chile", iso: "CL", code: "56" },
    { name: "China", iso: "CN", code: "86" },
    { name: "Colombia", iso: "CO", code: "57" },
    { name: "Costa Rica", iso: "CR", code: "506" },
    { name: "Croatia", iso: "HR", code: "385" },
    { name: "Cuba", iso: "CU", code: "53" },
    { name: "Cyprus", iso: "CY", code: "357" },
    { name: "Czech Republic", iso: "CZ", code: "420" },
    { name: "Denmark", iso: "DK", code: "45" },
    { name: "Ecuador", iso: "EC", code: "593" },
    { name: "Egypt", iso: "EG", code: "20" },
    { name: "El Salvador", iso: "SV", code: "503" },
    { name: "Estonia", iso: "EE", code: "372" },
    { name: "Ethiopia", iso: "ET", code: "251" },
    { name: "Finland", iso: "FI", code: "358" },
    { name: "France", iso: "FR", code: "33" },
    { name: "Georgia", iso: "GE", code: "995" },
    { name: "Germany", iso: "DE", code: "49" },
    { name: "Ghana", iso: "GH", code: "233" },
    { name: "Greece", iso: "GR", code: "30" },
    { name: "Guatemala", iso: "GT", code: "502" },
    { name: "Haiti", iso: "HT", code: "509" },
    { name: "Honduras", iso: "HN", code: "504" },
    { name: "Hong Kong", iso: "HK", code: "852" },
    { name: "Hungary", iso: "HU", code: "36" },
    { name: "Iceland", iso: "IS", code: "354" },
    { name: "India", iso: "IN", code: "91" },
    { name: "Indonesia", iso: "ID", code: "62" },
    { name: "Iran", iso: "IR", code: "98" },
    { name: "Iraq", iso: "IQ", code: "964" },
    { name: "Ireland", iso: "IE", code: "353" },
    { name: "Israel", iso: "IL", code: "972" },
    { name: "Italy", iso: "IT", code: "39" },
    { name: "Jamaica", iso: "JM", code: "1" },
    { name: "Japan", iso: "JP", code: "81" },
    { name: "Jordan", iso: "JO", code: "962" },
    { name: "Kazakhstan", iso: "KZ", code: "7" },
    { name: "Kenya", iso: "KE", code: "254" },
    { name: "Kuwait", iso: "KW", code: "965" },
    { name: "Kyrgyzstan", iso: "KG", code: "996" },
    { name: "Laos", iso: "LA", code: "856" },
    { name: "Latvia", iso: "LV", code: "371" },
    { name: "Lebanon", iso: "LB", code: "961" },
    { name: "Libya", iso: "LY", code: "218" },
    { name: "Lithuania", iso: "LT", code: "370" },
    { name: "Luxembourg", iso: "LU", code: "352" },
    { name: "Macau", iso: "MO", code: "853" },
    { name: "Macedonia", iso: "MK", code: "389" },
    { name: "Madagascar", iso: "MG", code: "261" },
    { name: "Malaysia", iso: "MY", code: "60" },
    { name: "Maldives", iso: "MV", code: "960" },
    { name: "Mali", iso: "ML", code: "223" },
    { name: "Malta", iso: "MT", code: "356" },
    { name: "Mexico", iso: "MX", code: "52" },
    { name: "Moldova", iso: "MD", code: "373" },
    { name: "Monaco", iso: "MC", code: "377" },
    { name: "Mongolia", iso: "MN", code: "976" },
    { name: "Montenegro", iso: "ME", code: "382" },
    { name: "Morocco", iso: "MA", code: "212" },
    { name: "Mozambique", iso: "MZ", code: "258" },
    { name: "Myanmar", iso: "MM", code: "95" },
    { name: "Namibia", iso: "NA", code: "264" },
    { name: "Nepal", iso: "NP", code: "977" },
    { name: "Netherlands", iso: "NL", code: "31" },
    { name: "New Zealand", iso: "NZ", code: "64" },
    { name: "Nicaragua", iso: "NI", code: "505" },
    { name: "Niger", iso: "NE", code: "227" },
    { name: "Nigeria", iso: "NG", code: "234" },
    { name: "North Korea", iso: "KP", code: "850" },
    { name: "Norway", iso: "NO", code: "47" },
    { name: "Oman", iso: "OM", code: "968" },
    { name: "Pakistan", iso: "PK", code: "92" },
    { name: "Palestine", iso: "PS", code: "970" },
    { name: "Panama", iso: "PA", code: "507" },
    { name: "Paraguay", iso: "PY", code: "595" },
    { name: "Peru", iso: "PE", code: "51" },
    { name: "Philippines", iso: "PH", code: "63" },
    { name: "Poland", iso: "PL", code: "48" },
    { name: "Portugal", iso: "PT", code: "351" },
    { name: "Qatar", iso: "QA", code: "974" },
    { name: "Romania", iso: "RO", code: "40" },
    { name: "Russia", iso: "RU", code: "7" },
    { name: "Rwanda", iso: "RW", code: "250" },
    { name: "Saudi Arabia", iso: "SA", code: "966" },
    { name: "Senegal", iso: "SN", code: "221" },
    { name: "Serbia", iso: "RS", code: "381" },
    { name: "Singapore", iso: "SG", code: "65" },
    { name: "Slovakia", iso: "SK", code: "421" },
    { name: "Slovenia", iso: "SI", code: "386" },
    { name: "Somalia", iso: "SO", code: "252" },
    { name: "South Africa", iso: "ZA", code: "27" },
    { name: "South Korea", iso: "KR", code: "82" },
    { name: "Spain", iso: "ES", code: "34" },
    { name: "Sri Lanka", iso: "LK", code: "94" },
    { name: "Sudan", iso: "SD", code: "249" },
    { name: "Sweden", iso: "SE", code: "46" },
    { name: "Switzerland", iso: "CH", code: "41" },
    { name: "Syria", iso: "SY", code: "963" },
    { name: "Taiwan", iso: "TW", code: "886" },
    { name: "Tajikistan", iso: "TJ", code: "992" },
    { name: "Tanzania", iso: "TZ", code: "255" },
    { name: "Thailand", iso: "TH", code: "66" },
    { name: "Tunisia", iso: "TN", code: "216" },
    { name: "Turkey", iso: "TR", code: "90" },
    { name: "Turkmenistan", iso: "TM", code: "993" },
    { name: "Uganda", iso: "UG", code: "256" },
    { name: "Ukraine", iso: "UA", code: "380" },
    { name: "United Arab Emirates", iso: "AE", code: "971" },
    { name: "United Kingdom", iso: "GB", code: "44" },
    { name: "United States", iso: "US", code: "1" },
    { name: "Uruguay", iso: "UY", code: "598" },
    { name: "Uzbekistan", iso: "UZ", code: "998" },
    { name: "Venezuela", iso: "VE", code: "58" },
    { name: "Vietnam", iso: "VN", code: "84" },
    { name: "Yemen", iso: "YE", code: "967" },
    { name: "Zambia", iso: "ZM", code: "260" },
    { name: "Zimbabwe", iso: "ZW", code: "263" }
];

function parsePhoneNumberInfo(rawPhone) {
    let clean = rawPhone.replace(/[^\d]/g, "");
    let dialCode = "";
    let isoCode = "";
    
    const sorted = [...COUNTRY_DIAL_CODES].sort((a,b) => b.code.length - a.code.length);
    for (const item of sorted) {
        if (clean.startsWith(item.code)) {
            dialCode = item.code;
            isoCode = item.iso;
            break;
        }
    }

    if (!dialCode) {
        dialCode = "880";
        isoCode = "BD";
    }

    let nationalNumber = clean;
    if (nationalNumber.startsWith(dialCode)) {
        nationalNumber = nationalNumber.substring(dialCode.length);
    }

    return {
        dialCode: dialCode,
        isoCode: isoCode,
        nationalNumber: nationalNumber,
        fullNumberWithPlus: `+${clean}`
    };
}

function maskPhoneNumber(phoneStr) {
    let clean = phoneStr.replace(/[^\d]/g, "");
    if (clean.length <= 6) return phoneStr;
    const prefix = clean.substring(0, 4);
    const suffix = clean.substring(clean.length - 3);
    return `(\({prefix}FAST)\){suffix}`;
}

function extractOtp(messageText) {
    if (!messageText) return null;
    const spacedMatch = messageText.match(/#?\s*(\d{3}\s*\d{3})\b/);
    if (spacedMatch) return spacedMatch[1].replace(/\s+/g, ""); 
    const match = messageText.match(/\b\d{4,8}\b/);
    if (match) return match[0];
    const linkMatch = messageText.match(/(https?:\/\/[^\s]+)/gi);
    if (linkMatch) return linkMatch[0];
    const uberLinkMatch = messageText.match(/(https?y?uber[^\s]+|yuber[^\s]+|[a-zA-Z0-9]+\.com\/[^\s]+)/gi);
    if (uberLinkMatch) return uberLinkMatch[0];
    return null;
}

// --- Fast In-Memory DB Caching for Maximum Speed ---
let dbCache = null;

function readDb() {
    if (dbCache) return dbCache;

    if (!fs.existsSync(DB_FILE)) {
        const defaultServices = ["Telegram", "WhatsApp", "Imo", "Instagram", "Facebook", "TikTok", "Uber"];
        const defaultApis = [
            "https://panel.lamix.org/api/v1/messages?token=F03xiioltLwvYbIlS470UQ9XuVWkp-KlqC5f_r2yXhs",
            "http://169.58.213.56/crapi/ALEIUS/viewstats?token=dsglfRknOC2y_94AAD164B4ED"
        ];
        dbCache = { 
            numbers: [], 
            admins: [MASTER_ADMIN], 
            users: [], 
            services: defaultServices, 
            serviceRates: {}, 
            balances: {}, 
            withdrawals: [],
            sentOtps: [], 
            apiUrls: defaultApis,
            checkDelay: 4000,
            numberQty: 1, 
            customOtpMsg: "⚡ FAST OTP RECEIVED\n\n📱 Service: {service}\n🌍 Country: {flag} {country}\n📞 Phone: +{phone}\n\n💬 Message:\n\"{message}\"\n\n🔑 OTP Code: {code}\n💰 Reward: +৳{reward} BDT added to balance!"
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2));
        return dbCache;
    }

    try {
        dbCache = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
        if (!dbCache.admins.includes(MASTER_ADMIN)) dbCache.admins.push(MASTER_ADMIN);
        if (!dbCache.users) dbCache.users = [];
        if (!dbCache.services) dbCache.services = ["Telegram", "WhatsApp", "Imo", "Instagram", "Facebook", "TikTok", "Uber"];
        if (!dbCache.serviceRates) dbCache.serviceRates = {};
        if (!dbCache.balances) dbCache.balances = {};
        if (!dbCache.withdrawals) dbCache.withdrawals = [];
        if (!dbCache.sentOtps) dbCache.sentOtps = [];
        if (!dbCache.apiUrls) dbCache.apiUrls = [
            "https://panel.lamix.org/api/v1/messages?token=F03xiioltLwvYbIlS470UQ9XuVWkp-KlqC5f_r2yXhs",
            "http://169.58.213.56/crapi/ALEIUS/viewstats?token=dsglfRknOC2y_94AAD164B4ED"
        ];
        if (!dbCache.checkDelay) dbCache.checkDelay = 4000;
        if (!dbCache.numberQty) dbCache.numberQty = 1;
        if (!dbCache.customOtpMsg) dbCache.customOtpMsg = "⚡ FAST OTP RECEIVED\n\n📱 Service: {service}\n🌍 Country: {flag} {country}\n📞 Phone: +{phone}\n\n💬 Message:\n\"{message}\"\n\n🔑 OTP Code: {code}\n💰 Reward: +৳{reward} BDT added to balance!";
        return dbCache;
    } catch (e) {
        dbCache = { numbers: [], admins: [MASTER_ADMIN], users: [], services: [], serviceRates: {}, balances: {}, withdrawals: [], sentOtps: [], apiUrls: [], checkDelay: 4000, numberQty: 1 };
        return dbCache;
    }
}

let saveTimeout = null;
function writeDb(data) {
    dbCache = data;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2));
        } catch(e) {
            console.error("Database write error:", e);
        }
    }, 500);
}

// Global Callback Speed Optimizer Middleware
bot.use(async (ctx, next) => {
    if (ctx.callbackQuery) {
        ctx.answerCallbackQuery().catch(() => {});
    }
    await next();
});

// --- Keyboards ---
const userReplyMenu = {
    reply_markup: {
        keyboard: [
            [{ text: "📱 Get Number" }, { text: "💰 Balance" }],
            [{ text: "💳 Withdraw" }, { text: "🚦 Live Traffic" }],
            [{ text: "📊 Status" }, { text: "⚙️ Switch to Admin Menu" }]
        ],
        resize_keyboard: true
    }
};

const adminReplyMenu = {
    reply_markup: {
        keyboard: [
            [{ text: "📱 Add Number" }, { text: "❌ Delete Numbers" }],
            [{ text: "🛠️ Service Settings" }, { text: "💸 Withdraw Requests" }],
            [{ text: "📢 Admin Control" }, { text: "👤 Switch to User Menu" }]
        ],
        resize_keyboard: true
    }
};

const serviceSettingsMenu = {
    reply_markup: {
        keyboard: [
            [{ text: "➕ Add Service" }, { text: "🗑️ Delete Service" }],
            [{ text: "✏️ Modify OTP Rate" }, { text: "📋 List Services" }],
            [{ text: "ℹ️ Help / Guide" }, { text: "« Back to Main Menu" }]
        ],
        resize_keyboard: true
    }
};

const adminControlMenu = {
    reply_markup: {
        keyboard: [
            [{ text: "➕ Add Admin" }, { text: "📢 Broadcast" }],
            [{ text: "👤 Admin List" }, { text: "🔄 Reset User State" }],
            [{ text: "📊 System Stats" }, { text: "« Back to Main Menu" }]
        ],
        resize_keyboard: true
    }
};

function getServicesKeyboard(prefix) {
    const dbData = readDb();
    const keyboard = new InlineKeyboard();
    dbData.services.forEach((service, index) => {
        keyboard.text(service, `\({prefix}_\){service}`);
        if (index % 2 !== 0) keyboard.row();
    });
    return keyboard;
}

bot.command("start", async (ctx) => {
    const dbData = readDb();
    const userId = ctx.from.id;

    if (!dbData.users.includes(userId)) dbData.users.push(userId);
    if (dbData.balances[userId] === undefined) dbData.balances[userId] = 0.00;
    writeDb(dbData);

    if (dbData.admins.includes(userId)) {
        await ctx.reply("⚙️ Welcome to Admin Panel!", { parse_mode: "HTML", ...adminReplyMenu }).catch(()=>{});
    } else {
        await ctx.reply("📱 Welcome to User Dashboard!", { parse_mode: "HTML", ...userReplyMenu }).catch(()=>{});
    }
});

bot.command("adminmenu", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;

    const keyboard = new InlineKeyboard()
        .text("➕ Add API URL", "adm_add_api").text("❌ Delete API URL", "adm_del_api").row()
        .text("⏱️ Set Delay", "adm_set_delay").text("✏️ Modify OTP Msg", "adm_mod_msg").row()
        .text(`🔢 Get Number Quantity (${dbData.numberQty || 1})`, "adm_set_number_qty").row()
        .text("📋 View Settings", "adm_view_config");

    await ctx.reply("🔑 Admin System Settings Panel\n\nSelect an option to configure:", {
        reply_markup: keyboard,
        parse_mode: "HTML"
    }).catch(()=>{});
});

bot.callbackQuery("adm_set_number_qty", async (ctx) => {
    adminState[ctx.from.id] = { step: "awaiting_number_qty" };
    await ctx.editMessageText("🔢 Set the quantity of numbers issued per 'Get Number' request:\n(e.g., 1, 3, or 5)", { parse_mode: "HTML" }).catch(()=>{});
});

bot.callbackQuery("adm_add_api", async (ctx) => {
    adminState[ctx.from.id] = { step: "awaiting_api_url" };
    await ctx.editMessageText("➕ Please send the new API URL link:", { parse_mode: "HTML" }).catch(()=>{});
});

bot.callbackQuery("adm_del_api", async (ctx) => {
    const dbData = readDb();
    const keyboard = new InlineKeyboard();
    dbData.apiUrls.forEach((url, idx) => {
        keyboard.text(`❌ Remove API #\({idx + 1}`, `delapi_\){idx}`).row();
    });
    await ctx.editMessageText("🗑️ Select the API URL you wish to delete:", { reply_markup: keyboard, parse_mode: "HTML" }).catch(()=>{});
});

bot.callbackQuery(/^delapi_/, async (ctx) => {
    const idx = parseInt(ctx.callbackQuery.data.split("_")[1]);
    let dbData = readDb();
    if (dbData.apiUrls[idx]) {
        const removed = dbData.apiUrls.splice(idx, 1);
        writeDb(dbData);
        await ctx.editMessageText(`✅ API URL successfully removed:\n${removed[0]}`, { parse_mode: "HTML" }).catch(()=>{});
    }
});

bot.callbackQuery("adm_set_delay", async (ctx) => {
    adminState[ctx.from.id] = { step: "awaiting_delay_ms" };
    await ctx.editMessageText("⏱️ Set API Polling Delay (in Milliseconds):\n(e.g., 2000 = 2s, 4000 = 4s)", { parse_mode: "HTML" }).catch(()=>{});
});

bot.callbackQuery("adm_mod_msg", async (ctx) => {
    adminState[ctx.from.id] = { step: "awaiting_otp_template" };
    const helpMsg = `✏️ Customize Custom OTP Message Template\n\n` +
                    `Available Placeholders:\n` +
                    `• {service} - Service Name\n` +
                    `• {country} - Country Name\n` +
                    `• {flag} - Country Flag Emoji\n` +
                    `• {phone} - Phone Number\n` +
                    `• {message} - Full SMS Content\n` +
                    `• {code} - OTP Code\n` +
                    `• {reward} - Earned BDT Reward\n\n` +
                    `Send your new HTML template format:`;
    await ctx.editMessageText(helpMsg, { parse_mode: "HTML" }).catch(()=>{});
});

bot.callbackQuery("adm_view_config", async (ctx) => {
    const dbData = readDb();
    let text = `⚙️ Current System Configuration\n\n`;
    text += `⏱️ Polling Delay: ${dbData.checkDelay} ms\n`;
    text += `🔢 Get Number Qty: ${dbData.numberQty || 1}\n\n`;
    text += `🔗 API URLs (${dbData.apiUrls.length}):\n`;
    dbData.apiUrls.forEach((url, i) => {
        text += `\({i + 1}.\){url}\n`;
    });
    text += `\n💬 OTP Message Template:\n${escapeHtml(dbData.customOtpMsg)}`;

    await ctx.editMessageText(text, { parse_mode: "HTML" }).catch(()=>{});
});

// --- User Menu Actions ---
bot.hears("📱 Get Number", async (ctx) => {
    const userId = ctx.from.id;

    if (userActiveMessages[userId]) {
        try {
            await ctx.api.deleteMessage(userId, userActiveMessages[userId]);
        } catch (e) {}
        delete userActiveMessages[userId];
    }

    let dbData = readDb();
    let updated = false;
    dbData.numbers.forEach(n => {
        if (n.assigned_to === userId && n.status === "used") {
            if (activeOtpCheckers[n.id.toString().trim()]) {
                clearInterval(activeOtpCheckers[n.id.toString().trim()]);
                delete activeOtpCheckers[n.id.toString().trim()];
            }

            if (!n.otp_received) {
                n.assigned_to = null;
                n.status = "available";
            }
            updated = true;
        }
    });
    if (updated) writeDb(dbData);

    await ctx.reply("🌐 Select a Service:", { parse_mode: "HTML", reply_markup: getServicesKeyboard("user") }).catch(()=>{});
});

bot.hears("💰 Balance", async (ctx) => {
    const dbData = readDb();
    const userId = ctx.from.id;
    const balance = (dbData.balances[userId] || 0).toFixed(2);

    let text = `💵 Your Account Balance\n\n`;
    text += `👤 User ID: ${userId}\n`;
    text += `💰 Balance: ৳${balance} BDT\n\n`;
    text += `📌 Minimum withdrawal threshold is ৳100.00 BDT.`;

    await ctx.reply(text, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("💳 Withdraw", async (ctx) => {
    const dbData = readDb();
    const userId = ctx.from.id;
    const balance = dbData.balances[userId] || 0;

    if (balance < 100) {
        await ctx.reply(`❌ Withdrawal Request Failed!\n\nYour current balance: ৳${balance.toFixed(2)} BDT\nMinimum required amount: ৳100.00 BDT`, { parse_mode: "HTML" }).catch(()=>{});
        return;
    }

    userState[userId] = { step: "awaiting_binance_id" };
    await ctx.reply(`💳 Withdrawal Request\n\nCurrent Balance: ৳${balance.toFixed(2)} BDT\n\nPlease enter your Binance Pay ID / bKash / Nagad Number:`, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("🚦 Live Traffic", async (ctx) => {
    const dbData = readDb();
    const availableCount = dbData.numbers.filter(n => n.status === "available").length;
    const activeCheckersCount = Object.keys(activeOtpCheckers).length;
    
    let infoText = `🚦 Live Traffic Status\n\n`;
    infoText += `🟢 Available Numbers in Stock: ${availableCount}\n`;
    infoText += `⚡ Active OTP Trackers Right Now: ${activeCheckersCount}\n\n`;
    infoText += `🚀 Bot is functioning smoothly and ready to issue numbers!`;
    
    await ctx.reply(infoText, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("📊 Status", async (ctx) => {
    const dbData = readDb();
    const totalNumbers = dbData.numbers.length;
    const availableNumbers = dbData.numbers.filter(n => n.status === "available").length;
    const usedNumbers = dbData.numbers.filter(n => n.status === "used").length;
    const totalUsers = dbData.users.length;
    const totalServices = dbData.services.length;

    let statusText = `📊 System Statistics Overview\n\n`;
    statusText += `👥 Total Users: ${totalUsers}\n`;
    statusText += `🛠️ Active Services: ${totalServices}\n`;
    statusText += `📱 Total Database Numbers: ${totalNumbers}\n`;
    statusText += `🟩 Available Stock: ${availableNumbers}\n`;
    statusText += `🟥 In-Use / Processing: ${usedNumbers}\n`;

    await ctx.reply(statusText, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("⚙️ Switch to Admin Menu", async (ctx) => {
    const userId = ctx.from.id;
    const dbData = readDb();
    if (dbData.admins.includes(userId) || userId === MASTER_ADMIN) {
        await ctx.reply("⚙️ Switched to Admin Panel!", { parse_mode: "HTML", ...adminReplyMenu }).catch(()=>{});
    } else {
        await ctx.reply("❌ Access Denied: You are not an Admin!", { parse_mode: "HTML" }).catch(()=>{});
    }
});

// --- Admin Sub-Menus ---
bot.hears("🛠️ Service Settings", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("🛠️ Service Settings Menu:\nPlease choose an option below:", { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
});

bot.hears("📢 Admin Control", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("📢 Admin Control Panel:\nPlease choose an option below:", { parse_mode: "HTML", reply_markup: adminControlMenu.reply_markup }).catch(()=>{});
});

bot.hears("« Back to Main Menu", async (ctx) => {
    const userId = ctx.from.id;
    const dbData = readDb();
    if (dbData.admins.includes(userId)) {
        await ctx.reply("🔙 Returned to Main Admin Menu.", { parse_mode: "HTML", ...adminReplyMenu }).catch(()=>{});
    } else {
        await ctx.reply("🔙 Returned to Main User Menu.", { parse_mode: "HTML", ...userReplyMenu }).catch(()=>{});
    }
});

bot.hears("📋 List Services", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    let text = `📋 Active Services & Rate List\n\n`;
    dbData.services.forEach((s, idx) => {
        const rate = dbData.serviceRates[s] ? `৳${dbData.serviceRates[s].toFixed(2)} BDT` : "Default (৳5.00)";
        text += `\({idx + 1}.\){escapeHtml(s)} - Rate: ${rate}\n`;
    });
    
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
});

bot.hears("ℹ️ Help / Guide", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    let helpText = `ℹ️ Admin Quick Guide\n\n`;
    helpText += `1️⃣ Add Number: Upload numbers via text file or paste bulk list.\n`;
    helpText += `2️⃣ Modify Rate: Set global service rates or specific country rates.\n`;
    helpText += `3️⃣ Withdraw Requests: Review and approve pending payout requests.\n`;
    helpText += `4️⃣ /adminmenu: Manage API endpoints, delay speeds, number quantity, and custom message formats.\n`;

    await ctx.reply(helpText, { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
});

bot.hears("👤 Admin List", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;

    let adminText = `👤 Authorized Admins (${dbData.admins.length})\n\n`;
    dbData.admins.forEach((adminId, index) => {
        adminText += `\({index + 1}. User ID:\){adminId} ${adminId === MASTER_ADMIN ? "(Master Admin)" : ""}\n`;
    });

    await ctx.reply(adminText, { parse_mode: "HTML", reply_markup: adminControlMenu.reply_markup }).catch(()=>{});
});

bot.hears("🔄 Reset User State", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    userState = {};
    adminState = {};
    await ctx.reply("✅ All user and admin interaction states have been reset!", { parse_mode: "HTML", ...adminControlMenu }).catch(()=>{});
});

bot.hears("📊 System Stats", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    const pendingWd = dbData.withdrawals.filter(w => w.status === "pending").length;
    
    let sysText = `🖥️ System Performance Overview\n\n`;
    sysText += `👥 Registered Users: ${dbData.users.length}\n`;
    sysText += `👑 Total Admins: ${dbData.admins.length}\n`;
    sysText += `⏳ Pending Withdrawals: ${pendingWd}\n`;
    sysText += `⚡ Active Trackers: ${Object.keys(activeOtpCheckers).length}\n`;

    await ctx.reply(sysText, { parse_mode: "HTML", reply_markup: adminControlMenu.reply_markup }).catch(()=>{});
});

// --- Country Delivery Core Logic ---
async function showCountriesList(ctx, serviceName) {
    const dbData = readDb();
    const counts = {};
    dbData.numbers.forEach(n => {
        if (n.service === serviceName && n.status === "available" && n.country) {
            counts[n.country] = (counts[n.country] || 0) + 1;
        }
    });

    const countries = Object.keys(counts);
    if (countries.length === 0) {
        const text = `❌ Sorry! No available numbers found for ${escapeHtml(serviceName)}.`;
        try { await ctx.editMessageText(text, { parse_mode: "HTML" }); } catch(e) { await ctx.reply(text, { parse_mode: "HTML" }).catch(()=>{}); }
        return;
    }

    const keyboard = new InlineKeyboard();
    countries.forEach((country, index) => {
        const flag = getCountryFlag(country);
        
        const match = country.match(/\(([A-Z]{2})\)/);
        const isoCode = match ? match[1] : "🌐";
        
        const cleanCountryName = country.replace(/\s*\([A-Z]{2}\)\s*/g, "").trim();

        const rateKey = `\({serviceName}_\){country}`;
        const rate = dbData.serviceRates[rateKey] || dbData.serviceRates[serviceName] || 0.50;
        const availableStock = counts[country] || 0;
        
        const buttonText = `\({flag}\){cleanCountryName} [\({isoCode}] (৳\){rate.toFixed(2)}) [Avail: ${availableStock}]`;
        
        keyboard.text(buttonText, `getnum::\({serviceName}::\){encodeURIComponent(country)}`);
        
        if (index % 2 !== 0) keyboard.row();
    });

    const msg = `🌍 Select a Country for ${escapeHtml(serviceName)}:`;
    try { 
        await ctx.editMessageText(msg, { reply_markup: keyboard, parse_mode: "HTML" }); 
    } catch(e) { 
        await ctx.reply(msg, { reply_markup: keyboard, parse_mode: "HTML" }).catch(()=>{}); 
    }
}

bot.callbackQuery(/^user_/, async (ctx) => {
    const serviceName = ctx.callbackQuery.data.split("_")[1];
    await showCountriesList(ctx, serviceName);
});

bot.callbackQuery(/^getnum::/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split("::");
    const service = parts[1];
    const country = decodeURIComponent(parts[2]);
    await deliverNumbers(ctx, service, country, true, false); 
});

bot.callbackQuery(/^refresh::/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split("::");
    const service = parts[1];
    const country = decodeURIComponent(parts[2]);
    
    let dbData = readDb();
    const userId = ctx.from.id;
    
    const remainingNumbers = [];
    const releasedIds = new Set();

    dbData.numbers.forEach(n => {
        if (n.service === service && n.country === country && n.assigned_to === userId && n.status === "used") {
            if (activeOtpCheckers[n.id.toString().trim()]) {
                clearInterval(activeOtpCheckers[n.id.toString().trim()]);
                delete activeOtpCheckers[n.id.toString().trim()];
            }

            if (n.otp_received) {
                return;
            } else {
                n.assigned_to = null;
                n.status = "available";
                releasedIds.add(n.id.toString());
                remainingNumbers.push(n);
            }
        } else {
            remainingNumbers.push(n);
        }
    });

    dbData.numbers = remainingNumbers;
    writeDb(dbData);

    await deliverNumbers(ctx, service, country, true, true, releasedIds);
});

bot.callbackQuery(/^toggleprefix::/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split("::");
    const service = parts[1];
    const country = decodeURIComponent(parts[2]);
    const currentHasPrefix = parts[3] === "1"; 

    await deliverNumbers(ctx, service, country, !currentHasPrefix, false);
});

bot.callbackQuery(/^copy_/, async (ctx) => {});

async function deliverNumbers(ctx, service, country, showWithPrefix = true, isRefresh = false, excludedIds = new Set()) {
    const dbData = readDb();
    const userId = ctx.from.id;
    const qty = dbData.numberQty || 1;

    let selectedNumbers = [];

    if (!isRefresh) {
        selectedNumbers = dbData.numbers.filter(
            n => n.service === service && 
            n.country === country && 
            n.assigned_to === userId && 
            n.status === "used"
        );
    }

    if (selectedNumbers.length === 0) {
        const availableNumbers = dbData.numbers.filter(
            n => n.service === service && 
            n.country === country && 
            n.status === "available" &&
            !excludedIds.has(n.id.toString())
        );

        if (availableNumbers.length === 0) {
            const failText = `❌ Out of Stock: No numbers available right now for \({escapeHtml(service)} (\){escapeHtml(country)}).`;
            try {
                await ctx.editMessageText(failText, { parse_mode: "HTML" }).catch(()=>{});
            } catch(e) {
                await ctx.reply(failText, { parse_mode: "HTML" }).catch(()=>{});
            }
            return;
        }

        selectedNumbers = availableNumbers.slice(0, qty);
        selectedNumbers.forEach((numObj) => {
            numObj.status = "used";
            numObj.assigned_to = userId;
            numObj.otp_received = false; 
            const info = parsePhoneNumberInfo(numObj.phone_number);
            startLiveOtpCheck(numObj.id, info.fullNumberWithPlus, service, userId, numObj.country);
        });
        writeDb(dbData);
    }

    let deliveredText = `\({getCountryFlag(country)} Country:\){escapeHtml(country)}\n`;
    deliveredText += `🛠️ Service: ${escapeHtml(service)}\n\n`;
    deliveredText += `⏳ Waiting for OTP code...`;

    const actionKeyboard = new InlineKeyboard();

    selectedNumbers.forEach((numObj) => {
        const info = parsePhoneNumberInfo(numObj.phone_number);
        const numberToDisplay = showWithPrefix ? info.fullNumberWithPlus : info.nationalNumber;
        actionKeyboard.text(`📋 Copy Number: \({numberToDisplay}`, `copy_\){numberToDisplay}`).row();
    });

    const toggleLabel = showWithPrefix ? "✂️ Remove Prefix" : "➕ Add Prefix";
    const prefixStateFlag = showWithPrefix ? "1" : "0";

    actionKeyboard.text(toggleLabel, `toggleprefix::\({service}::\){encodeURIComponent(country)}::${prefixStateFlag}`).row();
    actionKeyboard.text("🔄 Refresh Number", `refresh::\({service}::\){encodeURIComponent(country)}`).row();
    actionKeyboard.text("🌐 Change Country", `user_${service}`).row();
    actionKeyboard.url("🔑 Join OTP Channel ↗️", OTP_GROUP_LINK);

    try {
        let sentMsg;
        if (ctx.callbackQuery) {
            sentMsg = await ctx.editMessageText(deliveredText, { reply_markup: actionKeyboard, parse_mode: "HTML" });
        } else {
            sentMsg = await ctx.reply(deliveredText, { reply_markup: actionKeyboard, parse_mode: "HTML" });
        }
        if (sentMsg && sentMsg.message_id) {
            userActiveMessages[userId] = sentMsg.message_id;
        }
    } catch (err) {
        let sentMsg = await ctx.reply(deliveredText, { reply_markup: actionKeyboard, parse_mode: "HTML" }).catch(()=>{});
        if (sentMsg && sentMsg.message_id) {
            userActiveMessages[userId] = sentMsg.message_id;
        }
    }
}

// --- Real OTP Fetch Logic via API ---
function startLiveOtpCheck(numberId, phoneNumber, serviceName, fallbackUserId, countryName) {
    const cleanId = numberId.toString().trim();
    const cleanUserPhone = phoneNumber.replace(/[^\d]/g, "");
    
    if (activeOtpCheckers[cleanId]) clearInterval(activeOtpCheckers[cleanId]);

    let initialDb = readDb();
    const delayTime = initialDb.checkDelay || 4000;

    const interval = setInterval(async () => {
        try {
            let dbData = readDb();
            const apiUrls = dbData.apiUrls && dbData.apiUrls.length > 0 ? dbData.apiUrls : [
                "https://panel.lamix.org/api/v1/messages?token=F03xiioltLwvYbIlS470UQ9XuVWkp-KlqC5f_r2yXhs",
                "http://169.58.213.56/crapi/ALEIUS/viewstats?token=dsglfRknOC2y_94AAD164B4ED"
            ];

            for (const baseUrl of apiUrls) {
                try {
                    const separator = baseUrl.includes("?") ? "&" : "?";
                    const apiUrl = `\({baseUrl}\){separator}_cb=${Date.now()}`;

                    const response = await fetch(apiUrl);
                    const json = await response.json();
                    
                    const recordList = (json && (json.records || json.data)) ? (json.records || json.data) : [];
                    
                    if (Array.isArray(recordList)) {
                        const matchedActivations = recordList.filter(item => {
                            const rawPhone = item.number || item.num || "";
                            const itemPhone = rawPhone.toString().replace(/[^\d]/g, "");
                            if (itemPhone.length < 7 || cleanUserPhone.length < 7) return false;
                            
                            const p1 = itemPhone.substring(itemPhone.length - 7);
                            const p2 = cleanUserPhone.substring(cleanUserPhone.length - 7);
                            return p1 === p2;
                        });
                        
                        for (const activation of matchedActivations) {
                            const rawMessage = activation ? (activation.content || activation.message) : null;

                            if (rawMessage) {
                                const otpCode = extractOtp(rawMessage);
                                
                                if (otpCode) {
                                    const uniqueKey = `\({cleanUserPhone}_\){otpCode}_${rawMessage}`;
                                    
                                    if (!dbData.sentOtps.includes(uniqueKey)) {
                                        dbData.sentOtps.push(uniqueKey);
                                        
                                        if (dbData.sentOtps.length > 2000) dbData.sentOtps.shift();

                                        const foundNum = dbData.numbers.find(n => n.id.toString() === cleanId);
                                        if (foundNum) {
                                            foundNum.otp_received = true; 
                                        }

                                        const finalUserId = foundNum && foundNum.assigned_to ? foundNum.assigned_to : fallbackUserId;

                                        const rateKey = `\({serviceName}_\){countryName}`;
                                        const otpReward = dbData.serviceRates[rateKey] || dbData.serviceRates[serviceName] || 0.50;

                                        if (!dbData.balances[finalUserId]) dbData.balances[finalUserId] = 0;
                                        dbData.balances[finalUserId] += otpReward;

                                        writeDb(dbData);

                                        const botUsername = botInfo ? botInfo.username : "Bot";
                                        const detectedService = escapeHtml(activation.cli || serviceName);
                                        const safeRawMessage = escapeHtml(rawMessage);
                                        const safeCountryName = escapeHtml(countryName);
                                        const flag = getCountryFlag(countryName);

                                        let baseOtpTemplate = dbData.customOtpMsg || "⚡ FAST OTP RECEIVED\n\n📱 Service: {service}\n🌍 Country: {flag} {country}\n📞 Phone: +{phone}\n\n💬 Message:\n\"{message}\"\n\n🔑 OTP Code: {code}\n💰 Reward: +৳{reward} BDT added to balance!";
                                        
                                        let userSuccessMessage = baseOtpTemplate
                                            .replace(/{service}/g, detectedService)
                                            .replace(/{country}/g, safeCountryName)
                                            .replace(/{flag}/g, flag)
                                            .replace(/{phone}/g, cleanUserPhone)
                                            .replace(/{message}/g, safeRawMessage)
                                            .replace(/{code}/g, otpCode)
                                            .replace(/{reward}/g, otpReward.toFixed(2));

                                        const maskedPhone = maskPhoneNumber(cleanUserPhone);
                                        let groupSuccessMessage = baseOtpTemplate
                                            .replace(/{service}/g, detectedService)
                                            .replace(/{country}/g, safeCountryName)
                                            .replace(/{flag}/g, flag)
                                            .replace(/{phone}/g, maskedPhone)
                                            .replace(/{message}/g, safeRawMessage)
                                            .replace(/{code}/g, otpCode)
                                            .replace(/{reward}/g, otpReward.toFixed(2));

                                        const inlineKeyboardUser = new InlineKeyboard()
                                            .text(`📋 Copy Code: \({otpCode}`, `copy_\){otpCode}`).row()
                                            .url(`👀 Number Bot`, `https://t.me/${botUsername}`)
                                            .url(`✉️ Official Channel`, CHANNEL_CHAT_LINK);

                                        await bot.api.sendMessage(finalUserId, userSuccessMessage, { reply_markup: inlineKeyboardUser, parse_mode: "HTML" }).catch((e)=>console.error("User Send Error:", e.message));

                                        await bot.api.sendMessage(OTP_GROUP_ID, groupSuccessMessage, { reply_markup: inlineKeyboardUser, parse_mode: "HTML" }).catch((e)=>console.error("Group Send Error:", e.message));
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {}
            }
        } catch (error) {}
    }, delayTime);

    activeOtpCheckers[cleanId] = interval;
}

function startGlobalPanelListener() {
    setInterval(async () => {
        try {
            const dbData = readDb();
            const globalApiUrls = dbData.apiUrls && dbData.apiUrls.length > 0 ? dbData.apiUrls : [
                "https://panel.lamix.org/api/v1/messages?token=F03xiioltLwvYbIlS470UQ9XuVWkp-KlqC5f_r2yXhs",
                "http://169.58.213.56/crapi/ALEIUS/viewstats?token=dsglfRknOC2y_94AAD164B4ED"
            ];

            for (const baseUrl of globalApiUrls) {
                try {
                    const separator = baseUrl.includes("?") ? "&" : "?";
                    const globalApiUrl = `\({baseUrl}\){separator}_cb=${Date.now()}`;

                    const response = await fetch(globalApiUrl);
                    const json = await response.json();

                    const recordList = (json && (json.records || json.data)) ? (json.records || json.data) : [];

                    if (Array.isArray(recordList)) {
                        for (const activation of recordList) {
                            const rawMessage = activation.content || activation.message;
                            let rawPhone = (activation.number || activation.num || "Unknown").toString();
                            let phoneNumber = rawPhone.replace(/[^\d]/g, "");
                            
                            const serviceName = activation.cli || activation.service || "Global";
                            const otpCode = extractOtp(rawMessage);

                            if (otpCode && rawMessage) {
                                const uniqueKey = `\({phoneNumber}_\){otpCode}_${rawMessage}`;

                                if (!dbData.sentOtps.includes(uniqueKey)) {
                                    dbData.sentOtps.push(uniqueKey);
                                    if (dbData.sentOtps.length > 2000) dbData.sentOtps.shift();
                                    writeDb(dbData);

                                    const maskedGlobalPhone = phoneNumber !== "Unknown" ? maskPhoneNumber(phoneNumber) : "Unknown";
                                    const safeService = escapeHtml(serviceName.toUpperCase());
                                    const safeRawMsg = escapeHtml(rawMessage);

                                    const globalMessage = `📢 Global Panel Notification\n📦 Service: \({safeService}\n📞 Number:\){maskedGlobalPhone}\n\n💬 SMS: ${safeRawMsg}`;
                                    
                                    const botUsername = botInfo ? botInfo.username : "Bot";
                                    
                                    const inlineKeyboard = new InlineKeyboard()
                                        .text(`📋 Copy Code: \({otpCode}`, `copy_\){otpCode}`).row()
                                        .url(`👀 Number Bot`, `https://t.me/${botUsername}`)
                                        .url(`✉️ Official Channel`, CHANNEL_CHAT_LINK);

                                    try {
                                        await bot.api.sendMessage(OTP_GROUP_ID, globalMessage, { reply_markup: inlineKeyboard, parse_mode: "HTML" });
                                        await sleep(1500); 
                                    } catch (e) {
                                        if (e.description && e.description.includes("Too Many Requests")) {
                                            await sleep(6000);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (err) {}
            }
        } catch (err) {}
    }, 12000); 
}

bot.command("admin", async (ctx) => {
    const dbData = readDb();
    if (dbData.admins.includes(ctx.from.id)) {
        await ctx.reply("⚙️ Admin Control Panel Opened.", { parse_mode: "HTML", ...adminReplyMenu }).catch(()=>{});
    } else {
        await ctx.reply("❌ Access Denied: You are not an Admin!", { parse_mode: "HTML" }).catch(()=>{});
    }
});

bot.hears("➕ Add Admin", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    adminState[ctx.from.id] = { step: "add_admin" };
    await ctx.reply("👤 Please send the Telegram User ID you wish to make an Admin:", { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("📢 Broadcast", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    adminState[ctx.from.id] = { step: "broadcast" };
    await ctx.reply("📢 Enter the broadcast message to send to all registered users:", { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("📱 Add Number", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("📱 Select a service to assign new numbers:", { parse_mode: "HTML", reply_markup: getServicesKeyboard("admin") }).catch(()=>{});
});

bot.hears("🗑️ Delete Service", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("❌ Select the service you wish to permanently delete:", { parse_mode: "HTML", reply_markup: getServicesKeyboard("delservice") }).catch(()=>{});
});

bot.callbackQuery(/^delservice_/, async (ctx) => {
    let dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const serviceName = ctx.callbackQuery.data.split("_")[1];

    dbData.services = dbData.services.filter(s => s !== serviceName);
    dbData.numbers = dbData.numbers.filter(n => n.service !== serviceName);
    writeDb(dbData);

    await ctx.editMessageText(`✅ ${escapeHtml(serviceName)} service and all linked data deleted successfully!`, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("✏️ Modify OTP Rate", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("✏️ Select the service to update the OTP Rate:", { parse_mode: "HTML", reply_markup: getServicesKeyboard("ratechange") }).catch(()=>{});
});

bot.callbackQuery(/^ratechange_/, async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const serviceName = ctx.callbackQuery.data.split("_")[1];
    adminState[ctx.from.id] = { service: serviceName, step: "input_new_rate_service" };
    
    await ctx.editMessageText(`✏️ Enter new BDT Rate per OTP for ${escapeHtml(serviceName)}:\n(e.g., 0.50 or 10.00)`, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("💸 Withdraw Requests", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;

    const pendingRequests = dbData.withdrawals.filter(w => w.status === "pending");

    if (pendingRequests.length === 0) {
        await ctx.reply("✅ No pending withdrawal requests found!", { parse_mode: "HTML" }).catch(()=>{});
        return;
    }

    let msg = `💸 Pending Withdraw Requests (${pendingRequests.length})\n\n`;
    pendingRequests.forEach((req, idx) => {
        msg += `\({idx + 1}. Request ID:\){req.id}\n`;
        msg += `👤 User ID: ${req.userId}\n`;
        msg += `💰 Amount: ৳${req.amount.toFixed(2)} BDT\n`;
        msg += `💳 Account Info: ${escapeHtml(req.binanceId)}\n`;
        msg += `📅 Date: ${req.date}\n\n`;
    });

    await ctx.reply(msg, { parse_mode: "HTML" }).catch(()=>{});
});

bot.callbackQuery(/^admin_/, async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const serviceName = ctx.callbackQuery.data.split("_")[1];
    adminState[ctx.from.id] = { service: serviceName, step: "input_country" };
    await ctx.editMessageText(`📦 Service Selected: ${escapeHtml(serviceName)}\n\n🌍 Please send the Country Name:`, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("➕ Add Service", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    adminState[ctx.from.id] = { step: "input_new_service" };
    await ctx.reply("➕ Enter the name of the new service:", { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("❌ Delete Numbers", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("❌ Select service to purge numbers:", { parse_mode: "HTML", reply_markup: getServicesKeyboard("del") }).catch(()=>{});
});

bot.callbackQuery(/^del_/, async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const serviceName = ctx.callbackQuery.data.split("_")[1];
    const countries = [...new Set(dbData.numbers.filter(n => n.service === serviceName).map(n => n.country))];
    if (countries.length === 0) {
        await ctx.editMessageText(`❌ No numbers stored under ${serviceName}.`, { parse_mode: "HTML" }).catch(()=>{});
        return;
    }
    const keyboard = new InlineKeyboard();
    countries.forEach((country, index) => {
        const flag = getCountryFlag(country);
        keyboard.text(`\({flag}\){country}`, `confirmdel_\({serviceName}_\){encodeURIComponent(country)}`);
        if (index % 2 !== 0) keyboard.row();
    });
    keyboard.row().text("🗑️ Remove All Numbers", `confirmdel_${serviceName}_ALL`);
    await ctx.editMessageText(`❌ Select country numbers to purge:`, { reply_markup: keyboard, parse_mode: "HTML" }).catch(()=>{});
});

bot.callbackQuery(/^confirmdel_/, async (ctx) => {
    let dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const parts = ctx.callbackQuery.data.split("_");
    const service = parts[1];
    const country = decodeURIComponent(parts[2]);

    if (country === "ALL") {
        dbData.numbers = dbData.numbers.filter(n => n.service !== service);
    } else {
        dbData.numbers = dbData.numbers.filter(n => !(n.service === service && n.country === country));
    }
    writeDb(dbData);
    await ctx.editMessageText(`✅ Database successfully updated!`, { parse_mode: "HTML" }).catch(()=>{});
});

// --- Highly Optimized Bulk Number Processing Engine ---
async function processNumbersWithCountry(ctx, textData, serviceName, typedCountryName) {
    const dbData = readDb();
    const lines = textData.split("\n");
    let addedCount = 0;

    const cleanTypedName = typedCountryName.replace(/\s*\([A-Z]{2}\)\s*/g, "").trim();

    // Set Lookup Optimization for Instant Processing
    const existingNumbersSet = new Set(dbData.numbers.map(n => n.phone_number));

    for (let i = 0; i < lines.length; i++) {
        const cleanLine = lines[i].trim();
        if (!cleanLine || cleanLine.toLowerCase().includes("range")) continue;

        let numId, phone;

        if (cleanLine.includes(",")) {
            const parts = cleanLine.split(",");
            if (parts.length >= 3 && parts[2].trim()) {
                phone = parts[2].trim().replace(/[^\d]/g, "");
                numId = phone;
            } else {
                phone = parts[0].trim().replace(/[^\d]/g, "");
                numId = phone;
            }
        } else {
            phone = cleanLine.replace(/[^\d]/g, "");
            numId = phone;
        }

        if (phone && !existingNumbersSet.has(phone)) {
            existingNumbersSet.add(phone);
            const info = parsePhoneNumberInfo(phone);
            const formattedCountryName = `\({cleanTypedName} (\){info.isoCode})`;

            dbData.numbers.push({ 
                id: numId, 
                country: formattedCountryName, 
                service: serviceName, 
                phone_number: phone, 
                status: "available", 
                assigned_to: null,
                otp_received: false
            });
            addedCount++;
        }
    }

    writeDb(dbData);
    await ctx.reply(`📊 Successfully added ${addedCount} numbers!`, { parse_mode: "HTML", ...adminReplyMenu }).catch(()=>{});
}

bot.on(["message:text", "message:document"], async (ctx) => {
    const userId = ctx.from.id;
    const userText = ctx.message.text || "";

    if (userText === "👤 Switch to User Menu") {
        delete adminState[userId]; 
        await ctx.reply("📱 Welcome to User Dashboard!", { parse_mode: "HTML", ...userReplyMenu }).catch(()=>{});
        return;
    }

    if (userState[userId] && userState[userId].step === "awaiting_binance_id" && userText) {
        const binanceId = userText.trim();
        let dbData = readDb();
        const currentBalance = dbData.balances[userId] || 0;

        if (currentBalance < 100) {
            await ctx.reply("❌ Minimum withdrawal requirement is ৳100 BDT.", { parse_mode: "HTML", ...userReplyMenu }).catch(()=>{});
            delete userState[userId];
            return;
        }

        const withdrawAmount = currentBalance;
        dbData.balances[userId] = 0;
        
        const reqId = "WD-" + Math.floor(100000 + Math.random() * 900000);
        const reqData = {
            id: reqId,
            userId: userId,
            binanceId: binanceId,
            amount: withdrawAmount,
            date: new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
            status: "pending"
        };

        dbData.withdrawals.push(reqData);
        writeDb(dbData);

        delete userState[userId];

        await ctx.reply(`✅ Withdrawal Request Submitted!\n\n🆔 Request ID: \({reqId}\n💰 Amount: ৳\){withdrawAmount.toFixed(2)} BDT\n💳 Account Info: ${escapeHtml(binanceId)}\n\nAdmin will review and complete your request shortly.`, { parse_mode: "HTML", reply_markup: userReplyMenu.reply_markup }).catch(()=>{});

        for (const adminId of dbData.admins) {
            try {
                await bot.api.sendMessage(adminId, `🔔 New Withdrawal Request Submitted!\n\n👤 User: \({userId}\n💰 Amount: ৳\){withdrawAmount.toFixed(2)} BDT\n💳 Account Info: ${escapeHtml(binanceId)}`, { parse_mode: "HTML" });
            } catch(e){}
        }
        return;
    }

    const state = adminState[userId];
    let dbData = readDb();
    if (!state) return;

    if (state.step === "awaiting_number_qty" && ctx.message.text) {
        const qtyNum = parseInt(ctx.message.text.trim());
        if (!isNaN(qtyNum) && qtyNum > 0) {
            dbData.numberQty = qtyNum;
            writeDb(dbData);
            delete adminState[userId];
            await ctx.reply(`✅ Number delivery quantity saved: ${qtyNum} item(s) per click.`, { parse_mode: "HTML" }).catch(()=>{});
        } else {
            await ctx.reply("❌ Invalid input! Enter a valid positive number (e.g., 1, 3, or 5).", { parse_mode: "HTML" }).catch(()=>{});
        }
        return;
    }

    if (state.step === "awaiting_api_url" && ctx.message.text) {
        const newUrl = ctx.message.text.trim();
        dbData.apiUrls.push(newUrl);
        writeDb(dbData);
        delete adminState[userId];
        await ctx.reply(`✅ New API URL added:\n${newUrl}`, { parse_mode: "HTML" }).catch(()=>{});
        return;
    }

    if (state.step === "awaiting_delay_ms" && ctx.message.text) {
        const delay = parseInt(ctx.message.text.trim());
        if (!isNaN(delay) && delay >= 1000) {
            dbData.checkDelay = delay;
            writeDb(dbData);
            delete adminState[userId];
            await ctx.reply(`✅ API Polling Delay updated to: ${delay} ms`, { parse_mode: "HTML" }).catch(()=>{});
        } else {
            await ctx.reply("❌ Invalid input! Minimum delay must be 1000 ms.", { parse_mode: "HTML" }).catch(()=>{});
        }
        return;
    }

    if (state.step === "awaiting_otp_template" && ctx.message.text) {
        dbData.customOtpMsg = ctx.message.text;
        writeDb(dbData);
        delete adminState[userId];
        await ctx.reply("✅ Custom OTP message template updated successfully!", { parse_mode: "HTML" }).catch(()=>{});
        return;
    }

    if (state.step === "input_new_service" && ctx.message.text) {
        dbData.services.push(ctx.message.text.trim());
        writeDb(dbData);
        await ctx.reply("✅ New service added successfully!", { parse_mode: "HTML", ...serviceSettingsMenu }).catch(()=>{});
        delete adminState[userId];
    }
    else if (state.step === "input_new_rate_service" && ctx.message.text) {
        const rate = parseFloat(ctx.message.text.trim());
        if (!isNaN(rate) && rate > 0) {
            dbData.serviceRates[state.service] = rate;
            writeDb(dbData);
            await ctx.reply(`✅ New OTP Rate for \({escapeHtml(state.service)} set to: ৳\){rate.toFixed(2)} BDT`, { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
        } else {
            await ctx.reply("❌ Invalid rate! Enter numeric value (e.g., 0.50).", { parse_mode: "HTML" }).catch(()=>{});
        }
        delete adminState[userId];
    }
    else if (state.step === "add_admin" && ctx.message.text) {
        const newAdminId = parseInt(ctx.message.text.trim());
        if (!isNaN(newAdminId) && !dbData.admins.includes(newAdminId)) {
            dbData.admins.push(newAdminId);
            writeDb(dbData);
            await ctx.reply("✅ New Admin assigned successfully!", { parse_mode: "HTML", ...adminControlMenu }).catch(()=>{});
        } else {
            await ctx.reply("❌ Invalid User ID or already an Admin.", { parse_mode: "HTML", ...adminControlMenu }).catch(()=>{});
        }
        delete adminState[userId];
    }
    else if (state.step === "broadcast" && ctx.message.text) {
        await ctx.reply("📢 Sending global broadcast message...", { parse_mode: "HTML" }).catch(()=>{});
        for (const uId of dbData.users) { 
            try { await bot.api.sendMessage(uId, ctx.message.text); } catch(e){} 
        }
        await ctx.reply("📢 Broadcast completed successfully!", { parse_mode: "HTML", ...adminControlMenu }).catch(()=>{});
        delete adminState[userId];
    }
    else if (state.step === "input_country" && ctx.message.text) {
        state.country = ctx.message.text.trim();
        state.step = "input_rate";
        await ctx.reply(`💵 Enter BDT Rate per OTP for \({escapeHtml(state.service)} (\){escapeHtml(state.country)}):\n(e.g., 0.50 or 10.00)`, { parse_mode: "HTML" }).catch(()=>{});
    }
    else if (state.step === "input_rate" && ctx.message.text) {
        const rate = parseFloat(ctx.message.text.trim());
        if (isNaN(rate) || rate <= 0) {
            await ctx.reply("❌ Invalid rate! Enter numeric value.", { parse_mode: "HTML" }).catch(()=>{});
            return;
        }
        const rateKey = `\({state.service}_\){state.country}`;
        dbData.serviceRates[rateKey] = rate;
        dbData.serviceRates[state.service] = rate;
        writeDb(dbData);

        state.step = "input_numbers";
        await ctx.reply(`✅ Rate saved: ৳${rate.toFixed(2)} BDT\n\n🔢 Now paste your phone numbers list or upload a file:`, { parse_mode: "HTML" }).catch(()=>{});
    }
    else if (state.step === "input_numbers") {
        let textData = ctx.message.text || "";
        if (ctx.message.document) {
            try {
                const file = await ctx.getFile();
                const response = await fetch(`https://api.telegram.org/file/bot\({BOT_TOKEN}/\){file.file_path}`);
                textData = await response.text();
            } catch (e) {}
        }
        await processNumbersWithCountry(ctx, textData, state.service, state.country);
        delete adminState[userId];
    }
});

bot.catch((err) => {
    console.error("Grammy error:", err);
});

bot.start({
    onStart: async (info) => {
        botInfo = info; 
        console.log(`🚀 Telegram OTP Bot System Online (@${info.username})!`);

        await bot.api.setMyCommands([
            { command: "start", description: "🚀 Launch User Dashboard" },
            { command: "adminmenu", description: "👑 Dynamic System Settings" },
            { command: "admin", description: "⚙️ Admin Control Panel" }
        ]).catch((e) => console.error("Commands set failed:", e.message));

        startGlobalPanelListener(); 
    }
});