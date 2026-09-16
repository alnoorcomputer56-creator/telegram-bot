const { Bot, InlineKeyboard } = require("grammy");
const { fetch } = require("undici");
const fs = require("fs");
const path = require("path");

// --- Environment Variables ---
const BOT_TOKEN = process.env.BOT_TOKEN; 
const MASTER_ADMIN = parseInt(process.env.MASTER_ADMIN) || 6916044653; 
const OTP_GROUP_ID = process.env.OTP_GROUP_ID || "-1004463922857"; 
const OTP_GROUP_LINK = process.env.OTP_GROUP_LINK || "https://t.me/fast_otp0";     
const CHANNEL_CHAT_LINK = process.env.CHANNEL_CHAT_LINK || "https://t.me/fastotpchat"; 

if (!BOT_TOKEN) {
    console.error("CRITICAL ERROR: BOT_TOKEN is missing!");
    process.exit(1);
}

const bot = new Bot(BOT_TOKEN);
const DB_FILE = path.join(__dirname, "bot_database.json");

let activeOtpCheckers = {};
let botInfo = null;
let adminState = {}; 
let userState = {};
let userActiveMessages = {}; 

// In-Memory Database Cache to prevent disk-blocking crash
let memoryDb = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function escapeHtml(str) {
    if (!str) return "";
    return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Complete list of all countries with dial code and 2-digit ISO code
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
    { name: "Bahamas", iso: "BS", code: "1242" },
    { name: "Bahrain", iso: "BH", code: "973" },
    { name: "Bangladesh", iso: "BD", code: "880" },
    { name: "Barbados", iso: "BB", code: "1246" },
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
    { name: "Central African Republic", iso: "CF", code: "236" },
    { name: "Chad", iso: "TD", code: "235" },
    { name: "Chile", iso: "CL", code: "56" },
    { name: "China", iso: "CN", code: "86" },
    { name: "Colombia", iso: "CO", code: "57" },
    { name: "Comoros", iso: "KM", code: "269" },
    { name: "Congo", iso: "CG", code: "242" },
    { name: "Costa Rica", iso: "CR", code: "506" },
    { name: "Croatia", iso: "HR", code: "385" },
    { name: "Cuba", iso: "CU", code: "53" },
    { name: "Cyprus", iso: "CY", code: "357" },
    { name: "Czech Republic", iso: "CZ", code: "420" },
    { name: "Denmark", iso: "DK", code: "45" },
    { name: "Djibouti", iso: "DJ", code: "253" },
    { name: "Dominica", iso: "DM", code: "1767" },
    { name: "Dominican Republic", iso: "DO", code: "1809" },
    { name: "Ecuador", iso: "EC", code: "593" },
    { name: "Egypt", iso: "EG", code: "20" },
    { name: "El Salvador", iso: "SV", code: "503" },
    { name: "Equatorial Guinea", iso: "GQ", code: "240" },
    { name: "Eritrea", iso: "ER", code: "291" },
    { name: "Estonia", iso: "EE", code: "372" },
    { name: "Ethiopia", iso: "ET", code: "251" },
    { name: "Fiji", iso: "FJ", code: "679" },
    { name: "Finland", iso: "FI", code: "358" },
    { name: "France", iso: "FR", code: "33" },
    { name: "Gabon", iso: "GA", code: "241" },
    { name: "Gambia", iso: "GM", code: "220" },
    { name: "Georgia", iso: "GE", code: "995" },
    { name: "Germany", iso: "DE", code: "49" },
    { name: "Ghana", iso: "GH", code: "233" },
    { name: "Greece", iso: "GR", code: "30" },
    { name: "Grenada", iso: "GD", code: "1473" },
    { name: "Guatemala", iso: "GT", code: "502" },
    { name: "Guinea", iso: "GN", code: "224" },
    { name: "Guinea-Bissau", iso: "GW", code: "245" },
    { name: "Guyana", iso: "GY", code: "592" },
    { name: "Haiti", iso: "HT", code: "509" },
    { name: "Honduras", iso: "HN", code: "504" },
    { name: "Hungary", iso: "HU", code: "36" },
    { name: "Iceland", iso: "IS", code: "354" },
    { name: "India", iso: "IN", code: "91" },
    { name: "Indonesia", iso: "ID", code: "62" },
    { name: "Iran", iso: "IR", code: "98" },
    { name: "Iraq", iso: "IQ", code: "964" },
    { name: "Ireland", iso: "IE", code: "353" },
    { name: "Israel", iso: "IL", code: "972" },
    { name: "Italy", iso: "IT", code: "39" },
    { name: "Jamaica", iso: "JM", code: "1876" },
    { name: "Japan", iso: "JP", code: "81" },
    { name: "Jordan", iso: "JO", code: "962" },
    { name: "Kazakhstan", iso: "KZ", code: "7" },
    { name: "Kenya", iso: "KE", code: "254" },
    { name: "Kiribati", iso: "KI", code: "686" },
    { name: "Kuwait", iso: "KW", code: "965" },
    { name: "Kyrgyzstan", iso: "KG", code: "996" },
    { name: "Laos", iso: "LA", code: "856" },
    { name: "Latvia", iso: "LV", code: "371" },
    { name: "Lebanon", iso: "LB", code: "961" },
    { name: "Lesotho", iso: "LS", code: "266" },
    { name: "Liberia", iso: "LR", code: "231" },
    { name: "Libya", iso: "LY", code: "218" },
    { name: "Liechtenstein", iso: "LI", code: "423" },
    { name: "Lithuania", iso: "LT", code: "370" },
    { name: "Luxembourg", iso: "LU", code: "352" },
    { name: "Madagascar", iso: "MG", code: "261" },
    { name: "Malawi", iso: "MW", code: "265" },
    { name: "Malaysia", iso: "MY", code: "60" },
    { name: "Maldives", iso: "MV", code: "960" },
    { name: "Mali", iso: "ML", code: "223" },
    { name: "Malta", iso: "MT", code: "356" },
    { name: "Mauritania", iso: "MR", code: "222" },
    { name: "Mauritius", iso: "MU", code: "230" },
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
    { name: "North Macedonia", iso: "MK", code: "389" },
    { name: "Norway", iso: "NO", code: "47" },
    { name: "Oman", iso: "OM", code: "968" },
    { name: "Pakistan", iso: "PK", code: "92" },
    { name: "Palestine", iso: "PS", code: "970" },
    { name: "Panama", iso: "PA", code: "507" },
    { name: "Papua New Guinea", iso: "PG", code: "675" },
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
    { name: "Seychelles", iso: "SC", code: "248" },
    { name: "Sierra Leone", iso: "SL", code: "232" },
    { name: "Singapore", iso: "SG", code: "65" },
    { name: "Slovakia", iso: "SK", code: "421" },
    { name: "Slovenia", iso: "SI", code: "386" },
    { name: "Somalia", iso: "SO", code: "252" },
    { name: "South Africa", iso: "ZA", code: "27" },
    { name: "South Korea", iso: "KR", code: "82" },
    { name: "Spain", iso: "ES", code: "34" },
    { name: "Sri Lanka", iso: "LK", code: "94" },
    { name: "Sudan", iso: "SD", code: "249" },
    { name: "Suriname", iso: "SR", code: "597" },
    { name: "Sweden", iso: "SE", code: "46" },
    { name: "Switzerland", iso: "CH", code: "41" },
    { name: "Syria", iso: "SY", code: "963" },
    { name: "Taiwan", iso: "TW", code: "886" },
    { name: "Tajikistan", iso: "TJ", code: "992" },
    { name: "Tanzania", iso: "TZ", code: "255" },
    { name: "Thailand", iso: "TH", code: "66" },
    { name: "Togo", iso: "TG", code: "228" },
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
    let dialCode = "880";
    let isoCode = "BD";
    
    const sorted = [...COUNTRY_DIAL_CODES].sort((a,b) => b.code.length - a.code.length);
    for (const item of sorted) {
        if (clean.startsWith(item.code)) {
            dialCode = item.code;
            isoCode = item.iso;
            break;
        }
    }

    let nationalNumber = clean;
    if (nationalNumber.startsWith(dialCode)) {
        nationalNumber = nationalNumber.substring(dialCode.length);
    }

    return {
        dialCode,
        isoCode,
        nationalNumber,
        fullNumberWithPlus: `+${clean}`
    };
}

