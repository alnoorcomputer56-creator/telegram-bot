const { Bot, InlineKeyboard } = require("grammy");
const { fetch } = require("undici");
const fs = require("fs");
const path = require("path");

// --- Environment Variables ---
const BOT_TOKEN = process.env.BOT_TOKEN; 
const MASTER_ADMIN = parseInt(process.env.MASTER_ADMIN) || 6916044653; 
const OTP_GROUP_ID = process.env.OTP_GROUP_ID || "-1004463922857"; 
const IVASMS_API_KEY = process.env.IVASMS_API_KEY || "sk_live_ir4YttZKGOSg8F9t2VjiPHOsw7eXXE9PlHF1qC1O";
const IVASMS_BASE_URL = "https://www.ivasms.com/api/v1";

// 🔗 লিংকসমূহ
const OTP_GROUP_LINK = process.env.OTP_GROUP_LINK || "https://t.me/fast_otp0";     
const CHANNEL_CHAT_LINK = process.env.CHANNEL_CHAT_LINK || "https://t.me/fastotpchat"; 

if (!BOT_TOKEN) {
    console.error("ERROR: BOT_TOKEN is missing in Environment Variables!");
    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
const DB_FILE = path.join(__dirname, "bot_database.json");

let activeOtpCheckers = {};
let botInfo = null;
let adminState = {}; 
let userState = {};
let userActiveMessages = {}; 
let ivasmsRateLimitUntil = 0;
let ivasmsLastMessagesCache = { ts: 0, data: [] };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
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
    return `${prefix}FAST${suffix}`;
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

function readDb() {
    if (!fs.existsSync(DB_FILE)) {
        const defaultServices = ["Telegram", "WhatsApp", "Imo", "Instagram", "Facebook", "TikTok", "Uber"];
        const defaultApis = [
            "https://panel.lamix.org/api/v1/messages?token=F03xiioltLwvYbIlS470UQ9XuVWkp-KlqC5f_r2yXhs",
            "http://169.58.213.56/crapi/ALEIUS/viewstats?token=dsglfRknOC2y_94AAD164B4ED"
        ];
        fs.writeFileSync(DB_FILE, JSON.stringify({ 
            numbers: [], 
            admins: [MASTER_ADMIN], 
            users: [], 
            services: defaultServices, 
            serviceRates: {}, 
            balances: {}, 
            withdrawals: [],
            sentOtps: [], 
            apiUrls: defaultApis,
            ivasmsApiKey: IVASMS_API_KEY,
            ivasmsBaseUrl: IVASMS_BASE_URL,
            checkDelay: 4000,
            numberQty: 1, 
            customOtpMsg: "🚀 <b>FAST OTP RECEIVED!</b>\n\n📱 <code>{service}</code> | {flag} <code>{country}</code> | 📞 <code>+{phone}</code>\n\n💬 <i>\"{message}\"</i>\n\n👉 <code>{code}</code> <i>(Tap to Copy)</i>\n\n💰 <b>+৳{reward} BDT added to your balance!</b>"
        }, null, 2));
    }
    try {
        const data = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
        if (!data.admins) data.admins = [MASTER_ADMIN];
        if (!data.admins.includes(MASTER_ADMIN)) data.admins.push(MASTER_ADMIN);
        if (!data.users) data.users = [];
        if (!data.services) data.services = ["Telegram", "WhatsApp", "Imo", "Instagram", "Facebook", "TikTok", "Uber"];
        if (!data.serviceRates) data.serviceRates = {};
        if (!data.balances) data.balances = {};
        if (!data.withdrawals) data.withdrawals = [];
        if (!data.sentOtps) data.sentOtps = [];
        if (!data.apiUrls || data.apiUrls.length === 0) data.apiUrls = [
            "https://panel.lamix.org/api/v1/messages?token=F03xiioltLwvYbIlS470UQ9XuVWkp-KlqC5f_r2yXhs",
            "http://169.58.213.56/crapi/ALEIUS/viewstats?token=dsglfRknOC2y_94AAD164B4ED"
        ];
        if (!data.ivasmsApiKey) data.ivasmsApiKey = IVASMS_API_KEY;
        if (!data.ivasmsBaseUrl) data.ivasmsBaseUrl = IVASMS_BASE_URL;
        if (!data.checkDelay) data.checkDelay = 4000;
        if (!data.numberQty) data.numberQty = 1;
        if (!data.customOtpMsg) data.customOtpMsg = "🚀 <b>FAST OTP RECEIVED!</b>\n\n📱 <code>{service}</code> | {flag} <code>{country}</code> | 📞 <code>+{phone}</code>\n\n💬 <i>\"{message}\"</i>\n\n👉 <code>{code}</code> <i>(Tap to Copy)</i>\n\n💰 <b>+৳{reward} BDT added to your balance!</b>";
        return data;
    } catch (e) {
        return { numbers: [], admins: [MASTER_ADMIN], users: [], services: ["Telegram", "WhatsApp", "Imo", "Instagram", "Facebook", "TikTok", "Uber"], serviceRates: {}, balances: {}, withdrawals: [], sentOtps: [], apiUrls: ["https://panel.lamix.org/api/v1/messages?token=F03xiioltLwvYbIlS470UQ9XuVWkp-KlqC5f_r2yXhs"], ivasmsApiKey: IVASMS_API_KEY, ivasmsBaseUrl: IVASMS_BASE_URL, checkDelay: 4000, numberQty: 1, customOtpMsg: "🚀 <b>FAST OTP RECEIVED!</b>\n\n📱 <code>{service}</code> | {flag} <code>{country}</code> | 📞 <code>+{phone}</code>\n\n💬 <i>\"{message}\"</i>\n\n👉 <code>{code}</code> <i>(Tap to Copy)</i>\n\n💰 <b>+৳{reward} BDT added to your balance!</b>" };
    }
}

function writeDb(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch(e) {
        console.error("Database write error:", e);
    }
}

// --- iVASMS API Helper Functions ---
async function ivasmsRequest(endpoint, params = {}) {
    const dbData = readDb();
    const apiKey = (dbData.ivasmsApiKey || IVASMS_API_KEY || "").trim();
    const baseUrl = (dbData.ivasmsBaseUrl || IVASMS_BASE_URL).replace(/\/+$/, "");

    if (!apiKey) {
        return { ok: false, error: "iVASMS API key missing." };
    }

    const now = Date.now();
    if (now < ivasmsRateLimitUntil) {
        const waitSec = Math.ceil((ivasmsRateLimitUntil - now) / 1000);
        return { ok: false, rateLimited: true, retryAfter: waitSec, error: `Rate limit active. Retry after ${waitSec}s.` };
    }

    const url = new URL(`${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
            url.searchParams.set(k, String(v));
        }
    });

    try {
        const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Accept": "application/json"
            }
        });

        const data = await response.json().catch(() => ({}));

        if (response.status === 429) {
            const retryHeader = parseInt(response.headers.get("retry-after") || "0", 10);
            const retryBody = parseInt(data?.error?.retry_after || data?.retry_after || "0", 10);
            const retrySec = retryHeader || retryBody || 60;
            ivasmsRateLimitUntil = Date.now() + retrySec * 1000;
            return {
                ok: false,
                status: 429,
                rateLimited: true,
                retryAfter: retrySec,
                error: data?.error?.message || `Rate limit exceeded. Retry after ${retrySec} seconds.`
            };
        }

        if (!response.ok || data?.success === false) {
            return {
                ok: false,
                status: response.status,
                code: data?.error?.code || "API_ERROR",
                error: data?.error?.message || `HTTP ${response.status} error from iVASMS API`
            };
        }

        return { ok: true, data };
    } catch (err) {
        return { ok: false, error: err.message || "Network error contacting iVASMS API" };
    }
}

async function getIvasmsNumbers(options = {}) {
    return await ivasmsRequest("/numbers", {
        range_name: options.range_name,
        per_page: options.per_page || 20,
        page: options.page || 1
    });
}

async function getIvasmsStatistics(options = {}) {
    return await ivasmsRequest("/statistics", {
        start_date: options.start_date,
        end_date: options.end_date,
        group_by: options.group_by || "day"
    });
}

async function getIvasmsMessages(options = {}) {
    return await ivasmsRequest("/messages", {
        number: options.number,
        start_date: options.start_date,
        end_date: options.end_date,
        per_page: options.per_page || 50
    });
}

async function getCachedIvasmsMessagesForPolling() {
    const now = Date.now();
    // Respect 10 requests/minute account rate limit across all iVASMS endpoints
    if (now < ivasmsRateLimitUntil) {
        return ivasmsLastMessagesCache.data || [];
    }
    if (now - ivasmsLastMessagesCache.ts < 8000 && Array.isArray(ivasmsLastMessagesCache.data)) {
        return ivasmsLastMessagesCache.data;
    }

    const yesterdayUtc = new Date(now - 86400 * 1000).toISOString().slice(0, 10);
    const res = await getIvasmsMessages({ per_page: 200, start_date: yesterdayUtc });
    if (res.ok && Array.isArray(res.data?.data)) {
        ivasmsLastMessagesCache = { ts: now, data: res.data.data };
        return res.data.data;
    }
    return ivasmsLastMessagesCache.data || [];
}

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
            [{ text: "📢 Admin Control" }, { text: "🌐 iVASMS Panel" }],
            [{ text: "👤 Switch to User Menu" }]
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

function getIvasmsMenuKeyboard() {
    return new InlineKeyboard()
        .text("📞 Numbers", "iv_numbers").text("📈 Statistics", "iv_stats").row()
        .text("✉️ Messages", "iv_messages").text("📥 Sync Numbers to Bot", "iv_sync_prompt").row()
        .text("🔑 Update API Key", "iv_set_key");
}

function getServicesKeyboard(prefix) {
    const dbData = readDb();
    const keyboard = new InlineKeyboard();
    dbData.services.forEach((service, index) => {
        const availableCount = dbData.numbers.filter(n => n.service === service && n.status === "available").length;
        keyboard.text(`${service} (${availableCount})`, `${prefix}_${service}`);
        if (index % 2 !== 0) keyboard.row();
    });
    return keyboard;
}

bot.command("start", async (ctx) => {
    delete adminState[ctx.from.id];
    delete userState[ctx.from.id];
    const dbData = readDb();
    const userId = ctx.from.id;

    if (!dbData.users.includes(userId)) dbData.users.push(userId);
    if (dbData.balances[userId] === undefined) dbData.balances[userId] = 0.00;
    writeDb(dbData);

    if (dbData.admins.includes(userId)) {
        await ctx.reply("⚙️ অ্যাডমিন প্যানেলে আপনাকে স্বাগতম!", adminReplyMenu).catch(()=>{});
    } else {
        await ctx.reply("📱 ইউজার প্যানেলে আপনাকে স্বাগতম।", userReplyMenu).catch(()=>{});
    }
});

bot.command("adminmenu", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;

    const keyboard = new InlineKeyboard()
        .text("➕ Add API URL", "adm_add_api").text("❌ Delete API URL", "adm_del_api").row()
        .text("⏱️ Set Delay", "adm_set_delay").text("✏️ Modify OTP Msg", "adm_mod_msg").row()
        .text(`🔢 Get Number Quantity (${dbData.numberQty || 1})`, "adm_set_number_qty").row()
        .text("🌐 iVASMS API Key", "iv_set_key").text("📊 iVASMS Stats", "iv_stats").row()
        .text("📋 View Settings", "adm_view_config");

    await ctx.reply("🔑 <b>Admin System Settings Panel</b>\n\nনিচের অপশনগুলো থেকে কনফিগার করুন:", {
        reply_markup: keyboard,
        parse_mode: "HTML"
    }).catch(()=>{});
});

bot.callbackQuery("adm_set_number_qty", async (ctx) => {
    adminState[ctx.from.id] = { step: "awaiting_number_qty" };
    await ctx.editMessageText("🔢 ইউজার 'Get Number'-এ ক্লিক করলে একসাথে কয়টি নম্বর পাবে তা সেট করুন:\n(যেমন: 1, 3, বা 5)").catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.callbackQuery("adm_add_api", async (ctx) => {
    adminState[ctx.from.id] = { step: "awaiting_api_url" };
    await ctx.editMessageText("➕ নতুন API URL টি লিঙ্ক আকারে লিখে পাঠান:").catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.callbackQuery("adm_del_api", async (ctx) => {
    const dbData = readDb();
    const keyboard = new InlineKeyboard();
    dbData.apiUrls.forEach((url, idx) => {
        keyboard.text(`❌ Remove API #${idx + 1}`, `delapi_${idx}`).row();
    });
    await ctx.editMessageText("🗑️ যে API URL টি ডিলিট করতে চান তা বেছে নিন:", { reply_markup: keyboard }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.callbackQuery(/^delapi_/, async (ctx) => {
    const idx = parseInt(ctx.callbackQuery.data.split("_")[1]);
    let dbData = readDb();
    if (dbData.apiUrls[idx]) {
        const removed = dbData.apiUrls.splice(idx, 1);
        writeDb(dbData);
        await ctx.editMessageText(`✅ API URL ডিলিট করা হয়েছে:\n<code>${removed[0]}</code>`, { parse_mode: "HTML" }).catch(()=>{});
    }
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.callbackQuery("adm_set_delay", async (ctx) => {
    adminState[ctx.from.id] = { step: "awaiting_delay_ms" };
    await ctx.editMessageText("⏱️ API চেক করার ডিলে সময় (Millisecond) দিন:\n(যেমন: 2000 = 2s, 4000 = 4s)").catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.callbackQuery("adm_mod_msg", async (ctx) => {
    adminState[ctx.from.id] = { step: "awaiting_otp_template" };
    const helpMsg = `✏️ <b>কাস্টম ওটিপি মেসেজ টেমপ্লেট পরিবর্তন করুন</b>\n\n` +
                    `ব্যবহারযোগ্য ট্যাগসমূহ:\n` +
                    `• <code>{service}</code> - সার্ভিস নাম\n` +
                    `• <code>{country}</code> - দেশের নাম\n` +
                    `• <code>{flag}</code> - পতাকার ইমোজি\n` +
                    `• <code>{phone}</code> - ফোন নম্বর\n` +
                    `• <code>{message}</code> - ফুল মেসেজ\n` +
                    `• <code>{code}</code> - ওটিপি কোড\n` +
                    `• <code>{reward}</code> - প্রাপ্ত বিডিটি\n\n` +
                    `নতুন ফরম্যাট টাইপ করে লিখে পাঠান:`;
    await ctx.editMessageText(helpMsg, { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.callbackQuery("adm_view_config", async (ctx) => {
    const dbData = readDb();
    const maskedKey = dbData.ivasmsApiKey ? `${dbData.ivasmsApiKey.slice(0, 12)}...${dbData.ivasmsApiKey.slice(-4)}` : "Not Set";
    let text = `⚙️ <b>বর্তমান সিস্টেম কনফিগারেশন</b>\n\n`;
    text += `⏱️ <b>Polling Delay:</b> <code>${dbData.checkDelay} ms</code>\n`;
    text += `🔢 <b>Get Number Qty:</b> <code>${dbData.numberQty || 1}</code>\n`;
    text += `🌐 <b>iVASMS Base URL:</b> <code>${escapeHtml(dbData.ivasmsBaseUrl || IVASMS_BASE_URL)}</code>\n`;
    text += `🔑 <b>iVASMS API Key:</b> <code>${escapeHtml(maskedKey)}</code>\n\n`;
    text += `🔗 <b>API URLs (${dbData.apiUrls.length}):</b>\n`;
    dbData.apiUrls.forEach((url, i) => {
        text += `${i + 1}. <code>${url}</code>\n`;
    });
    text += `\n💬 <b>OTP Message Template:</b>\n<i>${escapeHtml(dbData.customOtpMsg)}</i>`;

    await ctx.editMessageText(text, { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

// --- iVASMS Panel Handlers ---
bot.hears("🌐 iVASMS Panel", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;

    const maskedKey = dbData.ivasmsApiKey ? `${dbData.ivasmsApiKey.slice(0, 12)}...${dbData.ivasmsApiKey.slice(-4)}` : "Not Set";
    const text = `🌐 <b>iVASMS Panel Control</b>\n\n` +
                 `🔗 Base URL: <code>${escapeHtml(dbData.ivasmsBaseUrl || IVASMS_BASE_URL)}</code>\n` +
                 `🔑 API Key: <code>${escapeHtml(maskedKey)}</code>\n\n` +
                 `নিচের বাটন থেকে iVASMS নম্বর, স্ট্যাটিস্টিক্স ও মেসেজ দেখুন বা বটে সিংক করুন:`;

    await ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: getIvasmsMenuKeyboard()
    }).catch(()=>{});
});

bot.callbackQuery("iv_set_key", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    adminState[ctx.from.id] = { step: "awaiting_ivasms_key" };
    await ctx.editMessageText("🔑 নতুন iVASMS API Key লিখে পাঠান (যেমন: <code>sk_live_...</code>):", { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.callbackQuery("iv_numbers", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.answerCallbackQuery({ text: "Fetching iVASMS numbers..." }).catch(()=>{});

    const res = await getIvasmsNumbers({ per_page: 20, page: 1 });
    if (!res.ok) {
        await ctx.editMessageText(`❌ iVASMS Numbers Error: <code>${escapeHtml(res.error)}</code>`, {
            parse_mode: "HTML",
            reply_markup: getIvasmsMenuKeyboard()
        }).catch(()=>{});
        return;
    }

    const list = res.data?.data || [];
    const pg = res.data?.pagination || {};
    let msg = `📞 <b>iVASMS Assigned Numbers</b> (Page ${pg.current_page || 1}/${pg.last_page || 1}, Total: ${pg.total || list.length})\n\n`;

    if (list.length === 0) {
        msg += `কোনো নম্বর পাওয়া যায়নি।`;
    } else {
        list.slice(0, 15).forEach((item, idx) => {
            msg += `${idx + 1}. <code>+${escapeHtml(item.number)}</code> | <b>${escapeHtml(item.range_name || "N/A")}</b> | Rate: <code>${item.a2p_rate ?? 0} ${escapeHtml(item.currency || "USD")}</code>\n`;
        });
    }

    await ctx.editMessageText(msg, {
        parse_mode: "HTML",
        reply_markup: getIvasmsMenuKeyboard()
    }).catch(()=>{});
});

bot.callbackQuery("iv_stats", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.answerCallbackQuery({ text: "Fetching iVASMS statistics..." }).catch(()=>{});

    const todayUtc = new Date().toISOString().slice(0, 10);
    const startUtc = new Date(Date.now() - 29 * 86400 * 1000).toISOString().slice(0, 10);

    const res = await getIvasmsStatistics({
        start_date: startUtc,
        end_date: todayUtc,
        group_by: "day"
    });

    if (!res.ok) {
        await ctx.editMessageText(`❌ iVASMS Statistics Error: <code>${escapeHtml(res.error)}</code>`, {
            parse_mode: "HTML",
            reply_markup: getIvasmsMenuKeyboard()
        }).catch(()=>{});
        return;
    }

    const summary = res.data?.summary || {};
    const earningsUsd = summary.earnings?.USD ?? 0;
    let msg = `📈 <b>iVASMS Statistics (${startUtc} to ${todayUtc})</b>\n\n`;
    msg += `📨 Total Messages: <code>${summary.total_messages ?? 0}</code>\n`;
    msg += `🤖 A2P Messages: <code>${summary.a2p_messages ?? 0}</code>\n`;
    msg += `👤 P2P Messages: <code>${summary.p2p_messages ?? 0}</code>\n`;
    msg += `💵 Earnings (USD): <code>$${Number(earningsUsd).toFixed(3)}</code>\n\n`;

    const topNums = res.data?.top_numbers || [];
    if (topNums.length > 0) {
        msg += `🏆 <b>Top Numbers:</b>\n`;
        topNums.slice(0, 5).forEach((n, i) => {
            msg += `${i + 1}. <code>${escapeHtml(n.number)}</code> (${escapeHtml(n.range_name || "")}) - <code>${n.messages}</code> msgs\n`;
        });
    }

    await ctx.editMessageText(msg, {
        parse_mode: "HTML",
        reply_markup: getIvasmsMenuKeyboard()
    }).catch(()=>{});
});

bot.callbackQuery("iv_messages", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.answerCallbackQuery({ text: "Fetching iVASMS messages..." }).catch(()=>{});

    const res = await getIvasmsMessages({ per_page: 10 });
    if (!res.ok) {
        await ctx.editMessageText(`❌ iVASMS Messages Error: <code>${escapeHtml(res.error)}</code>`, {
            parse_mode: "HTML",
            reply_markup: getIvasmsMenuKeyboard()
        }).catch(()=>{});
        return;
    }

    const msgs = res.data?.data || [];
    let msg = `✉️ <b>iVASMS Recent Delivered Messages (${msgs.length})</b>\n\n`;
    if (msgs.length === 0) {
        msg += `আজকের কোনো মেসেজ পাওয়া যায়নি।`;
    } else {
        msgs.slice(0, 8).forEach((m, idx) => {
            msg += `${idx + 1}. <b>${escapeHtml(m.source || "SMS")}</b> | <code>${escapeHtml(m.number || "")}</code>\n`;
            msg += `💬 <i>${escapeHtml(m.message || "")}</i>\n`;
            msg += `🕒 ${escapeHtml(m.received_at || "")}\n\n`;
        });
    }

    await ctx.editMessageText(msg, {
        parse_mode: "HTML",
        reply_markup: getIvasmsMenuKeyboard()
    }).catch(()=>{});
});

bot.callbackQuery("iv_sync_prompt", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    adminState[ctx.from.id] = { step: "awaiting_ivasms_sync_service" };
    await ctx.editMessageText("📥 iVASMS থেকে নম্বর বটে ইমপোর্ট করার জন্য <b>Service Name</b> লিখুন (যেমন: WhatsApp বা Telegram):", { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

// --- User Menu Actions ---
bot.hears("📱 Get Number", async (ctx) => {
    delete userState[ctx.from.id];
    delete adminState[ctx.from.id];
    const userId = ctx.from.id;

    if (userActiveMessages[userId]) {
        try {
            await ctx.api.deleteMessage(userId, userActiveMessages[userId]);
        } catch (e) {}
        delete userActiveMessages[userId];
    }

    let dbData = readDb();
    dbData.numbers.forEach(n => {
        if (n.assigned_to === userId && n.status === "used") {
            if (activeOtpCheckers[n.id.toString().trim()]) {
                clearInterval(activeOtpCheckers[n.id.toString().trim()]);
                delete activeOtpCheckers[n.id.toString().trim()];
            }
        }
    });
    dbData.numbers = dbData.numbers.filter(n => !(n.assigned_to === userId && n.status === "used"));
    writeDb(dbData);

    await ctx.reply("Select a Service:", { reply_markup: getServicesKeyboard("user") }).catch(()=>{});
});

bot.hears("💰 Balance", async (ctx) => {
    delete userState[ctx.from.id];
    delete adminState[ctx.from.id];
    const dbData = readDb();
    const userId = ctx.from.id;
    const balance = (dbData.balances[userId] || 0).toFixed(2);

    let text = `💵 <b>Your Current Balance</b>\n\n`;
    text += `👤 User ID: <code>${userId}</code>\n`;
    text += `💰 Balance: <code>৳${balance}</code> BDT\n\n`;
    text += `📌 Minimum withdrawal limit is <b>৳100.00 BDT</b>.`;

    await ctx.reply(text, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("💳 Withdraw", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    const userId = ctx.from.id;
    const balance = dbData.balances[userId] || 0;

    if (balance < 100) {
        await ctx.reply(`❌ <b>উইথড্র করতে ব্যর্থ!</b>\n\nআপনার বর্তমান ব্যালেন্স: <code>৳${balance.toFixed(2)}</code> BDT\nসর্বনিম্ন উইথড্র রিকোয়েস্ট পরিমাণ: <code>৳100.00</code> BDT`, { parse_mode: "HTML" }).catch(()=>{});
        return;
    }

    userState[userId] = { step: "awaiting_binance_id" };
    await ctx.reply(`💳 <b>Withdrawal Request</b>\n\nআপনার বর্তমান ব্যালেন্স: <code>৳${balance.toFixed(2)}</code> BDT\n\nঅনুগ্রহ করে আপনার <b>Binance Pay ID / bKash / Nagad Number</b> টি লিখে পাঠান:`, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("🚦 Live Traffic", async (ctx) => {
    delete userState[ctx.from.id];
    delete adminState[ctx.from.id];
    const dbData = readDb();
    const availableCount = dbData.numbers.filter(n => n.status === "available").length;
    const activeCheckersCount = Object.keys(activeOtpCheckers).length;
    
    let infoText = `🚦 <b>Live Traffic Status</b>\n\n`;
    infoText += `🟢 Available Numbers in Stock: <code>${availableCount}</code>\n`;
    infoText += `⚡ Active OTP Requests Right Now: <code>${activeCheckersCount}</code>\n\n`;
    infoText += `🚀 Bot is running smooth and ready to deliver numbers!`;
    
    await ctx.reply(infoText, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("📊 Status", async (ctx) => {
    delete userState[ctx.from.id];
    delete adminState[ctx.from.id];
    const dbData = readDb();
    const totalNumbers = dbData.numbers.length;
    const availableNumbers = dbData.numbers.filter(n => n.status === "available").length;
    const usedNumbers = dbData.numbers.filter(n => n.status === "used").length;
    const totalUsers = dbData.users.length;
    const totalServices = dbData.services.length;

    let statusText = `📊 <b>Bot Statistics Overview</b>\n\n`;
    statusText += `👥 Total Users: <code>${totalUsers}</code>\n`;
    statusText += `🛠️ Total Services Active: <code>${totalServices}</code>\n`;
    statusText += `📱 Total Numbers in DB: <code>${totalNumbers}</code>\n`;
    statusText += `🟩 Available Numbers: <code>${availableNumbers}</code>\n`;
    statusText += `🟥 Used/Processing Numbers: <code>${usedNumbers}</code>\n`;

    await ctx.reply(statusText, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("⚙️ Switch to Admin Menu", async (ctx) => {
    delete userState[ctx.from.id];
    delete adminState[ctx.from.id];
    const userId = ctx.from.id;
    const dbData = readDb();
    if (dbData.admins.includes(userId) || userId === MASTER_ADMIN) {
        await ctx.reply("⚙️ অ্যাডমিন প্যানেলে আপনাকে স্বাগতম!", adminReplyMenu).catch(()=>{});
    } else {
        await ctx.reply("❌ আপনি এই বটের অ্যাডমিন নন!").catch(()=>{});
    }
});

// --- Admin Sub-Menus ---
bot.hears("🛠️ Service Settings", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("🛠️ <b>Service Settings Menu:</b>\nনিচের অপশনগুলো বেছে নিন:", { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
});

bot.hears("📢 Admin Control", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("📢 <b>Admin Control Panel:</b>\nনিচের অপশনগুলো বেছে নিন:", { parse_mode: "HTML", reply_markup: adminControlMenu.reply_markup }).catch(()=>{});
});

bot.hears("« Back to Main Menu", async (ctx) => {
    delete adminState[ctx.from.id];
    delete userState[ctx.from.id];
    const userId = ctx.from.id;
    const dbData = readDb();
    if (dbData.admins.includes(userId)) {
        await ctx.reply("🔙 মূল অ্যাডমিন মেনুতে ফিরে আসা হয়েছে।", adminReplyMenu).catch(()=>{});
    } else {
        await ctx.reply("🔙 মূল ইউজার মেনুতে ফিরে আসা হয়েছে।", userReplyMenu).catch(()=>{});
    }
});

bot.hears("📋 List Services", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    let text = `📋 <b>Active Services & Rates</b>\n\n`;
    dbData.services.forEach((s, idx) => {
        const rate = dbData.serviceRates[s] ? `৳${dbData.serviceRates[s].toFixed(2)} BDT` : "Default (৳5.00)";
        text += `${idx + 1}. <b>${escapeHtml(s)}</b> - Rate: <code>${rate}</code>\n`;
    });
    
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
});

bot.hears("ℹ️ Help / Guide", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    let helpText = `ℹ️ <b>Admin Help Guide</b>\n\n`;
    helpText += `1️⃣ <b>Add Number:</b> নম্বর বাল্ক ফরম্যাটে বা টেক্সট ফাইলে আপলোড করুন।\n`;
    helpText += `2️⃣ <b>Modify Rate:</b> সার্ভিস অথবা সার্ভিস+কান্ট্রি প্রতি ওটিপি রেট সেট করুন।\n`;
    helpText += `3️⃣ <b>Withdraw Requests:</b> পেন্ডিং উইথড্র রিকোয়েস্ট চেক ও প্রসেস করুন।\n`;
    helpText += `4️⃣ <b>/adminmenu:</b> API, Delay, Number Quantity এবং Custom Message ম্যানেজ করুন।\n`;
    helpText += `5️⃣ <b>iVASMS Panel:</b> iVASMS নম্বর, স্ট্যাটিস্টিক্স, মেসেজ ও নম্বর সিংক করুন।\n`;

    await ctx.reply(helpText, { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
});

bot.hears("👤 Admin List", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;

    let adminText = `👤 <b>Admin List (${dbData.admins.length})</b>\n\n`;
    dbData.admins.forEach((adminId, index) => {
        adminText += `${index + 1}. User ID: <code>${adminId}</code> ${adminId === MASTER_ADMIN ? "(Master Admin)" : ""}\n`;
    });

    await ctx.reply(adminText, { parse_mode: "HTML", reply_markup: adminControlMenu.reply_markup }).catch(()=>{});
});

bot.hears("🔄 Reset User State", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    userState = {};
    adminState = {};
    await ctx.reply("✅ বটের সমস্ত ইউজার এবং অ্যাডমিন স্টেট রিসেট করা হয়েছে।", adminControlMenu).catch(()=>{});
});

bot.hears("📊 System Stats", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    const pendingWd = dbData.withdrawals.filter(w => w.status === "pending").length;
    
    let sysText = `🖥️ <b>System Overview Stats</b>\n\n`;
    sysText += `👥 Registered Users: <code>${dbData.users.length}</code>\n`;
    sysText += `👑 Total Admins: <code>${dbData.admins.length}</code>\n`;
    sysText += `⏳ Pending Withdrawals: <code>${pendingWd}</code>\n`;
    sysText += `⚡ Active Trackers: <code>${Object.keys(activeOtpCheckers).length}</code>\n`;

    await ctx.reply(sysText, { parse_mode: "HTML", reply_markup: adminControlMenu.reply_markup }).catch(()=>{});
});

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
        const text = `❌ দুঃখিত, এই মুহূর্তে ${serviceName} সার্ভিসের কোনো নম্বর খালি নেই।`;
        try { await ctx.editMessageText(text); } catch(e) { await ctx.reply(text).catch(()=>{}); }
        return;
    }

    const keyboard = new InlineKeyboard();
    countries.forEach((country) => {
        const flag = getCountryFlag(country);
        
        let match = country.match(/\(([A-Z]{2})\)/);
        let isoCode = match ? match[1] : "BD";
        
        const rateKey = `${serviceName}_${country}`;
        const rate = dbData.serviceRates[rateKey] || dbData.serviceRates[serviceName] || 5.00;
        
        const btnLabel = `${flag} ${country.replace(/\s*\([A-Z]{2}\)\s*/g, "").trim()} (${isoCode}) | ৳${rate.toFixed(2)} | Stock: ${counts[country]}`;
        
        keyboard.text(btnLabel, `getnum_${serviceName}_${encodeURIComponent(country)}`).row();
    });

    const msg = `🌍 <b>${serviceName}</b> সার্ভিসের জন্য একটি Country সিলেক্ট করুন:`;
    try { await ctx.editMessageText(msg, { reply_markup: keyboard, parse_mode: "HTML" }); } catch(e) { await ctx.reply(msg, { reply_markup: keyboard, parse_mode: "HTML" }).catch(()=>{}); }
}

bot.callbackQuery(/^user_/, async (ctx) => {
    const serviceName = ctx.callbackQuery.data.split("_")[1];
    await showCountriesList(ctx, serviceName);
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.callbackQuery(/^getnum_/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split("_");
    const service = parts[1];
    const country = decodeURIComponent(parts[2]);
    await deliverNumbers(ctx, service, country, true, false); 
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.callbackQuery(/^refresh_/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split("_");
    const service = parts[1];
    const country = decodeURIComponent(parts[2]);
    
    let dbData = readDb();
    const userId = ctx.from.id;
    
    dbData.numbers.forEach(n => {
        if (n.service === service && n.country === country && n.assigned_to === userId && n.status === "used") {
            if (activeOtpCheckers[n.id.toString().trim()]) {
                clearInterval(activeOtpCheckers[n.id.toString().trim()]);
                delete activeOtpCheckers[n.id.toString().trim()];
            }
        }
    });

    dbData.numbers = dbData.numbers.filter(n => !(n.service === service && n.country === country && n.assigned_to === userId && n.status === "used"));
    writeDb(dbData);

    await deliverNumbers(ctx, service, country, true, true);
    ctx.answerCallbackQuery({ text: "🗑️ Old number removed & 🆕 new assigned!" }).catch(()=>{});
});

bot.callbackQuery(/^toggleprefix_/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split("_");
    const service = parts[1];
    const country = decodeURIComponent(parts[2]);
    const currentHasPrefix = parts[3] === "1"; 

    await deliverNumbers(ctx, service, country, !currentHasPrefix, false);
    ctx.answerCallbackQuery().catch(()=>{});
});

async function deliverNumbers(ctx, service, country, showWithPrefix = true, isRefresh = false) {
    let dbData = readDb();
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

    if (selectedNumbers.length === 0 || isRefresh) {
        const availableNumbers = dbData.numbers.filter(
            n => n.service === service && 
            n.country === country && 
            n.status === "available"
        );

        if (availableNumbers.length === 0) {
            const failText = `❌ দুঃখিত, এই মুহূর্তে ${service} (${country}) সার্ভিসের কোনো নতুন নম্বর খালি নেই।`;
            try {
                await ctx.editMessageText(failText).catch(()=>{});
            } catch(e) {
                await ctx.reply(failText).catch(()=>{});
            }
            return;
        }

        selectedNumbers = availableNumbers.slice(0, qty);
        selectedNumbers.forEach((numObj) => {
            numObj.status = "used";
            numObj.assigned_to = userId;
            const info = parsePhoneNumberInfo(numObj.phone_number);
            startLiveOtpCheck(numObj.id, info.fullNumberWithPlus, service, userId, numObj.country);
        });
        writeDb(dbData);
    }

    let deliveredText = `${getCountryFlag(country)} <b>Country:</b> ${escapeHtml(country)}\n`;
    deliveredText += `🛠️ <b>Service:</b> ${escapeHtml(service)}\n\n`;
    deliveredText += `⏳ <b>Waiting for OTP...</b>`;

    const actionKeyboard = new InlineKeyboard();

    selectedNumbers.forEach((numObj) => {
        const info = parsePhoneNumberInfo(numObj.phone_number);
        const numberToDisplay = showWithPrefix ? info.fullNumberWithPlus : info.nationalNumber;
        actionKeyboard.copyText(numberToDisplay, numberToDisplay).row();
    });

    const toggleLabel = showWithPrefix ? "✂️ Remove Prefix" : "➕ Add Prefix";
    const prefixStateFlag = showWithPrefix ? "1" : "0";

    actionKeyboard.text(toggleLabel, `toggleprefix_${service}_${encodeURIComponent(country)}_${prefixStateFlag}`).row();
    actionKeyboard.text("🔄 Refresh Number", `refresh_${service}_${encodeURIComponent(country)}`).row();
    actionKeyboard.text("🌐 Change Country", `user_${service}`).row();
    actionKeyboard.url("🔑 OTP Group ↗️", OTP_GROUP_LINK);

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

async function processOtpRecordActivation(activation, { cleanUserPhone = null, serviceName = null, fallbackUserId = null, countryName = null, cleanId = null, isGlobal = false }) {
    let dbData = readDb();

    const rawMessage = activation ? (activation.content || activation.message) : null;
    let rawPhone = (activation.number || activation.num || (cleanUserPhone || "Unknown")).toString();
    let phoneNumber = rawPhone.replace(/[^\d]/g, "");

    if (!isGlobal && cleanUserPhone) {
        if (phoneNumber.length < 7 || cleanUserPhone.length < 7) return;
        const p1 = phoneNumber.substring(phoneNumber.length - 7);
        const p2 = cleanUserPhone.substring(cleanUserPhone.length - 7);
        if (p1 !== p2) return;
        phoneNumber = cleanUserPhone;
    }

    if (!rawMessage) return;
    const otpCode = extractOtp(rawMessage);
    if (!otpCode) return;

    if (isGlobal) {
        const uniqueKey = `global_${phoneNumber}_${otpCode}`;
        if (dbData.sentOtps.includes(uniqueKey)) return;

        dbData.sentOtps.push(uniqueKey);
        if (dbData.sentOtps.length > 500) dbData.sentOtps.shift();
        writeDb(dbData);

        const detectedGlobalService = activation.cli || activation.service || activation.source || "Global";
        const maskedGlobalPhone = phoneNumber !== "Unknown" ? maskPhoneNumber(phoneNumber) : "Unknown";
        const safeService = escapeHtml(String(detectedGlobalService).toUpperCase());
        const safeRawMsg = escapeHtml(rawMessage);

        const globalMessage = `📢 <b>প্যানেল ওটিপি নোটিফিকেশন!</b> (Global Alert)\n📦 সার্ভিস: ${safeService}\n📞 নম্বর: <code>${maskedGlobalPhone}</code>\n\n💬 মেসেজ: <i>${safeRawMsg}</i>`;
        const botUsername = botInfo ? botInfo.username : "Bot";

        const inlineKeyboard = new InlineKeyboard()
            .copyText(`${otpCode}`, `${otpCode}`).row()
            .url(`👀 Number Bot`, `https://t.me/${botUsername}`)
            .url(`✉️ Channel`, CHANNEL_CHAT_LINK);

        try {
            await bot.api.sendMessage(OTP_GROUP_ID, globalMessage, { reply_markup: inlineKeyboard, parse_mode: "HTML" });
            await sleep(1500);
        } catch (e) {
            if (e.description && e.description.includes("Too Many Requests")) {
                await sleep(6000);
            }
        }
        return;
    }

    const uniqueKey = `${phoneNumber}_${otpCode}_${rawMessage}`;
    if (dbData.sentOtps.includes(uniqueKey)) return;

    dbData.sentOtps.push(uniqueKey);
    if (dbData.sentOtps.length > 500) {
        dbData.sentOtps.shift();
    }

    const foundNum = cleanId ? dbData.numbers.find(n => n.id.toString() === cleanId) : null;
    const finalUserId = foundNum && foundNum.assigned_to ? foundNum.assigned_to : fallbackUserId;
    const resolvedService = serviceName || (foundNum && foundNum.service) || "Service";
    const resolvedCountry = countryName || (foundNum && foundNum.country) || "Global";

    const rateKey = `${resolvedService}_${resolvedCountry}`;
    const otpReward = dbData.serviceRates[rateKey] || dbData.serviceRates[resolvedService] || 5.00;

    if (!dbData.balances[finalUserId]) dbData.balances[finalUserId] = 0;
    dbData.balances[finalUserId] += otpReward;

    writeDb(dbData);

    const botUsername = botInfo ? botInfo.username : "Bot";
    const detectedService = escapeHtml(activation.cli || activation.source || resolvedService);
    const safeRawMessage = escapeHtml(rawMessage);
    const safeCountryName = escapeHtml(resolvedCountry);
    const flag = getCountryFlag(resolvedCountry);

    let baseOtpTemplate = dbData.customOtpMsg || "🚀 <b>FAST OTP RECEIVED!</b>\n\n📱 <code>{service}</code> | {flag} <code>{country}</code> | 📞 <code>+{phone}</code>\n\n💬 <i>\"{message}\"</i>\n\n👉 <code>{code}</code> <i>(Tap to Copy)</i>\n\n💰 <b>+৳{reward} BDT added to your balance!</b>";

    let userSuccessMessage = baseOtpTemplate
        .replace(/{service}/g, detectedService)
        .replace(/{country}/g, safeCountryName)
        .replace(/{flag}/g, flag)
        .replace(/{phone}/g, phoneNumber)
        .replace(/{message}/g, safeRawMessage)
        .replace(/{code}/g, otpCode)
        .replace(/{reward}/g, otpReward.toFixed(2));

    const maskedPhone = maskPhoneNumber(phoneNumber);
    let groupSuccessMessage = baseOtpTemplate
        .replace(/{service}/g, detectedService)
        .replace(/{country}/g, safeCountryName)
        .replace(/{flag}/g, flag)
        .replace(/{phone}/g, maskedPhone)
        .replace(/{message}/g, safeRawMessage)
        .replace(/{code}/g, otpCode)
        .replace(/{reward}/g, otpReward.toFixed(2));

    const inlineKeyboardUser = new InlineKeyboard()
        .copyText(`${otpCode}`, `${otpCode}`).row()
        .url(`👀 Number Bot`, `https://t.me/${botUsername}`)
        .url(`✉️ Channel`, CHANNEL_CHAT_LINK);

    await bot.api.sendMessage(finalUserId, userSuccessMessage, { reply_markup: inlineKeyboardUser, parse_mode: "HTML" }).catch((e)=>console.error("User Send Error:", e.message));
    await bot.api.sendMessage(OTP_GROUP_ID, groupSuccessMessage, { reply_markup: inlineKeyboardUser, parse_mode: "HTML" }).catch((e)=>console.error("Group Send Error:", e.message));
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
                    const apiUrl = `${baseUrl}${separator}_cb=${Date.now()}`;

                    const response = await fetch(apiUrl);
                    const json = await response.json();
                    
                    const recordList = (json && (json.records || json.data)) ? (json.records || json.data) : [];
                    
                    if (Array.isArray(recordList)) {
                        for (const activation of recordList) {
                            await processOtpRecordActivation(activation, {
                                cleanUserPhone,
                                serviceName,
                                fallbackUserId,
                                countryName,
                                cleanId,
                                isGlobal: false
                            });
                        }
                    }
                } catch (e) {}
            }

            // Also check iVASMS messages (cached to stay within 10 req/min rate limit)
            if (dbData.ivasmsApiKey) {
                const ivasmsMsgs = await getCachedIvasmsMessagesForPolling();
                for (const m of ivasmsMsgs) {
                    await processOtpRecordActivation(m, {
                        cleanUserPhone,
                        serviceName,
                        fallbackUserId,
                        countryName: countryName || m.range_name || "Global",
                        cleanId,
                        isGlobal: false
                    });
                }
            }
        } catch (error) {}
    }, delayTime);

    activeOtpCheckers[cleanId] = interval;
}

function startGlobalPanelListener() {
    setInterval(async () => {
        try {
            let dbData = readDb();
            const globalApiUrls = dbData.apiUrls && dbData.apiUrls.length > 0 ? dbData.apiUrls : [
                "https://panel.lamix.org/api/v1/messages?token=F03xiioltLwvYbIlS470UQ9XuVWkp-KlqC5f_r2yXhs",
                "http://169.58.213.56/crapi/ALEIUS/viewstats?token=dsglfRknOC2y_94AAD164B4ED"
            ];

            for (const baseUrl of globalApiUrls) {
                try {
                    const separator = baseUrl.includes("?") ? "&" : "?";
                    const globalApiUrl = `${baseUrl}${separator}_cb=${Date.now()}`;

                    const response = await fetch(globalApiUrl);
                    const json = await response.json();

                    const recordList = (json && (json.records || json.data)) ? (json.records || json.data) : [];

                    if (Array.isArray(recordList)) {
                        for (const activation of recordList) {
                            await processOtpRecordActivation(activation, { isGlobal: true });
                        }
                    }
                } catch (err) {}
            }

            if (dbData.ivasmsApiKey) {
                const ivasmsMsgs = await getCachedIvasmsMessagesForPolling();
                for (const m of ivasmsMsgs) {
                    await processOtpRecordActivation(m, { isGlobal: true });
                }
            }
        } catch (err) {}
    }, 12000); 
}

bot.command("admin", async (ctx) => {
    delete adminState[ctx.from.id];
    delete userState[ctx.from.id];
    const dbData = readDb();
    if (dbData.admins.includes(ctx.from.id)) {
        await ctx.reply("⚙️ অ্যাডমিন প্যানেল ওপেন করা হয়েছে।", adminReplyMenu).catch(()=>{});
    } else {
        await ctx.reply("❌ আপনি এই বটের অ্যাডমিন নন!").catch(()=>{});
    }
});

bot.hears("➕ Add Admin", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    adminState[ctx.from.id] = { step: "add_admin" };
    await ctx.reply("👤 যাকে অ্যাডমিন বানাতে চান তার Telegram User ID-টি পাঠান:").catch(()=>{});
});

bot.hears("📢 Broadcast", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    adminState[ctx.from.id] = { step: "broadcast" };
    await ctx.reply("📢 সব ইউজারের ইনবক্সে যে মেসেজটি পাঠাতে চান, তা এখানে টাইপ করে পাঠান:").catch(()=>{});
});

bot.hears("📱 Add Number", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("কোন সার্ভিসের জন্য নম্বর যোগ করতে চান?", { reply_markup: getServicesKeyboard("admin") }).catch(()=>{});
});

bot.hears("🗑️ Delete Service", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("❌ যে সার্ভিসটি সম্পূর্ণভাবে মুছে ফেলতে চান তা সিলেক্ট করুন:", { reply_markup: getServicesKeyboard("delservice") }).catch(()=>{});
});

bot.callbackQuery(/^delservice_/, async (ctx) => {
    let dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const serviceName = ctx.callbackQuery.data.split("_")[1];

    dbData.services = dbData.services.filter(s => s !== serviceName);
    dbData.numbers = dbData.numbers.filter(n => n.service !== serviceName);
    writeDb(dbData);

    await ctx.editMessageText(`✅ <b>${escapeHtml(serviceName)}</b> সার্ভিস এবং এর সব নম্বর ডেটাবেজ থেকে মুছে ফেলা হয়েছে!`, { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.hears("✏️ Modify OTP Rate", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("✏️ যে সার্ভিসের OTP Rate পরিবর্তন করতে চান তা নির্বাচন করুন:", { reply_markup: getServicesKeyboard("ratechange") }).catch(()=>{});
});

bot.callbackQuery(/^ratechange_/, async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const serviceName = ctx.callbackQuery.data.split("_")[1];
    adminState[ctx.from.id] = { service: serviceName, step: "input_new_rate_service" };
    
    await ctx.editMessageText(`✏️ <b>${escapeHtml(serviceName)}</b> এর জন্য প্রতি OTP এর BDT Rate কত দিতে চান? (যেমন: 5.5 বা 10):`, { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.hears("💸 Withdraw Requests", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;

    const pendingRequests = dbData.withdrawals.filter(w => w.status === "pending");

    if (pendingRequests.length === 0) {
        await ctx.reply("✅ কোনো পেন্ডিং উইথড্র রিকোয়েস্ট নেই!").catch(()=>{});
        return;
    }

    let msg = `💸 <b>Pending Withdraw Requests (${pendingRequests.length})</b>\n\n`;
    pendingRequests.forEach((req, idx) => {
        msg += `<b>${idx + 1}. Request ID:</b> <code>${req.id}</code>\n`;
        msg += `👤 <b>User ID:</b> <code>${req.userId}</code>\n`;
        msg += `💰 <b>Amount:</b> <code>৳${req.amount.toFixed(2)}</code> BDT\n`;
        msg += `💳 <b>Account Info:</b> <code>${escapeHtml(req.binanceId)}</code>\n`;
        msg += `📅 <b>Date:</b> ${req.date}\n\n`;
    });

    await ctx.reply(msg, { parse_mode: "HTML" }).catch(()=>{});
});

bot.callbackQuery(/^admin_/, async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const serviceName = ctx.callbackQuery.data.split("_")[1];
    adminState[ctx.from.id] = { service: serviceName, step: "input_country" };
    await ctx.editMessageText(`📦 সার্ভিস সিলেক্ট করেছেন: <b>${escapeHtml(serviceName)}</b>\n\n🌍 এখন দেশের নাম টাইপ করে পাঠান:`, { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.hears("➕ Add Service", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    adminState[ctx.from.id] = { step: "input_new_service" };
    await ctx.reply("➕ যে নতুন সার্ভিসটি যোগ করতে চান তার নাম লিখুন:").catch(()=>{});
});

bot.hears("❌ Delete Numbers", async (ctx) => {
    delete adminState[ctx.from.id];
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("❌ কোন সার্ভিসের নম্বর ডিলিট করতে চান?", { reply_markup: getServicesKeyboard("del") }).catch(()=>{});
});

bot.callbackQuery(/^del_/, async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const serviceName = ctx.callbackQuery.data.split("_")[1];
    const countries = [...new Set(dbData.numbers.filter(n => n.service === serviceName).map(n => n.country))];
    if (countries.length === 0) {
        await ctx.editMessageText(`❌ ${serviceName} সার্ভিসের আন্ডারে কোনো নম্বর নেই।`).catch(()=>{});
        return;
    }
    const keyboard = new InlineKeyboard();
    countries.forEach((country, index) => {
        const flag = getCountryFlag(country);
        keyboard.text(`${flag} ${country}`, `confirmdel_${serviceName}_${encodeURIComponent(country)}`);
        if (index % 2 !== 0) keyboard.row();
    });
    keyboard.row().text("🗑️ সব নম্বর একসাথে মুছুন", `confirmdel_${serviceName}_ALL`);
    await ctx.editMessageText(`❌ কোন দেশের নম্বরগুলো মুছতে চান?`, { reply_markup: keyboard }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
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
    await ctx.editMessageText(`✅ সফলভাবে ডেটাবেজ আপডেট করা হয়েছে।`).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

async function processNumbersWithCountry(ctx, textData, serviceName, typedCountryName) {
    const dbData = readDb();
    const lines = textData.split("\n");
    let addedCount = 0;

    const cleanTypedName = typedCountryName.replace(/\s*\([A-Z]{2}\)\s*/g, "").trim();

    lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine || cleanLine.toLowerCase().includes("range")) return;

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

        if (phone && !dbData.numbers.some(n => n.phone_number === phone)) {
            const info = parsePhoneNumberInfo(phone);
            const formattedCountryName = `${cleanTypedName} (${info.isoCode})`;

            dbData.numbers.push({ 
                id: numId, 
                country: formattedCountryName, 
                service: serviceName, 
                phone_number: phone, 
                status: "available", 
                assigned_to: null 
            });
            addedCount++;
        }
    });

    writeDb(dbData);
    await ctx.reply(`📊 সফলভাবে ${addedCount} টি নম্বর যোগ হয়েছে।`, adminReplyMenu).catch(()=>{});
}

bot.on(["message:text", "message:document"], async (ctx) => {
    const userId = ctx.from.id;
    const userText = ctx.message.text || "";

    if (userText === "👤 Switch to User Menu") {
        delete adminState[userId]; 
        delete userState[userId];
        await ctx.reply("📱 ইউজার প্যানেলে আপনাকে স্বাগতম।", userReplyMenu).catch(()=>{});
        return;
    }

    if (userState[userId] && userState[userId].step === "awaiting_binance_id" && userText) {
        const binanceId = userText.trim();
        let dbData = readDb();
        const currentBalance = dbData.balances[userId] || 0;

        if (currentBalance < 100) {
            await ctx.reply("❌ উইথড্র করার জন্য ন্যূনতম ৳100 BDT ব্যালেন্স থাকতে হবে।", userReplyMenu).catch(()=>{});
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

        await ctx.reply(`✅ <b>উইথড্র রিকোয়েস্ট সফলভাবে জমা হয়েছে!</b>\n\n🆔 Request ID: <code>${reqId}</code>\n💰 Amount: <code>৳${withdrawAmount.toFixed(2)}</code> BDT\n💳 Account Info: <code>${escapeHtml(binanceId)}</code>\n\nঅ্যাডমিন শীঘ্রই এটি ভেরিফাই করে পেমেন্ট বানিয়ে দেবে।`, { parse_mode: "HTML", reply_markup: userReplyMenu.reply_markup }).catch(()=>{});

        for (const adminId of dbData.admins) {
            try {
                await bot.api.sendMessage(adminId, `🔔 <b>নতুন উইথড্র রিকোয়েস্ট এসেছে!</b>\n\n👤 User: <code>${userId}</code>\n💰 Amount: <code>৳${withdrawAmount.toFixed(2)}</code> BDT\n💳 Account Info: <code>${escapeHtml(binanceId)}</code>`, { parse_mode: "HTML" });
            } catch(e){}
        }
        return;
    }

    const state = adminState[userId];
    let dbData = readDb();
    if (!state) return;

    if (state.step === "awaiting_ivasms_key" && ctx.message.text) {
        dbData.ivasmsApiKey = ctx.message.text.trim();
        writeDb(dbData);
        delete adminState[userId];
        await ctx.reply("✅ iVASMS API Key সফলভাবে আপডেট করা হয়েছে!", adminReplyMenu).catch(()=>{});
        return;
    }

    if (state.step === "awaiting_ivasms_sync_service" && ctx.message.text) {
        const targetService = ctx.message.text.trim();
        if (!dbData.services.includes(targetService)) {
            dbData.services.push(targetService);
        }
        delete adminState[userId];

        const res = await getIvasmsNumbers({ per_page: 100, page: 1 });
        if (!res.ok) {
            await ctx.reply(`❌ iVASMS Sync Error: <code>${escapeHtml(res.error)}</code>`, { parse_mode: "HTML", reply_markup: adminReplyMenu.reply_markup }).catch(()=>{});
            return;
        }

        const remoteNumbers = res.data?.data || [];
        let addedCount = 0;
        remoteNumbers.forEach(item => {
            const cleanPhone = String(item.number || "").replace(/[^\d]/g, "");
            if (cleanPhone && !dbData.numbers.some(n => n.phone_number === cleanPhone)) {
                const info = parsePhoneNumberInfo(cleanPhone);
                const countryLabel = item.range_name ? `${escapeHtml(item.range_name)} (${info.isoCode})` : `iVASMS (${info.isoCode})`;
                dbData.numbers.push({
                    id: `ivasms_${cleanPhone}`,
                    country: countryLabel,
                    service: targetService,
                    phone_number: cleanPhone,
                    status: "available",
                    assigned_to: null,
                    provider: "ivasms"
                });
                addedCount++;
            }
        });

        writeDb(dbData);
        await ctx.reply(`✅ iVASMS থেকে <b>${addedCount}</b> টি নতুন নম্বর <b>${escapeHtml(targetService)}</b> সার্ভিসে যুক্ত করা হয়েছে!`, { parse_mode: "HTML", reply_markup: adminReplyMenu.reply_markup }).catch(()=>{});
        return;
    }

    if (state.step === "awaiting_number_qty" && ctx.message.text) {
        const qtyNum = parseInt(ctx.message.text.trim());
        if (!isNaN(qtyNum) && qtyNum > 0) {
            dbData.numberQty = qtyNum;
            writeDb(dbData);
            delete adminState[userId];
            await ctx.reply(`✅ প্রতি ক্লিকে 'Get Number' ডেলিভারি সংখ্যা সেভ করা হয়েছে: <b>${qtyNum} টি</b>`, { parse_mode: "HTML" }).catch(()=>{});
        } else {
            await ctx.reply("❌ সঠিক ইনপুট দিন (যেমন: 1, 3, বা 5)।").catch(()=>{});
        }
        return;
    }

    if (state.step === "awaiting_api_url" && ctx.message.text) {
        const newUrl = ctx.message.text.trim();
        dbData.apiUrls.push(newUrl);
        writeDb(dbData);
        delete adminState[userId];
        await ctx.reply(`✅ নতুন API URL যুক্ত করা হয়েছে:\n<code>${newUrl}</code>`, { parse_mode: "HTML" }).catch(()=>{});
        return;
    }

    if (state.step === "awaiting_delay_ms" && ctx.message.text) {
        const delay = parseInt(ctx.message.text.trim());
        if (!isNaN(delay) && delay >= 1000) {
            dbData.checkDelay = delay;
            writeDb(dbData);
            delete adminState[userId];
            await ctx.reply(`✅ OTP চেক করার ডিলে সেট করা হয়েছে: <b>${delay} ms</b>`, { parse_mode: "HTML" }).catch(()=>{});
        } else {
            await ctx.reply("❌ সঠিক ইনপুট দিন (সর্বনিম্ন 1000 ms)।").catch(()=>{});
        }
        return;
    }

    if (state.step === "awaiting_otp_template" && ctx.message.text) {
        dbData.customOtpMsg = ctx.message.text;
        writeDb(dbData);
        delete adminState[userId];
        await ctx.reply("✅ ওটিপি মেসেজ টেমপ্লেট সফলভাবে কাস্টমাইজ করা হয়েছে! (ইউজার ও গ্রুপ উভয় জায়গায় এপ্লাই হবে)").catch(()=>{});
        return;
    }

    if (state.step === "input_new_service" && ctx.message.text) {
        dbData.services.push(ctx.message.text.trim());
        writeDb(dbData);
        await ctx.reply("✅ নতুন সার্ভিস যুক্ত হয়েছে।", serviceSettingsMenu).catch(()=>{});
        delete adminState[userId];
    }
    else if (state.step === "input_new_rate_service" && ctx.message.text) {
        const rate = parseFloat(ctx.message.text.trim());
        if (!isNaN(rate) && rate > 0) {
            dbData.serviceRates[state.service] = rate;
            writeDb(dbData);
            await ctx.reply(`✅ <b>${escapeHtml(state.service)}</b> সার্ভিসের নতুন OTP Rate set করা হয়েছে: <b>৳${rate.toFixed(2)} BDT</b>`, { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
        } else {
            await ctx.reply("❌ রেট টি সঠিকভাবে লিখুন (যেমন: 5.50)।").catch(()=>{});
        }
        delete adminState[userId];
    }
    else if (state.step === "add_admin" && ctx.message.text) {
        const newAdminId = parseInt(ctx.message.text.trim());
        if (!isNaN(newAdminId) && !dbData.admins.includes(newAdminId)) {
            dbData.admins.push(newAdminId);
            writeDb(dbData);
            await ctx.reply("✅ নতুন অ্যাডমিন যুক্ত হয়েছে।", adminControlMenu).catch(()=>{});
        } else {
            await ctx.reply("❌ আইডি সঠিক নয় অথবা ইতিমধ্যে অ্যাডমিন আছেন।", adminControlMenu).catch(()=>{});
        }
        delete adminState[userId];
    }
    else if (state.step === "broadcast" && ctx.message.text) {
        await ctx.reply("📢 ব্রডকাস্ট পাঠানো শুরু হয়েছে...").catch(()=>{});
        for (const uId of dbData.users) { 
            try { await bot.api.sendMessage(uId, ctx.message.text); } catch(e){} 
        }
        await ctx.reply("📢 ব্রডকাস্ট সম্পন্ন!", adminControlMenu).catch(()=>{});
        delete adminState[userId];
    }
    else if (state.step === "input_country" && ctx.message.text) {
        state.country = ctx.message.text.trim();
        state.step = "input_rate";
        await ctx.reply(`💵 <b>${escapeHtml(state.service)} (${escapeHtml(state.country)})</b> এর জন্য প্রতি OTP তে কত BDT দিতে চান? (যেমন: 5.5 বা 10):`, { parse_mode: "HTML" }).catch(()=>{});
    }
    else if (state.step === "input_rate" && ctx.message.text) {
        const rate = parseFloat(ctx.message.text.trim());
        if (isNaN(rate) || rate <= 0) {
            await ctx.reply("❌ সঠিক সংখ্যা লিখুন (যেমন: 5 বা 6.5)।").catch(()=>{});
            return;
        }
        const rateKey = `${state.service}_${state.country}`;
        dbData.serviceRates[rateKey] = rate;
        dbData.serviceRates[state.service] = rate;
        writeDb(dbData);

        state.step = "input_numbers";
        await ctx.reply(`✅ Per OTP Rate: <b>৳${rate.toFixed(2)} BDT</b> সেভ করা হয়েছে!\n\n🔢 এখন নম্বরগুলো পেস্ট করুন বা ফাইল দিন:`, { parse_mode: "HTML" }).catch(()=>{});
    }
    else if (state.step === "input_numbers") {
        let textData = ctx.message.text || "";
        if (ctx.message.document) {
            try {
                const file = await ctx.getFile();
                const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
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
        console.log(`🚀 Node.js Telegram OTP Bot Online (@${info.username})!`);

        await bot.api.setMyCommands([
            { command: "start", description: "🚀 Start the Bot" },
            { command: "adminmenu", description: "👑 Dynamic System Settings" },
            { command: "admin", description: "⚙️ Admin Keyboard Panel" }
        ]).catch((e) => console.error("Commands set failed:", e.message));

        startGlobalPanelListener(); 
    }
});