function maskPhoneNumber(phoneStr) {
    let clean = phoneStr.replace(/[^\d]/g, "");
    if (clean.length <= 6) return phoneStr;
    const prefix = clean.substring(0, 4);
    const suffix = clean.substring(clean.length - 3);
    return `\({prefix}FAST\){suffix}`;
}

function extractOtp(messageText) {
    if (!messageText) return null;
    const spacedMatch = messageText.match(/#?\s*(\d{3}\s*\d{3})\b/);
    if (spacedMatch) return spacedMatch[1].replace(/\s+/g, ""); 
    const match = messageText.match(/\b\d{4,8}\b/);
    if (match) return match[0];
    const linkMatch = messageText.match(/(https?:\/\/[^\s]+)/gi);
    if (linkMatch) return linkMatch[0];
    return null;
}

function readDb() {
    if (memoryDb) return memoryDb;
    
    if (!fs.existsSync(DB_FILE)) {
        const defaultServices = ["Telegram", "WhatsApp", "Imo", "Instagram", "Facebook", "TikTok", "Uber"];
        const defaultApis = [
            "https://panel.lamix.org/api/v1/messages?token=F03xiioltLwvYbIlS470UQ9XuVWkp-KlqC5f_r2yXhs",
            "http://169.58.213.56/crapi/ALEIUS/viewstats?token=dsglfRknOC2y_94AAD164B4ED"
        ];
        memoryDb = { 
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
            customOtpMsg: "🚀 **FAST OTP RECEIVED!**\n\n📱 `{service}` | {flag} `{country}` | 📞 `+{phone}`\n\n💬 *\"{message}\"*\n\n👉 `{code}` *(Tap to Copy)*\n\n💰 **+৳{reward} BDT added to your balance!**"
        };
        try { fs.writeFileSync(DB_FILE, JSON.stringify(memoryDb, null, 2)); } catch(e){}
    } else {
        try {
            memoryDb = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
            if (!memoryDb.admins.includes(MASTER_ADMIN)) memoryDb.admins.push(MASTER_ADMIN);
        } catch (e) {
            memoryDb = { numbers: [], admins: [MASTER_ADMIN], users: [], services: [], serviceRates: {}, balances: {}, withdrawals: [], sentOtps: [], apiUrls: [], checkDelay: 4000, numberQty: 1 };
        }
    }
    return memoryDb;
}

function writeDb(data) {
    memoryDb = data;
    try {
        fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), () => {});
    } catch(e) {}
}

// Auto sync disk data every 5 mins for Railway safety
setInterval(() => {
    if (memoryDb) writeDb(memoryDb);
}, 300000);

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
        await ctx.reply("⚙️ অ্যাডমিন প্যানেলে আপনাকে স্বাগতম!", adminReplyMenu).catch(()=>{});
    } else {
        await ctx.reply("📱 ইউজার প্যানেলে আপনাকে স্বাগতম।", userReplyMenu).catch(()=>{});
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

    await ctx.reply("🔑 **Admin System Settings Panel**\n\nনিচের অপশনগুলো থেকে কনফিগার করুন:", {
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
        keyboard.text(`❌ Remove API #\({idx + 1}`, `delapi_\){idx}`).row();
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
        await ctx.editMessageText(`✅ API URL ডিলিট করা হয়েছে:\n ${escapeHtml(removed[0])}`, { parse_mode: "HTML" }).catch(()=>{});
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
    const helpMsg = `✏️ **কাস্টম ওটিপি মেসেজ টেমপ্লেট পরিবর্তন করুন**\n\n` +
                    `ব্যবহারযোগ্য ট্যাগসমূহ:\n` +
                    `• {service} - সার্ভিস নাম\n` +
                    `• {country} - দেশের নাম\n` +
                    `• {flag} - পতাকার ইমোজি\n` +
                    `• {phone} - ফোন নম্বর\n` +
                    `• {message} - ফুল মেসেজ\n` +
                    `• {code} - ওটিপি কোড\n` +
                    `• {reward} - প্রাপ্ত বিডিটি\n\n` +
                    `নতুন ফরম্যাট টাইপ করে লিখে পাঠান:`;
    await ctx.editMessageText(helpMsg, { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.callbackQuery("adm_view_config", async (ctx) => {
    const dbData = readDb();
    let text = `⚙️ **বর্তমান সিস্টেম কনফিগারেশন**\n\n`;
    text += `⏱️ **Polling Delay:** ${dbData.checkDelay} ms\n`;
    text += `🔢 **Get Number Qty:** ${dbData.numberQty || 1}\n\n`;
    text += `🔗 **API URLs (${dbData.apiUrls.length}):**\n`;
    dbData.apiUrls.forEach((url, i) => {
        text += `\({i + 1}.\){escapeHtml(url)}\n`;
    });
    text += `\n💬 **OTP Message Template:**\n*${escapeHtml(dbData.customOtpMsg)}*`;

    await ctx.editMessageText(text, { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
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

    await ctx.reply("Select a Service:", { reply_markup: getServicesKeyboard("user") }).catch(()=>{});
});

bot.hears("💰 Balance", async (ctx) => {
    const dbData = readDb();
    const userId = ctx.from.id;
    const balance = (dbData.balances[userId] || 0).toFixed(2);

    let text = `💵 **Your Current Balance**\n\n`;
    text += `👤 User ID: ${userId}\n`;
    text += `💰 Balance: ৳${balance} BDT\n\n`;
    text += `📌 Minimum withdrawal limit is **৳100.00 BDT**.`;

    await ctx.reply(text, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("💳 Withdraw", async (ctx) => {
    const dbData = readDb();
    const userId = ctx.from.id;
    const balance = dbData.balances[userId] || 0;

    if (balance < 100) {
        await ctx.reply(`❌ **উইথড্র করতে ব্যর্থ!**\n\nআপনার বর্তমান ব্যালেন্স: ৳ ${balance.toFixed(2)} BDT\nসর্বনিম্ন উইথড্র রিকোয়েস্ট পরিমাণ: ৳100.00 BDT`, { parse_mode: "HTML" }).catch(()=>{});
        return;
    }

    userState[userId] = { step: "awaiting_binance_id" };
    await ctx.reply(`💳 **Withdrawal Request**\n\nআপনার বর্তমান ব্যালেন্স: ৳${balance.toFixed(2)} BDT\n\nঅনুগ্রহ করে আপনার **Binance Pay ID / bKash / Nagad Number** টি লিখে পাঠান:`, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("🚦 Live Traffic", async (ctx) => {
    const dbData = readDb();
    const availableCount = dbData.numbers.filter(n => n.status === "available").length;
    const activeCheckersCount = Object.keys(activeOtpCheckers).length;
    
    let infoText = `🚦 **Live Traffic Status**\n\n`;
    infoText += `🟢 Available Numbers in Stock: ${availableCount}\n`;
    infoText += `⚡ Active OTP Requests Right Now: ${activeCheckersCount}\n\n`;
    infoText += `🚀 Bot is running smooth and ready to deliver numbers!`;
    
    await ctx.reply(infoText, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("📊 Status", async (ctx) => {
    const dbData = readDb();
    const totalNumbers = dbData.numbers.length;
    const availableNumbers = dbData.numbers.filter(n => n.status === "available").length;
    const usedNumbers = dbData.numbers.filter(n => n.status === "used").length;
    const totalUsers = dbData.users.length;
    const totalServices = dbData.services.length;

    let statusText = `📊 **Bot Statistics Overview**\n\n`;
    statusText += `👥 Total Users: ${totalUsers}\n`;
    statusText += `🛠️ Total Services Active: ${totalServices}\n`;
    statusText += `📱 Total Numbers in DB: ${totalNumbers}\n`;
    statusText += `🟩 Available Numbers: ${availableNumbers}\n`;
    statusText += `🟥 Used/Processing Numbers: ${usedNumbers}\n`;

    await ctx.reply(statusText, { parse_mode: "HTML" }).catch(()=>{});
});

bot.hears("⚙️ Switch to Admin Menu", async (ctx) => {
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
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("🛠️ **Service Settings Menu:**\nনিচের অপশনগুলো বেছে নিন:", { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
});

bot.hears("📢 Admin Control", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("📢 **Admin Control Panel:**\nনিচের অপশনগুলো বেছে নিন:", { parse_mode: "HTML", reply_markup: adminControlMenu.reply_markup }).catch(()=>{});
});

bot.hears("« Back to Main Menu", async (ctx) => {
    const userId = ctx.from.id;
    const dbData = readDb();
    if (dbData.admins.includes(userId)) {
        await ctx.reply("🔙 মূল অ্যাডমিন মেনুতে ফিরে আসা হয়েছে।", adminReplyMenu).catch(()=>{});
    } else {
        await ctx.reply("🔙 মূল ইউজার মেনুতে ফিরে আসা হয়েছে।", userReplyMenu).catch(()=>{});
    }
});

bot.hears("📋 List Services", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    let text = `📋 **Active Services & Rates**\n\n`;
    dbData.services.forEach((s, idx) => {
        const rate = dbData.serviceRates[s] ? `৳${dbData.serviceRates[s].toFixed(2)} BDT` : "Default (৳5.00)";
        text += `\({idx + 1}. **\){escapeHtml(s)}** - Rate: ${rate}\n`;
    });
    
    await ctx.reply(text, { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
});

bot.hears("ℹ️ Help / Guide", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    let helpText = `ℹ️ **Admin Help Guide**\n\n`;
    helpText += `1️⃣ **Add Number:** নম্বর বাল্ক ফরম্যাটে বা টেক্সট ফাইলে আপলোড করুন।\n`;
    helpText += `2️⃣ **Modify Rate:** সার্ভিস অথবা সার্ভিস+কান্ট্রি প্রতি ওটিপি রেট সেট করুন।\n`;
    helpText += `3️⃣ **Withdraw Requests:** পেন্ডিং উইথড্র রিকোয়েস্ট চেক ও প্রসেস করুন।\n`;
    helpText += `4️⃣ **/adminmenu:** API, Delay, Number Quantity এবং Custom Message ম্যানেজ করুন।\n`;

    await ctx.reply(helpText, { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
});

bot.hears("👤 Admin List", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;

    let adminText = `👤 **Admin List (${dbData.admins.length})**\n\n`;
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
    await ctx.reply("✅ বটের সমস্ত ইউজার এবং অ্যাডমিন স্টেট রিসেট করা হয়েছে।", adminControlMenu).catch(()=>{});
});

bot.hears("📊 System Stats", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    
    const pendingWd = dbData.withdrawals.filter(w => w.status === "pending").length;
    
    let sysText = `🖥️ **System Overview Stats**\n\n`;
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
        const text = `❌ দুঃখিত, এই মুহূর্তে ${escapeHtml(serviceName)} সার্ভিসের কোনো নম্বর খালি নেই।`;
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
        
        const buttonText = `\({flag}\){cleanCountryName} [\({isoCode}] (\){rate.toFixed(2)})`;
        keyboard.text(buttonText, `getnum_\({serviceName}_\){encodeURIComponent(country)}`);
        
        if (index % 2 !== 0) keyboard.row();
    });

    const msg = `🌍 **${escapeHtml(serviceName)}** সার্ভিসের জন্য একটি Country সিলেক্ট করুন:`;
    try { 
        await ctx.editMessageText(msg, { reply_markup: keyboard, parse_mode: "HTML" }); 
    } catch(e) { 
        await ctx.reply(msg, { reply_markup: keyboard, parse_mode: "HTML" }).catch(()=>{}); 
    }
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
    const releasedIds = new Set();

    dbData.numbers.forEach(n => {
        if (n.service === service && n.country === country && n.assigned_to === userId && n.status === "used") {
            if (activeOtpCheckers[n.id.toString().trim()]) {
                clearInterval(activeOtpCheckers[n.id.toString().trim()]);
                delete activeOtpCheckers[n.id.toString().trim()];
            }

            if (!n.otp_received) {
                n.assigned_to = null;
                n.status = "available";
                releasedIds.add(n.id.toString());
            }
        }
    });

    writeDb(dbData);
    await deliverNumbers(ctx, service, country, true, true, releasedIds);
    ctx.answerCallbackQuery({ text: "Fresh new number issued!" }).catch(()=>{});
});

bot.callbackQuery(/^toggleprefix_/, async (ctx) => {
    const parts = ctx.callbackQuery.data.split("_");
    const service = parts[1];
    const country = decodeURIComponent(parts[2]);
    const currentHasPrefix = parts[3] === "1"; 

    await deliverNumbers(ctx, service, country, !currentHasPrefix, false);
    ctx.answerCallbackQuery().catch(()=>{});
});

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
            const failText = `❌ দুঃখিত, এই মুহূর্তে \({escapeHtml(service)} (\){escapeHtml(country)}) সার্ভিসের কোনো নতুন নম্বর খালি নেই।`;
            try { await ctx.editMessageText(failText, { parse_mode: "HTML" }); } catch(e) { await ctx.reply(failText, { parse_mode: "HTML" }).catch(()=>{}); }
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

    let deliveredText = `\({getCountryFlag(country)} **Country:**\){escapeHtml(country)}\n`;
    deliveredText += `🛠️ **Service:** ${escapeHtml(service)}\n\n`;
    deliveredText += `⏳ **Waiting for OTP...**`;

    const actionKeyboard = new InlineKeyboard();

    selectedNumbers.forEach((numObj) => {
        const info = parsePhoneNumberInfo(numObj.phone_number);
        const numberToDisplay = showWithPrefix ? info.fullNumberWithPlus : info.nationalNumber;
        actionKeyboard.copyText(numberToDisplay, numberToDisplay).row();
    });

    const toggleLabel = showWithPrefix ? "✂️ Remove Prefix" : "➕ Add Prefix";
    const prefixStateFlag = showWithPrefix ? "1" : "0";

    actionKeyboard.text(toggleLabel, `toggleprefix_\({service}_\){encodeURIComponent(country)}_${prefixStateFlag}`).row();
    actionKeyboard.text("🔄 Refresh", `refresh_\({service}_\){encodeURIComponent(country)}`).row();
    actionKeyboard.text("🌐 Change Country", `user_${service}`).row();
    actionKeyboard.url("🔑 OTP Group ↗️", OTP_GROUP_LINK);

    try {
        let sentMsg;
        if (ctx.callbackQuery) {
            sentMsg = await ctx.editMessageText(deliveredText, { reply_markup: actionKeyboard, parse_mode: "HTML" });
        } else {
            sentMsg = await ctx.reply(deliveredText, { reply_markup: actionKeyboard, parse_mode: "HTML" });
        }
        if (sentMsg && sentMsg.message_id) userActiveMessages[userId] = sentMsg.message_id;
    } catch (err) {
        let sentMsg = await ctx.reply(deliveredText, { reply_markup: actionKeyboard, parse_mode: "HTML" }).catch(()=>{});
        if (sentMsg && sentMsg.message_id) userActiveMessages[userId] = sentMsg.message_id;
    }
}

// --- Real OTP Fetch Logic via API (Fixed Leak & Memory Protection) ---
function startLiveOtpCheck(numberId, phoneNumber, serviceName, fallbackUserId, countryName) {
    const cleanId = numberId.toString().trim();
    const cleanUserPhone = phoneNumber.replace(/[^\d]/g, "");
    
    if (activeOtpCheckers[cleanId]) clearInterval(activeOtpCheckers[cleanId]);

    let initialDb = readDb();
    const delayTime = initialDb.checkDelay || 4000;
    let attempts = 0;
    const maxAttempts = (5 * 60 * 1000) / delayTime; // Auto clear interval after 5 minutes

    const interval = setInterval(async () => {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(interval);
            delete activeOtpCheckers[cleanId];
            return;
        }

        try {
            let dbData = readDb();
            const apiUrls = dbData.apiUrls && dbData.apiUrls.length > 0 ? dbData.apiUrls : [];

            for (const baseUrl of apiUrls) {
                try {
                    const separator = baseUrl.includes("?") ? "&" : "?";
                    const apiUrl = `\({baseUrl}\){separator}_cb=${Date.now()}`;

                    const response = await fetch(apiUrl);
                    if (!response.ok) continue;

                    const json = await response.json().catch(() => null);
                    if (!json) continue;

                    const recordList = (json && (json.records || json.data)) ? (json.records || json.data) : [];
                    
                    if (Array.isArray(recordList)) {
                        const matchedActivations = recordList.filter(item => {
                            const rawPhone = item.number || item.num || "";
                            const itemPhone = rawPhone.toString().replace(/[^\d]/g, "");
                            if (itemPhone.length < 7 || cleanUserPhone.length < 7) return false;
                            
                            return itemPhone.substring(itemPhone.length - 7) === cleanUserPhone.substring(cleanUserPhone.length - 7);
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
                                        if (foundNum) foundNum.otp_received = true; 

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

                                        let baseOtpTemplate = dbData.customOtpMsg || "🚀 **FAST OTP RECEIVED!**\n\n📱 `{service}` | {flag} `{country}` | 📞 `+{phone}`\n\n💬 *\"{message}\"*\n\n👉 `{code}` *(Tap to Copy)*\n\n💰 **+৳{reward} BDT added to your balance!**";
                                        
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
                                            .copyText(`\({otpCode}`, `\){otpCode}`).row()
                                            .url(`👀 Number Bot`, `https://t.me/${botUsername}`)
                                            .url(`✉️ Channel`, CHANNEL_CHAT_LINK);

                                        await bot.api.sendMessage(finalUserId, userSuccessMessage, { reply_markup: inlineKeyboardUser, parse_mode: "HTML" }).catch(()=>{});
                                        await bot.api.sendMessage(OTP_GROUP_ID, groupSuccessMessage, { reply_markup: inlineKeyboardUser, parse_mode: "HTML" }).catch(()=>{});
                                        
                                        // Stop checking after successfully getting OTP
                                        clearInterval(interval);
                                        delete activeOtpCheckers[cleanId];
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
            const globalApiUrls = dbData.apiUrls || [];

            for (const baseUrl of globalApiUrls) {
                try {
                    const separator = baseUrl.includes("?") ? "&" : "?";
                    const globalApiUrl = `\({baseUrl}\){separator}_cb=${Date.now()}`;

                    const response = await fetch(globalApiUrl);
                    if (!response.ok) continue;

                    const json = await response.json().catch(() => null);
                    if (!json) continue;

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

                                    const globalMessage = `📢 **প্যানেল ওটিপি নোটিফিকেশন!** (Global Alert)\n📦 সার্ভিস: \({safeService}\n📞 নম্বর:\){maskedGlobalPhone} \n\n💬 মেসেজ: *${safeRawMsg}*`;
                                    const botUsername = botInfo ? botInfo.username : "Bot";
                                    
                                    const inlineKeyboard = new InlineKeyboard()
                                        .copyText(`\({otpCode}`, `\){otpCode}`).row()
                                        .url(`👀 Number Bot`, `https://t.me/${botUsername}`)
                                        .url(`✉️ Channel`, CHANNEL_CHAT_LINK);

                                    try {
                                        await bot.api.sendMessage(OTP_GROUP_ID, globalMessage, { reply_markup: inlineKeyboard, parse_mode: "HTML" });
                                        await sleep(2000); 
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
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("কোন সার্ভিসের জন্য নম্বর যোগ করতে চান?", { reply_markup: getServicesKeyboard("admin") }).catch(()=>{});
});

bot.hears("🗑️ Delete Service", async (ctx) => {
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

    await ctx.editMessageText(`✅ **${escapeHtml(serviceName)}** সার্ভিস এবং এর সব নম্বর ডেটাবেজ থেকে মুছে ফেলা হয়েছে!`, { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.hears("✏️ Modify OTP Rate", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    await ctx.reply("✏️ যে সার্ভিসের OTP Rate পরিবর্তন করতে চান তা নির্বাচন করুন:", { reply_markup: getServicesKeyboard("ratechange") }).catch(()=>{});
});

bot.callbackQuery(/^ratechange_/, async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const serviceName = ctx.callbackQuery.data.split("_")[1];
    adminState[ctx.from.id] = { service: serviceName, step: "input_new_rate_service" };
    
    await ctx.editMessageText(`✏️ **${escapeHtml(serviceName)}** এর জন্য প্রতি OTP এর BDT Rate কত দিতে চান? (যেমন: 0.50 বা 10):`, { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.hears("💸 Withdraw Requests", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;

    const pendingRequests = dbData.withdrawals.filter(w => w.status === "pending");
    if (pendingRequests.length === 0) {
        await ctx.reply("✅ কোনো পেন্ডিং উইথড্র রিকোয়েস্ট নেই!").catch(()=>{});
        return;
    }

    let msg = `💸 **Pending Withdraw Requests (${pendingRequests.length})**\n\n`;
    pendingRequests.forEach((req, idx) => {
        msg += `**\({idx + 1}. Request ID:**\){req.id}\n`;
        msg += `👤 **User ID:** ${req.userId}\n`;
        msg += `💰 **Amount:** ৳${req.amount.toFixed(2)} BDT\n`;
        msg += `💳 **Account Info:** ${escapeHtml(req.binanceId)}\n`;
        msg += `📅 **Date:** ${req.date}\n\n`;
    });

    await ctx.reply(msg, { parse_mode: "HTML" }).catch(()=>{});
});

bot.callbackQuery(/^admin_/, async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    const serviceName = ctx.callbackQuery.data.split("_")[1];
    adminState[ctx.from.id] = { service: serviceName, step: "input_country" };
    await ctx.editMessageText(`📦 সার্ভিস সিলেক্ট করেছেন: **${escapeHtml(serviceName)}**\n\n🌍 এখন দেশের নাম টাইপ করে পাঠান:`, { parse_mode: "HTML" }).catch(()=>{});
    ctx.answerCallbackQuery().catch(()=>{});
});

bot.hears("➕ Add Service", async (ctx) => {
    const dbData = readDb();
    if (!dbData.admins.includes(ctx.from.id)) return;
    adminState[ctx.from.id] = { step: "input_new_service" };
    await ctx.reply("➕ যে নতুন সার্ভিসটি যোগ করতে চান তার নাম লিখুন:").catch(()=>{});
});

bot.hears("❌ Delete Numbers", async (ctx) => {
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
        await ctx.editMessageText(`❌ ${escapeHtml(serviceName)} সার্ভিসের আন্ডারে কোনো নম্বর নেই।`, { parse_mode: "HTML" }).catch(()=>{});
        return;
    }
    const keyboard = new InlineKeyboard();
    countries.forEach((country, index) => {
        const flag = getCountryFlag(country);
        keyboard.text(`\({flag}\){country}`, `confirmdel_\({serviceName}_\){encodeURIComponent(country)}`);
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
            phone = (parts.length >= 3 && parts[2].trim()) ? parts[2].trim().replace(/[^\d]/g, "") : parts[0].trim().replace(/[^\d]/g, "");
            numId = phone;
        } else {
            phone = cleanLine.replace(/[^\d]/g, "");
            numId = phone;
        }

        if (phone && !dbData.numbers.some(n => n.phone_number === phone)) {
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
    });

    writeDb(dbData);
    await ctx.reply(`📊 সফলভাবে ${addedCount} টি নম্বর যোগ হয়েছে।`, adminReplyMenu).catch(()=>{});
}

bot.on(["message:text", "message:document"], async (ctx) => {
    const userId = ctx.from.id;
    const userText = ctx.message.text || "";

    if (userText === "👤 Switch to User Menu") {
        delete adminState[userId]; 
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
        dbData.withdrawals.push({
            id: reqId,
            userId: userId,
            binanceId: binanceId,
            amount: withdrawAmount,
            date: new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
            status: "pending"
        });
        writeDb(dbData);
        delete userState[userId];

        await ctx.reply(`✅ **উইথড্র রিকোয়েস্ট সফলভাবে জমা হয়েছে!**\n\n🆔 Request ID: \({reqId}\n💰 Amount: ৳\){withdrawAmount.toFixed(2)} BDT\n💳 Account Info: ${escapeHtml(binanceId)}\n\nঅ্যাডমিন শীঘ্রই এটি ভেরিফাই করে পেমেন্ট বানিয়ে দেবে।`, { parse_mode: "HTML", reply_markup: userReplyMenu.reply_markup }).catch(()=>{});

        for (const adminId of dbData.admins) {
            try {
                await bot.api.sendMessage(adminId, `🔔 **নতুন উইথড্র রিকোয়েস্ট এসেছে!**\n\n👤 User: \({userId}\n💰 Amount: ৳\){withdrawAmount.toFixed(2)} BDT\n💳 Account Info: ${escapeHtml(binanceId)}`, { parse_mode: "HTML" });
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
            await ctx.reply(`✅ প্রতি ক্লিকে 'Get Number' ডেলিভারি সংখ্যা সেভ করা হয়েছে: **${qtyNum} টি**`, { parse_mode: "HTML" }).catch(()=>{});
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
        await ctx.reply(`✅ নতুন API URL যুক্ত করা হয়েছে:\n ${escapeHtml(newUrl)}`, { parse_mode: "HTML" }).catch(()=>{});
        return;
    }

    if (state.step === "awaiting_delay_ms" && ctx.message.text) {
        const delay = parseInt(ctx.message.text.trim());
        if (!isNaN(delay) && delay >= 1000) {
            dbData.checkDelay = delay;
            writeDb(dbData);
            delete adminState[userId];
            await ctx.reply(`✅ OTP চেক করার ডিলে সেট করা হয়েছে: **${delay} ms**`, { parse_mode: "HTML" }).catch(()=>{});
        } else {
            await ctx.reply("❌ সঠিক ইনপুট দিন (সর্বনিম্ন 1000 ms)।").catch(()=>{});
        }
        return;
    }

    if (state.step === "awaiting_otp_template" && ctx.message.text) {
        dbData.customOtpMsg = ctx.message.text;
        writeDb(dbData);
        delete adminState[userId];
        await ctx.reply("✅ ওটিপি মেসেজ টেমপ্লেট সফলভাবে কাস্টমাইজ করা হয়েছে!").catch(()=>{});
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
            await ctx.reply(`✅ **\({escapeHtml(state.service)}** সার্ভিসের নতুন OTP Rate set করা হয়েছে: **৳\){rate.toFixed(2)} BDT**`, { parse_mode: "HTML", reply_markup: serviceSettingsMenu.reply_markup }).catch(()=>{});
        } else {
            await ctx.reply("❌ রেট টি সঠিকভাবে লিখুন (যেমন: 0.50)।").catch(()=>{});
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
        await ctx.reply(`💵 **\({escapeHtml(state.service)} (\){escapeHtml(state.country)})** এর জন্য প্রতি OTP তে কত BDT দিতে চান? (যেমন: 0.50 বা 10):`, { parse_mode: "HTML" }).catch(()=>{});
    }
    else if (state.step === "input_rate" && ctx.message.text) {
        const rate = parseFloat(ctx.message.text.trim());
        if (isNaN(rate) || rate <= 0) {
            await ctx.reply("❌ সঠিক সংখ্যা লিখুন (যেমন: 0.50 বা 6.5)।").catch(()=>{});
            return;
        }
        const rateKey = `\({state.service}_\){state.country}`;
        dbData.serviceRates[rateKey] = rate;
        dbData.serviceRates[state.service] = rate;
        writeDb(dbData);

        state.step = "input_numbers";
        await ctx.reply(`✅ Per OTP Rate: **৳${rate.toFixed(2)} BDT** সেভ করা হয়েছে!\n\n🔢 এখন নম্বরগুলো পেস্ট করুন বা ফাইল দিন:`, { parse_mode: "HTML" }).catch(()=>{});
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

// Global Bot Error Handler
bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[CRITICAL ERROR] Error while handling update ${ctx.update.update_id}:`);
    const e = err.error;
    if (e.description) {
        console.error("Telegram API Error:", e.description);
    } else {
        console.error("General System Error:", e);
    }
});

// Process Crash Protection
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception thrown:", err);
});

// Start Bot
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
