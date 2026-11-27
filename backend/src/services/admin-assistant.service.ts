import mongoose from "mongoose";
import {
  ChatbotConversation,
  IPendingAction,
  Doctor,
  Organization,
  Website,
  Appointment,
  User,
  PlatformConfig,
} from "@/models";
import { GoogleGenAI } from "@google/genai";
import { getEnv } from "@/config/env";
import { AuthUserPayload, UserRole } from "@/types";
import { GeminiLoggerService } from "./gemini-logger.service";
import { FIXED_PLATFORM_DOMAIN } from "./platform-config.service";
import { MAX_CUSTOM_DOMAINS } from "./custom-domain.service";
import {
  getOrderedCandidateModels,
  markModelUnhealthy,
  markModelHealthy,
  generateContentBounded,
} from "./gemini-fast-caller";
import { z } from "zod";

const searchAppointmentsArgsSchema = z.object({
  search: z.string().max(100).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "PATIENT_NOT_COME"]).optional(),
  doctorName: z.string().max(100).optional(),
  limit: z.number().min(1).max(50).optional(),
});

const listDoctorsArgsSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  specialization: z.string().max(100).optional(),
  limit: z.number().min(1).max(100).optional(),
});

const getPlatformOrHospitalDetailsArgsSchema = z.object({
  includeCustomDomains: z.boolean().optional(),
  organizationStatus: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});

function toObjectIdSafe(val: any): mongoose.Types.ObjectId | null {
  if (!val) return null;
  return mongoose.Types.ObjectId.isValid(String(val)) ? new mongoose.Types.ObjectId(String(val)) : null;
}

/**
 * Strips all emojis, bold (** or __), italic (* or _), underline (<u>),
 * markdown headers (#), and HTML tags.
 * Ensures output is 100% pure plain text without bold, italic, underline, or emojis.
 */
export function sanitizeToPlainText(text: string): string {
  if (!text) return "";
  let clean = text;

  // 1. Remove all emojis, pictographs, symbols, variation selectors, flags
  clean = clean.replace(
    /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B50}\u{200D}\u{FE0F}\u{20E3}\u{2190}-\u{21FF}\u{2900}-\u{297F}\u{3297}\u{3299}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F251}]/gu,
    ""
  );

  // 2. Strip bold markdown (**text** or __text__)
  clean = clean.replace(/\*\*(.*?)\*\*/g, "$1");
  clean = clean.replace(/__(.*?)__/g, "$1");

  // 3. Strip italic markdown (*text* or _text_) while preserving URLs
  clean = clean.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, "$1$2$3");
  clean = clean.replace(/\bhttps?:\/\/[^\s]+/gi, (url) => url.replace(/_/g, "__URL_UNDERSCORE__"));
  clean = clean.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, "$1$2$3");
  clean = clean.replace(/__URL_UNDERSCORE__/g, "_");

  // 4. Strip html tags like <u>, </b>, <i>, <strong>, etc.
  clean = clean.replace(/<\/?[a-zA-Z][^>]*>/g, "");

  // 5. Strip markdown headers (# Title)
  clean = clean.replace(/^#{1,6}\s+/gm, "");

  // 6. Strip markdown link syntax: [Label](url) -> Label: url
  clean = clean.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2");

  // 7. Strip stray asterisks used for bullets: * item -> - item
  clean = clean.replace(/^\s*\*\s+/gm, "- ");

  // 8. Collapse extra spaces
  clean = clean.replace(/[ \t]{2,}/g, " ");

  return clean.trim();
}

export type SupportedLanguage = "ENGLISH" | "GUJARATI_SCRIPT" | "HINDI_SCRIPT" | "GUJLISH" | "HINGLISH";

/**
 * Accurately detects user message language:
 * 1. GUJARATI_SCRIPT: Gujarati characters (U+0A80 to U+0AFF)
 * 2. HINDI_SCRIPT: Devanagari characters (U+0900 to U+097F)
 * 3. GUJLISH: Gujarati language written in Latin/English characters
 * 4. HINGLISH: Hindi language written in Latin/English characters
 * 5. ENGLISH: Default for English words without Indic markers
 */
export function detectLanguage(text: string): SupportedLanguage {
  const trimmed = text.trim();
  if (!trimmed) return "ENGLISH";

  // 1. Gujarati Unicode block (U+0A80 to U+0AFF)
  if (/[\u0A80-\u0AFF]/.test(trimmed)) {
    return "GUJARATI_SCRIPT";
  }

  // 2. Devanagari Unicode block (U+0900 to U+097F)
  if (/[\u0900-\u097F]/.test(trimmed)) {
    return "HINDI_SCRIPT";
  }

  const lower = trimmed.toLowerCase();

  // 3. Gujlish detection (Roman Gujarati words / markers)
  const gujlishPatterns = [
    /\b(kem\s*ch+o|kemch+o)\b/i,
    /\b(shu|soo|su)\s+(ch+e|karu|karvo|karvu|karie|thashe|chalo|vigat|chhe|madad)\b/i,
    /\b(ch+e|ch+u|ch+o|nathi|hata|hati|hatu|hasi|hovanu)\b/i,
    /\b(tamare|tamari|tamaru|tamaro|tame|tamne)\b/i,
    /\b(maru|mari|maro|mane|amaru|amari)\b/i,
    /\b(aaje|kaale|parme|kyare|aavshe|javshe|malse|joie|joiye)\b/i,
    /\b(ketla|ketli|ketlu|kyan|koni|kayo|kai|kayu|chij|kone|karelu)\b/i,
    /\b(saru|majama|aavjo|aabhar|khub|vaat|vato|kaho|thayu|batavo|lakho)\b/i,
    /\b(taklif|rog|bimar|bimari)\s+ch+e\b/i,
  ];
  if (gujlishPatterns.some((pattern) => pattern.test(lower))) {
    return "GUJLISH";
  }

  // 4. Hinglish detection (Roman Hindi words / markers)
  const hinglishPatterns = [
    /\b(namaste|namaskar|pranam|ram\s*ram|radhe\s*radhe)\b/i,
    /\b(kaise|kaisa|kaisi|kese|haal\s*chal)\b/i,
    /\b(aap|aapka|aapki|aapke|aapko|tum|tumhara|mera|meri|mere|mujhe|muje|mujhko|hum|hamara|hamari|hamare|iska|iski|iske|unka|unki|unke)\b/i,
    /\b(hai|hain|ho|hu|tha|thi|hoga|hogi|hoge|hui|hua|hue|raha|rahi|rahe|karo|kardo|karna|karni|kariye|karne)\b/i,
    /\b(woh|wo|hum|log|aaye|gaye|rehte|baat|din)\s+the\b/i,
    /\b(kya|kyu|kyun|kab|kahan|kaha|kidhar|kitna|kitne|kitni|kaun|kon|kis|kisi|kisne|kisko|kaunsa|kaunsi|konsa|konsi)\b/i,
    /\b(batao|bataiye|batayein|dikhao|dikhaiye|dekhna|dekh|sun|bolo|boliye|chahiye|chaiye)\b/i,
    /\b(aaj|kal|parso|abhi|baad|pehle|sirf|sabhi|saare|sare|baki|koi)\b/i,
    /\b(nahi|nahin|mat)\b/i,
    /\b(theek|thik|accha|achha|sahi|galat)\b/i,
    /\b(shukriya|dhanyawad|dhanyavaad|bahut)\b/i,
    /\b(kripya|madad|sahayata)\b/i,
    /\b(alvida)\b/i,
  ];
  if (hinglishPatterns.some((pattern) => pattern.test(lower))) {
    return "HINGLISH";
  }

  // 5. Default Latin text without Hindi/Gujarati markers -> ENGLISH
  return "ENGLISH";
}

/**
 * Checks if a user message is a standard conversational greeting, courtesy, acknowledgement, or apology
 */
export function isConversationalGreeting(message: string): boolean {
  const norm = message.trim().toLowerCase().replace(/[!?.,;:'"()]/g, "");

  if (/^(નમસ્તે|નમસ્કાર|પ્રણામ|કેમ છો|કેમછો|સુપ્રભાત|આભાર|ધન્યવાદ|સારું|આવજો)/i.test(norm)) {
    return true;
  }

  if (/^(नमस्ते|नमस्कार|प्रणाम|सुप्रभात|धन्यवाद|शुक्रिया|ठीक है|अलविदा|राम राम|राधे राधे)/i.test(norm)) {
    return true;
  }

  const greetings = [
    "hi", "hii", "hiii", "hello", "helloo", "hey", "heyy", "hie",
    "namaste", "namaskar", "pranam", "kem chho", "kem cho", "kemcho", "kemchho",
    "kaise ho", "kaisa ho", "kese ho", "kaise hain", "kaise ho aap", "kaise hain aap",
    "good morning", "good evening", "good afternoon", "good night",
    "thank you", "thanks", "dhanyawad", "dhanyavaad", "shukriya", "bahut shukriya", "aabhar",
    "ok", "okay", "theek hai", "thik hai", "saru", "saru chhe", "sure", "alright", "fine", "done",
    "sorry", "maaf karna", "maafi", "bye", "goodbye", "alvida", "aavjo", "ram ram", "radhe radhe"
  ];

  return greetings.some(
    (g) => norm === g || norm === `${g} ji` || norm === `${g} sir` || norm === `${g} doctor` || (norm.startsWith(`${g} `) && norm.split(" ").length <= 4)
  );
}

/**
 * Generates an instant, warm, pure plain-text reply for conversational courtesies
 * Mirroring the exact language of the user: English to English, Gujarati to Gujarati, Hindi to Hindi, Gujlish to Gujlish, Hinglish to Hinglish.
 */
export function getConversationalReply(message: string): string {
  const norm = message.trim().toLowerCase().replace(/[!?.,;:'"()]/g, "");
  const lang = detectLanguage(message);

  // 1. Gratitude
  if (
    /^(thank you|thanks|thank you so much|thanks a lot|dhanyawad|dhanyavaad|shukriya|bahut shukriya|aabhar)/i.test(norm) ||
    /^(આભાર|ધન્યવાદ)/i.test(norm) ||
    /^(धन्यवाद|शुक्रिया)/i.test(norm)
  ) {
    if (lang === "ENGLISH") {
      return "You are welcome! Let me know anytime if you need details on doctors, timings, fees, active status, or appointments.";
    }
    if (lang === "GUJARATI_SCRIPT") {
      return "તમારું સ્વાગત છે! ડોક્ટર્સ, સમય, ફી, એક્ટિવ/ડિએક્ટિવ સ્ટેટસ કે એપોઇન્ટમેન્ટ્સની કોઈ પણ માહિતી જોઈએ તો જરૂર જણાવશો.";
    }
    if (lang === "HINDI_SCRIPT") {
      return "आपका स्वागत है! डॉक्टरों, समय, फीस, सक्रिय/निष्क्रिय स्थिति या अपॉइंटमेंट्स की कोई भी जानकारी चाहिए तो अवश्य पूछें।";
    }
    if (lang === "GUJLISH") {
      return "Tamaru swagat chhe! Doctors, timing, fees, active/deactive status ke appointments ni koi pan vigat joiye to zaroor puchhjo.";
    }
    return "Aapka swagat hai! Doctors, timings, fees, active/deactive status ya appointments ki koi bhi jankari chahiye toh zaroor batayein.";
  }

  // 2. Acknowledgement / OK
  if (
    /^(ok|okay|theek hai|thik hai|saru|saru chhe|sure|alright|fine|done)/i.test(norm) ||
    /^(સારું|બરાબર)/i.test(norm) ||
    /^(ठीक है|बिल्कुल)/i.test(norm)
  ) {
    if (lang === "ENGLISH") {
      return "Understood! Ask me anytime if you want to check doctors, timings, fees, active websites, or booked appointments.";
    }
    if (lang === "GUJARATI_SCRIPT") {
      return "બરાબર! તમારે ડોક્ટર્સ, સમય, ફી, એક્ટિવ/ડિએક્ટિવ સ્ટેટસ અથવા બુક થયેલી એપોઇન્ટમેન્ટ્સની માહિતી જોવી હોય તો પૂછી શકો છો.";
    }
    if (lang === "HINDI_SCRIPT") {
      return "ठीक है! यदि आपको डॉक्टरों, समय, फीस, सक्रिय स्थिति या बुक की गई अपॉइंटमेंट्स की जानकारी देखनी हो, तो बताएं।";
    }
    if (lang === "GUJLISH") {
      return "Saru! Tamare doctors, timing, fees, active/deactive status ke book thayeli appointments ni vigat jovi hoy to puchhi shako chho.";
    }
    return "Theek hai! Agar aapko doctors, timings, fees, active/deactive status ya booked appointments ki jankari dekhni ho, toh batayein.";
  }

  // 3. How are you
  if (
    /^(how are you|kaise ho|kaisa ho|kese ho|kaise hain|kaise ho aap|kaise hain aap|kem cho|kem chho|kemcho|kemchho)/i.test(norm) ||
    /^(કેમ છો|તમે કેમ છો)/i.test(norm) ||
    /^(आप कैसे हैं|कैसे हो|कैसे हैं आप)/i.test(norm)
  ) {
    if (lang === "ENGLISH") {
      return "I am doing great, thank you! I am your read-only admin information assistant. How can I help you check doctors, timings, fees, or appointments today?";
    }
    if (lang === "GUJARATI_SCRIPT") {
      return "હું એકદમ મજામાં છું, આભાર! હું તમારા એડમિન પેનલનો માહિતી આસિસ્ટન્ટ છું. કહો, આજે ડોક્ટર્સ, સમય, ફી અથવા એપોઇન્ટમેન્ટ્સ વિશે શું જાણવું છે?";
    }
    if (lang === "HINDI_SCRIPT") {
      return "मैं बिल्कुल ठीक हूँ, धन्यवाद! मैं आपके एडमिन पैनल का जानकारी सहायक हूँ। बताएं, आज डॉक्टरों, समय, फीस या अपॉइंटमेंट्स के बारे में क्या जानना है?";
    }
    if (lang === "GUJLISH") {
      return "Hu bilkul majama chhu, aabhar! Hu tamara admin panel no information assistant chhu. Kaho, aaje doctors, time, fees ke appointments babate shu janvu chhe?";
    }
    return "Main bilkul theek hoon, dhanyawad! Main aapke admin panel ka information assistant hoon. Kahiye, aaj doctors, timings, fees ya appointments ke baare mein kya jaankari chahiye?";
  }

  // 4. Apology
  if (
    /^(sorry|maaf karna|maafi)/i.test(norm) ||
    /^(માફ કરશો|ક્ષમા)/i.test(norm) ||
    /^(माफ करना|माफी|क्षमा)/i.test(norm)
  ) {
    if (lang === "ENGLISH") {
      return "No problem at all! Let me know what information you would like to check from your admin panel.";
    }
    if (lang === "GUJARATI_SCRIPT") {
      return "કોઈ વાંધો નહીં! તમારા એડમિન પેનલમાંથી કઈ માહિતી જોવી છે તે જણાવો.";
    }
    if (lang === "HINDI_SCRIPT") {
      return "कोई बात नहीं! बताएं, अपने एडमिन पैनल से क्या जानकारी देखनी है?";
    }
    if (lang === "GUJLISH") {
      return "Kain vandho nahi! Tamara admin panel mathi kai vigat jovi chhe te kaho.";
    }
    return "Koi baat nahi! Batayein, aapke admin panel se kaunsi jaankari dekhni hai?";
  }

  // 5. Farewells
  if (
    /^(bye|goodbye|alvida|aavjo)/i.test(norm) ||
    /^(આવજો)/i.test(norm) ||
    /^(अलविदा)/i.test(norm)
  ) {
    if (lang === "ENGLISH") {
      return "Goodbye! Feel free to ask anytime you need information from your admin panel.";
    }
    if (lang === "GUJARATI_SCRIPT") {
      return "આવજો! એડમિન પેનલની કોઈ પણ માહિતી માટે ક્યારેય પણ પૂછી શકો છો.";
    }
    if (lang === "HINDI_SCRIPT") {
      return "अलविदा! एडमिन पैनल से किसी भी जानकारी के लिए कभी भी पूछ सकते हैं।";
    }
    if (lang === "GUJLISH") {
      return "Aavjo! Admin panel ni koi pan vigat mate kyare pan puchhi shako chho.";
    }
    return "Alvida! Admin panel se kisi bhi jaankari ke liye kabhi bhi pooch sakte hain.";
  }

  // 6. General greetings
  if (lang === "ENGLISH") {
    return "Hello! I am your admin panel information assistant. Ask me about doctors, specialties, timings, fees, active/deactive status, or booked appointments.";
  }
  if (lang === "GUJARATI_SCRIPT") {
    return "નમસ્તે! હું તમારા એડમિન પેનલનો માહિતી આસિસ્ટન્ટ છું. તમે મને ડોક્ટર્સ, સમય, ફી, એક્ટિવ/ડિએક્ટિવ સ્ટેટસ કે બુક થયેલી એપોઇન્ટમેન્ટ્સ વિશે પૂછી શકો છો.";
  }
  if (lang === "HINDI_SCRIPT") {
    return "नमस्ते! मैं आपके एडमिन पैनल का जानकारी सहायक हूँ। आप मुझसे डॉक्टरों, समय, फीस, सक्रिय/निष्क्रिय स्थिति या बुक की गई अपॉइंटमेंट्स के बारे में पूछ सकते हैं।";
  }
  if (lang === "GUJLISH") {
    return "Namaste! Hu tamara admin panel no information assistant chhu. Tame mane doctors, time, fees, active/deactive status ke booked appointments babate puchhi shako chho.";
  }
  return "Namaste! Main aapke admin panel ka information assistant hoon. Aap mujhse doctors, timings, fees, active/deactive status ya booked appointments ke baare mein pooch sakte hain.";
}

/**
 * Checks if a user message is asking about today's date, day of the week, or tomorrow's date
 */
export function isDateOrDayQuery(message: string): boolean {
  const norm = message.trim().toLowerCase();

  if (/[\u0A80-\u0AFF]/.test(message)) {
    return /(તારીખ|વાર|દિવસ|આજે|આવતીકાલે|આવતીકાલ|કાલે|પરમ\s*દિવસે)/i.test(message);
  }

  if (/[\u0900-\u097F]/.test(message)) {
    return /(तारीख|दिनांक|दिन|वार|आज|कल|परसों)/i.test(message);
  }

  return (
    /\b(aaj|today|current)\b.*\b(date|tarikh|tareekh|taarikh|din|day|vaar)\b/i.test(norm) ||
    /\b(date|tarikh|tareekh|taarikh|din|day|vaar)\b.*\b(aaj|today|current)\b/i.test(norm) ||
    /\b(kal|tomorrow|kaale)\b.*\b(date|tarikh|tareekh|taarikh|din|day|vaar)\b/i.test(norm) ||
    /\b(date|tarikh|tareekh|taarikh|din|day|vaar)\b.*\b(kal|tomorrow|kaale)\b/i.test(norm) ||
    /\b(parso|parson|parme|day after tomorrow)\b.*\b(date|tarikh|tareekh|taarikh|din|day|vaar)\b/i.test(norm) ||
    /^(date kya hai|tarikh kya hai|tareekh kya hai|aaj ki date|aaj ki tarikh|what is today'?s date|today'?s date|what day is today|what date is today|current date|current day)$/i.test(norm) ||
    /^(aaj konsi date hai|aaj kya date hai|aaj konsa din hai|aaj konsa day hai|aaj kya din hai|kal konsi date hai|kal kya date hai|kal konsa din hai|kal konsa day hai)$/i.test(norm) ||
    /^(aaje kai tarikh chhe|aaje kayo vaar chhe|kaale kai tarikh chhe|kaale kayo vaar chhe)$/i.test(norm)
  );
}

/**
 * Returns accurate real-world current date and day description in the user's exact language
 */
export function getRealDateAndDayReply(message: string): string {
  const norm = message.trim().toLowerCase();
  const lang = detectLanguage(message);
  const now = new Date();

  const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const daysHi = ["Ravivar", "Somwar", "Mangalwar", "Budhwar", "Guruwar", "Shukrawar", "Shaniwar"];
  const daysGu = ["રવિવાર", "સોમવાર", "મંગળવાર", "બુધવાર", "ગુરુવાર", "શુક્રવાર", "શનિવાર"];
  const daysHiScript = ["रविवार", "सोमवार", "मंगलवार", "बुधवार", "गुरुवार", "शुक्रवार", "शनिवार"];
  const monthsEn = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const formatInfo = (d: Date) => {
    const dayNameEn = daysEn[d.getDay()] || "Wednesday";
    const dayNameHi = daysHi[d.getDay()] || "Budhwar";
    const dayNameGu = daysGu[d.getDay()] || "બુધવાર";
    const dayNameHiScript = daysHiScript[d.getDay()] || "बुधवार";
    const dateNum = d.getDate();
    const monthName = monthsEn[d.getMonth()] || "October";
    const year = d.getFullYear();
    const dateFormatted = `${String(dateNum).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${year}`;
    return { dayNameEn, dayNameHi, dayNameGu, dayNameHiScript, dateNum, monthName, year, dateFormatted };
  };

  const todayInfo = formatInfo(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowInfo = formatInfo(tomorrow);
  const parso = new Date(now);
  parso.setDate(parso.getDate() + 2);
  const parsoInfo = formatInfo(parso);

  const isTomorrow = /\b(kal|tomorrow|kaale|આવતીકાલે|આવતીકાલ|कल)\b/i.test(norm) && !/\b(aaj|today|aaje|આજે|आज)\b/i.test(norm);
  const isParso = /\b(parso|parson|parme|day after tomorrow|પરમ|परसों)\b/i.test(norm);

  if (lang === "ENGLISH") {
    if (isTomorrow) {
      return `Tomorrow's date is ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dateFormatted}), and the day will be ${tomorrowInfo.dayNameEn}.`;
    }
    if (isParso) {
      return `The day after tomorrow's date is ${parsoInfo.dateNum} ${parsoInfo.monthName} ${parsoInfo.year} (${parsoInfo.dateFormatted}), and the day will be ${parsoInfo.dayNameEn}.`;
    }
    return `Today's date is ${todayInfo.dateNum} ${todayInfo.monthName} ${todayInfo.year} (${todayInfo.dateFormatted}), and today is ${todayInfo.dayNameEn}.`;
  }

  if (lang === "GUJARATI_SCRIPT") {
    if (isTomorrow) {
      return `આવતીકાલની તારીખ ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dateFormatted}) છે અને તે દિવસે ${tomorrowInfo.dayNameGu} (${tomorrowInfo.dayNameEn}) હશે.`;
    }
    if (isParso) {
      return `પરમ દિવસની તારીખ ${parsoInfo.dateNum} ${parsoInfo.monthName} ${parsoInfo.year} (${parsoInfo.dateFormatted}) છે અને તે દિવસે ${parsoInfo.dayNameGu} (${parsoInfo.dayNameEn}) હશે.`;
    }
    return `આજની તારીખ ${todayInfo.dateNum} ${todayInfo.monthName} ${todayInfo.year} (${todayInfo.dateFormatted}) છે અને આજનો વાર ${todayInfo.dayNameGu} (${todayInfo.dayNameEn}) છે.`;
  }

  if (lang === "HINDI_SCRIPT") {
    if (isTomorrow) {
      return `कल की तारीख ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dateFormatted}) है और दिन ${tomorrowInfo.dayNameHiScript} (${tomorrowInfo.dayNameEn}) होगा।`;
    }
    if (isParso) {
      return `परसों की तारीख ${parsoInfo.dateNum} ${parsoInfo.monthName} ${parsoInfo.year} (${parsoInfo.dateFormatted}) है और दिन ${parsoInfo.dayNameHiScript} (${parsoInfo.dayNameEn}) होगा।`;
    }
    return `आज की तारीख ${todayInfo.dateNum} ${todayInfo.monthName} ${todayInfo.year} (${todayInfo.dateFormatted}) है और आज का दिन ${todayInfo.dayNameHiScript} (${todayInfo.dayNameEn}) है।`;
  }

  if (lang === "GUJLISH") {
    if (isTomorrow) {
      return `Kaal ni tarikh ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dateFormatted}) chhe ane vaar ${tomorrowInfo.dayNameEn} (${tomorrowInfo.dayNameHi}) hashe.`;
    }
    if (isParso) {
      return `Parme divas ni tarikh ${parsoInfo.dateNum} ${parsoInfo.monthName} ${parsoInfo.year} (${parsoInfo.dateFormatted}) chhe ane vaar ${parsoInfo.dayNameEn} hashe.`;
    }
    return `Aaj ni tarikh ${todayInfo.dateNum} ${todayInfo.monthName} ${todayInfo.year} (${todayInfo.dateFormatted}) chhe ane aaje ${todayInfo.dayNameEn} (${todayInfo.dayNameHi}) chhe.`;
  }

  if (isTomorrow) {
    return `Kal ki tareekh ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dateFormatted}) hai aur din ${tomorrowInfo.dayNameEn} (${tomorrowInfo.dayNameHi}) hoga.`;
  }
  if (isParso) {
    return `Parso ki tareekh ${parsoInfo.dateNum} ${parsoInfo.monthName} ${parsoInfo.year} (${parsoInfo.dateFormatted}) hai aur din ${parsoInfo.dayNameEn} (${parsoInfo.dayNameHi}) hoga.`;
  }
  return `Aaj ki tareekh ${todayInfo.dateNum} ${todayInfo.monthName} ${todayInfo.year} (${todayInfo.dateFormatted}) hai aur aaj ka din ${todayInfo.dayNameEn} (${todayInfo.dayNameHi}) hai.`;
}

/**
 * Checks if a message is an off-topic / outside question (shared helper also imported by public-chatbot.service.ts)
 */
export function isOutsideOrOffTopicQuery(message: string): boolean {
  const norm = message.trim().toLowerCase();

  if (isDateOrDayQuery(message)) {
    return false;
  }

  const outsidePersonalities = [
    /\b(elon|alon)\s*musk\b/i,
    /\b(bill\s*gates|steve\s*jobs|mark\s*zuckerberg|jeff\s*bezos)\b/i,
    /\b(mukesh\s*ambani|ambani|adani|ratan\s*tata)\b/i,
    /\b(narendra\s*modi|modi|rahul\s*gandhi|donald\s*trump|trump|biden|putin)\b/i,
    /\b(virat\s*kohli|dhoni|rohit\s*sharma|sachin|cricketer)\b/i,
    /\b(shah\s*rukh|salman\s*khan|aamir\s*khan|deepika|actor|actress|hero)\b/i,
    /\b(spacex|tesla|twitter|x\.com)\b/i,
  ];
  if (outsidePersonalities.some((p) => p.test(norm))) {
    return true;
  }

  if (/(kon|kaun|who)\s+(hai|h|he|is|was|chhe)/i.test(norm)) {
    const isClinicalQuery = /\b(doctor|dr|physician|surgeon|staff|admin|patient|roster|user|specialist|hospital|clinic|active|deactive)\b/i.test(norm);
    if (!isClinicalQuery) {
      return true;
    }
  }

  const generalHealthPatterns = [
    /\bpani\s+(pine|peene)\b/i,
    /\bdrinking\s+water\b/i,
    /\b(fayda|fayde|benefits?|nuksan)\b.*\b(pani|water|food|khana|diet|sleep|nind|fruit|seb|milk|doodh|juice)\b/i,
    /\b(pani|water|food|khana|diet|sleep|nind|fruit|seb|milk|doodh|juice)\b.*\b(fayda|fayde|benefits?|nuksan)\b/i,
    /\b(vajan|weight\s*loss|weight\s*gain|motapa|fat\s*loss)\b/i,
    /\b(diet\s*plan|diet\s*chart|subah\s*uthke|morning\s*walk|workout|yoga)\b/i,
    /\b(gharelu\s*nuskhe|gharelu\s*upay|home\s*remed|totke|ayurvedic\s*upay)\b/i,
    /\b(dawa|dawai|medicine|tablet|goli|syrup)\s+(batao|de|suggest|kya\s+hai|kaunsi|konsi)\b/i,
  ];
  if (generalHealthPatterns.some((p) => p.test(norm))) {
    return true;
  }

  const generalTriviaPatterns = [
    /\b(mausam|weather|temperature|barish|forecast)\b/i,
    /\b(recipe|dish|kaise\s*banaye|banane\s*ki\s*vidhi)\b/i,
    /\b(cricket|world\s*cup|ipl|match|score)\b/i,
    /\b(movie|film|cinema|gana|song|music)\b/i,
    /\b(python|javascript|coding|code|programming|loop|react)\b/i,
    /\b(capital\s+of|prime\s+minister|president|rajdhani)\b/i,
    /\b(joke|chutkula|shayari|story|kahani)\b/i,
  ];
  if (generalTriviaPatterns.some((p) => p.test(norm))) {
    return true;
  }

  return false;
}

/**
 * Checks if an admin query is asking for disease cure, treatment protocols, medicines, or home remedies
 * (strictly forbidden in Admin AI Copilot, while allowing queries about which doctor treats what specialty).
 */
export function isAdminMedicalTreatmentOrRemedyQuery(message: string): boolean {
  const norm = message.trim().toLowerCase();

  // Allow administrative questions about practice specialization / doctors
  if (/\b(doctor|dr|hospital|clinic|specialist|kaun|kon|which|list)\b/i.test(norm) && !/\b(gharelu|remed|ilaj\s+kaise|kaise\s+thik|dawai|tablet|syrup|prescription)\b/i.test(norm)) {
    return false;
  }

  const medicalAdvicePatterns = [
    /\b(bimari|disease|bukhar|fever|sugar|diabetes|bp|cancer|infection|khansi|cough|cold|dard|pain|migraine|thyroid)\b.*\b(ilaj\s+kaise|kaise\s+thik|cure|remedy|treatment|dawa|dawai|medicine|kya\s+khaye|kya\s+piye)\b/i,
    /\b(ilaj\s+kaise\s+hota|kaise\s+thik\s+hota|how\s+to\s+cure|how\s+to\s+treat|home\s+remed|gharelu\s+upay|gharelu\s+ilaj|gharelu\s+nuskhe|nuskha|upay)\b/i,
    /\b(dosage|side\s*effects|antibiotic|paracetamol|crocin|insulin|syrup|capsule)\b/i,
  ];

  return medicalAdvicePatterns.some((p) => p.test(norm));
}

/**
 * Checks if the message is asking the Admin AI Copilot to PERFORM a write/edit/delete/activate/deactivate/booking action
 * (both direct & indirect phrasing), while carefully allowing read-only status/count inquiries.
 */
export function isMutationOrActionRequest(message: string): boolean {
  const norm = message.trim().toLowerCase();
  if (!norm) return false;

  // Read-only informational questions that merely contain status words ("kon active hai", "kitne delete hue")
  const isPureInfoQuestion =
    /^(who|which|what|how many|show|list|get|find|tell|give|check|summarize|summary|count|kon|kaun|kis|kitne|kitni|kitna|kya|batao|dikhao|dekho)\b/i.test(norm) &&
    !/\b(karo|kardo|kar do|kar de|kijiye|kariye|karna hai|karni hai|karwana hai|banado|bana do|hatado|hata do|mitao|badlo|badal do|delete|remove|edit|modify|update|deactivate|deactve|activate|disable|enable|create|add|approve|reject|cancel|book)\b/i.test(norm);

  if (isPureInfoQuestion) {
    return false;
  }

  // Imperative / indirect Hinglish, Gujlish, Hindi, Gujarati action verbs
  const indicImperatives =
    /\b(karo|kardo|kar\s+do|kar\s+de|kar\s+dena|kijiye|kariye|karna\s+hai|karni\s+hai|karwana\s+hai|karvu\s+chhe|karvi\s+chhe|karsho|kari\s+do|hatao|hatado|hata\s+do|hata\s+de|mitao|mita\s+do|badlo|badal\s+do|badal\s+de|sudharo|banado|bana\s+do|band\s+kar|chalu\s+kar|on\s+kar|off\s+kar|rakho|rakhna)\b/i;

  const mutationTargets =
    /\b(delete|remove|del|purge|erase|edit|modify|update|change|rename|reset|deactivate|deactve|deactive|activate|active|disable|enable|suspend|create|add|new\s+doctor|naya\s+doctor|approve|reject|cancel|reschedule|book|mark|completed|status|fee|fees|timing|time|hours|bio|title|theme|slug|domain|password|email|profile|doctor|dr|website|hospital|clinic|appointment)\b/i;

  if (indicImperatives.test(norm) && mutationTargets.test(norm)) {
    return true;
  }

  // Unicode Hindi / Gujarati imperative mutation patterns
  if (/[\u0900-\u097F\u0A80-\u0AFF]/.test(message)) {
    if (/(हटाओ|हटाएं|डिलीट|बदलो|बदलें|अपडेट|एडिट|बंद\s*कर|चालू\s*कर|सक्रिय\s*कर|निष्क्रिय\s*कर|રદ\s*કર|ડિલીટ|હટાવો|બદલો|અપડેટ|એડિટ|બંધ\s*કર|ચાલુ\s*કર)/i.test(message)) {
      return true;
    }
  }

  // English imperative/action requests ("delete doctor", "please deactivate dr x", "change fees to 500", "add a doctor")
  const englishActionVerbs =
    /\b(delete|remove|erase|purge|deactivate|deactve|disable|suspend|activate|reactivate|enable|edit|modify|update|change|alter|rename|reset|create|add|register|approve|reject|cancel|reschedule|book|mark|turn\s+off|turn\s+on|switch\s+off|switch\s+on|set\s+status)\b/i;

  if (englishActionVerbs.test(norm)) {
    // Allow purely informational questions like "how many appointments were cancelled?" or "which doctors are active/deactivated?"
    const informationalExceptions =
      /\b(how\s+many|who\s+(?:was|were|is|are)|which\s+.*(?:are|were)|list\s+.*(?:cancelled|deleted|active|deactive|deactivated)|count\s+of|total\s+(?:cancelled|deleted)|reason|details\s+of|summary\s+of|is\s+.*\s+(?:active|deactivated|cancelled|deleted)|are\s+.*\s+(?:active|deactivated|cancelled))\b/i;
    if (!informationalExceptions.test(norm)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns a polite plain-text refusal for write/mutation requests in the user's exact language
 */
export function getMutationRefusalReply(message: string): string {
  const lang = detectLanguage(message);

  if (lang === "ENGLISH") {
    return "Sorry, I am a read-only information assistant. I cannot delete, edit, modify, create, activate, or deactivate any records, or perform bookings/cancellations. Please perform those actions directly using the controls in your admin panel. Let me know if you want to check any details or reports!";
  }

  if (lang === "GUJARATI_SCRIPT") {
    return "માફ કરશો, હું માત્ર માહિતી બતાવતો (Read-Only) આસિસ્ટન્ટ છું. હું કોઈપણ રેકોર્ડ ડિલીટ, એડિટ, અપડેટ, ક્રિએટ, એક્ટિવ કે ડિએક્ટિવ કરી શકતો નથી. કૃપા કરીને આ ફેરફાર તમારા એડમિન પેનલના બટન દ્વારા જાતે કરો. હા, જો કોઈ માહિતી કે રિપોર્ટ જોવા હોય તો પૂછી શકો છો!";
  }

  if (lang === "HINDI_SCRIPT") {
    return "क्षमा करें, मैं केवल जानकारी प्रदान करने वाला (Read-Only) सहायक हूँ। मैं किसी भी रिकॉर्ड को डिलीट, एडिट, अपडेट, क्रिएट, एक्टिव या डिएक्टिव नहीं कर सकता। कृपया यह कार्य एडमिन पैनल के विकल्पों से स्वयं करें। यदि आपको कोई जानकारी या रिपोर्ट देखनी हो, तो अवश्य पूछें!";
  }

  if (lang === "GUJLISH") {
    return "Maaf karjo, hu fakt mahiti aapto (read-only) assistant chhu. Hu koi pan record delete, edit, modify, create, active ke deactive kari shakto nathi. Kripa karine aa kaam admin panel na buttons thi jate karo. Ha, jo koi vigat ke report jovi hoy to puchhi shako chho!";
  }

  return "Maaf kijiye, main sirf information dikhane wala (read-only) assistant hoon. Main kisi bhi record ko delete, edit, modify, create, activate ya deactivate nahi kar sakta. Kripya ye kaam admin panel ke buttons se khud karein. Haan, agar aapko koi details ya summary dekhni ho toh zaroor poochein!";
}

/**
 * Returns a polite plain-text refusal for outside or medical-treatment questions in the user's exact language
 */
export function getOutsideTopicRefusal(message: string): string {
  const lang = detectLanguage(message);

  if (lang === "ENGLISH") {
    return "I can only share information and reports from your Doczeno admin panel (doctors, specialties, timings, fees, active/deactive status, and appointments). I cannot answer external general knowledge questions, medical treatments, or home remedies.";
  }

  if (lang === "GUJARATI_SCRIPT") {
    return "હું માત્ર તમારા Doczeno એડમિન પેનલની માહિતી (ડોક્ટર્સ, સમય, ફી, એક્ટિવ/ડિએક્ટિવ સ્ટેટસ અને એપોઇન્ટમેન્ટ્સ) જ બતાવી શકું છું. બહારના સામાન્ય જ્ઞાનના સવાલો, બીમારીનો ઈલાજ કે ઘરેલુ ઉપાયો વિશે જવાબ આપી શકતો નથી.";
  }

  if (lang === "HINDI_SCRIPT") {
    return "मैं केवल आपके Doczeno एडमिन पैनल की जानकारी (डॉक्टरों, समय, फीस, सक्रिय/निष्क्रिय स्थिति और अपॉइंटमेंट्स) ही दे सकता हूँ। बाहरी सामान्य ज्ञान, बीमारी का इलाज या घरेलू उपाय बताना मेरे कार्यक्षेत्र में नहीं है।";
  }

  if (lang === "GUJLISH") {
    return "Hu fakt tamara Doczeno admin panel ni vigat (doctors, time, fees, active/deactive status ane appointments) j batavi shaku chhu. Bahaar na general sawalo, bimari no ilaj ke gharelu upay aapi shakto nathi.";
  }

  return "Main sirf aapke Doczeno admin panel ki information (doctors, timings, fees, active/deactive status aur appointments) hi bata sakta hoon. Bahar ki duniya ke general sawal, kisi bimari ka ilaj ya gharelu upay nahi bata sakta.";
}

export const ADMIN_ASSISTANT_TOOL_DECLARATIONS = [
  {
    name: "searchAppointments",
    description:
      "Read-only: Search or filter patient appointments within the administrator's authorized scope by patient name, phone, appointment ID, status, or doctor name.",
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Optional patient name, phone number, or appointment ID" },
        status: {
          type: "string",
          description: "Optional status: PENDING, CONFIRMED, COMPLETED, CANCELLED, or PATIENT_NOT_COME",
        },
        doctorName: { type: "string", description: "Optional doctor name filter" },
        limit: { type: "number", description: "Max records to return (default 20, max 50)" },
      },
    },
  },
  {
    name: "listDoctors",
    description:
      "Read-only: List doctors within the administrator's authorized scope with optional status or specialization filter.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by ACTIVE or INACTIVE" },
        specialization: { type: "string", description: "Optional specialization keyword filter" },
        limit: { type: "number", description: "Max records to return (default 50, max 100)" },
      },
    },
  },
  {
    name: "getPlatformOrHospitalDetails",
    description:
      "Read-only: Fetch detailed Superadmin platform metrics, custom domains, or Hospital overview.",
    parameters: {
      type: "object",
      properties: {
        includeCustomDomains: { type: "boolean", description: "Include connected custom domains list" },
        organizationStatus: { type: "string", description: "Optional org status filter: ACTIVE, INACTIVE, SUSPENDED" },
      },
    },
  },
];

export class AdminAssistantService {
  private client: GoogleGenAI | null = null;
  private model: string;

  constructor() {
    const env = getEnv();
    this.model = env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    if (env.GEMINI_API_KEY) {
      this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    }
  }

  private getClient(): GoogleGenAI {
    if (!this.client) {
      const env = getEnv();
      const apiKey = env.GEMINI_API_KEY || "mock-gemini-api-key-for-test";
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  private async generateContentWithFallback(params: {
    contents: any;
    systemInstruction: string;
    tools?: any[];
    organizationId?: any;
    doctorId?: any;
    userId?: any;
  }) {
    const client = this.getClient();
    const candidateModels = getOrderedCandidateModels(this.model);

    let lastError: any = null;
    for (const modelName of candidateModels) {
      const startTime = Date.now();
      try {
        const config: any = {
          systemInstruction: params.systemInstruction,
          maxOutputTokens: 1200,
          temperature: 0.2,
        };
        if (params.tools) {
          config.tools = params.tools;
        }
        if (!modelName.toLowerCase().includes("lite")) {
          config.thinkingConfig = { thinkingBudget: 0 };
        }

        const res = await generateContentBounded({
          client,
          model: modelName,
          contents: params.contents,
          config,
          timeoutMs: 10000,
        });

        markModelHealthy(modelName);
        const latencyMs = Date.now() - startTime;
        const usage = (res as any)?.usageMetadata;
        GeminiLoggerService.logCall({
          feature: "ADMIN_ASSISTANT",
          model: modelName,
          status: "SUCCESS",
          statusCode: 200,
          latencyMs,
          promptTokens: usage?.promptTokenCount || 0,
          candidatesTokens: usage?.candidatesTokenCount || 0,
          totalTokens: usage?.totalTokenCount || 0,
          organizationId: params.organizationId,
          doctorId: params.doctorId,
          userId: params.userId,
        });

        return res;
      } catch (err: any) {
        lastError = err;
        const latencyMs = Date.now() - startTime;
        const parsed = GeminiLoggerService.parseError(err);
        markModelUnhealthy(modelName, err?.status || parsed.statusCode);
        GeminiLoggerService.logCall({
          feature: "ADMIN_ASSISTANT",
          model: modelName,
          status: "FAILED",
          statusCode: parsed.statusCode,
          latencyMs,
          errorCode: parsed.errorCode,
          errorMessage: parsed.errorMessage,
          organizationId: params.organizationId,
          doctorId: params.doctorId,
          userId: params.userId,
        });
        continue;
      }
    }
    throw lastError || new Error("Failed to generate content across candidate models");
  }

  /**
   * Formats compact appointment status + source counts for any Mongo filter
   */
  private async getAppointmentBreakdown(filter: Record<string, any>) {
    const [
      total,
      pending,
      confirmed,
      completed,
      cancelled,
      notCome,
      viaWebsite,
      viaChatbot,
      viaAdmin,
      recent,
    ] = await Promise.all([
      Appointment.countDocuments(filter),
      Appointment.countDocuments({ ...filter, status: "PENDING" }),
      Appointment.countDocuments({ ...filter, status: "CONFIRMED" }),
      Appointment.countDocuments({ ...filter, status: "COMPLETED" }),
      Appointment.countDocuments({ ...filter, status: "CANCELLED" }),
      Appointment.countDocuments({ ...filter, status: "PATIENT_NOT_COME" }),
      Appointment.countDocuments({ ...filter, source: "WEBSITE_FORM" }),
      Appointment.countDocuments({ ...filter, source: "AI_CHATBOT" }),
      Appointment.countDocuments({ ...filter, source: { $in: ["SLUG_ADMIN", "WALK_IN"] } }),
      Appointment.find(filter)
        .populate("doctorId", "doctorName specialization")
        .populate("organizationId", "name slug")
        .sort({ appointmentDate: -1, createdAt: -1 })
        .limit(25)
        .select("appointmentId tokenNumber patientName patientAge patientPhone appointmentDate timeSlot status source notes doctorId organizationId createdAt")
        .lean(),
    ]);

    return {
      counts: {
        total,
        pending,
        confirmed,
        completed,
        cancelled,
        patientNotCome: notCome,
        bySource: { websiteForm: viaWebsite, aiChatbot: viaChatbot, adminWalkIn: viaAdmin },
      },
      recent: recent.map((a: any) => ({
        appointmentId: a.appointmentId,
        tokenNumber: a.tokenNumber ?? null,
        patientName: a.patientName,
        patientAge: a.patientAge,
        patientPhone: a.patientPhone,
        doctorName: a.doctorId?.doctorName ? `Dr. ${a.doctorId.doctorName}` : "N/A",
        hospitalName: a.organizationId?.name || null,
        date: a.appointmentDate ? new Date(a.appointmentDate).toISOString().split("T")[0] : "N/A",
        timeSlot: a.timeSlot,
        status: a.status,
        source: a.source || "WEBSITE_FORM",
        notes: a.notes,
      })),
    };
  }

  /**
   * Builds a fast, real-time, strictly tenant-isolated administrative snapshot so 95%+ queries
   * answer accurately in a single LLM pass (~1s) with zero hallucination.
   */
  private async buildLiveAdminSnapshot(user: AuthUserPayload): Promise<string> {
    if (user.role === UserRole.SUPERADMIN) {
      const [
        totalOrgs,
        activeOrgs,
        totalDoctors,
        activeDoctors,
        pendingDoctors,
        totalWebsites,
        activeWebsites,
        deactiveWebsites,
        totalUsers,
        platformConfig,
        orgsList,
        doctorsList,
        customDomainSites,
        appts,
      ] = await Promise.all([
        Organization.countDocuments(),
        Organization.countDocuments({ status: "ACTIVE" }),
        Doctor.countDocuments(),
        Doctor.countDocuments({ status: "ACTIVE" }),
        Doctor.countDocuments({ approvalStatus: "PENDING" }),
        Website.countDocuments(),
        Website.countDocuments({ publishStatus: "PUBLISHED" }),
        Website.countDocuments({ publishStatus: { $ne: "PUBLISHED" } }),
        User.countDocuments({ role: { $ne: UserRole.SUPERADMIN } }),
        PlatformConfig.findOne().lean(),
        Organization.find()
          .select("name slug type status address.city isWebsiteChatbotEnabled isAdminChatbotEnabled isChatbotBookingEnabled isAiRegenerateEnabled")
          .sort({ createdAt: -1 })
          .limit(50)
          .lean(),
        Doctor.find()
          .populate("organizationId", "name slug")
          .select("doctorName slug specialization degree yearsOfExperience status approvalStatus deactivatedByRole consultationHours weeklyOff newCaseFee oldCaseFee isWebsiteChatbotEnabled isChatbotBookingEnabled")
          .sort({ createdAt: -1 })
          .limit(60)
          .lean(),
        Website.find({ customDomain: { $exists: true, $nin: [null, ""] } })
          .select("slug customDomain customDomainStatus customDomainRedirect")
          .lean(),
        this.getAppointmentBreakdown({}),
      ]);

      const snapshot = {
        role: "SUPERADMIN",
        platformDomain: FIXED_PLATFORM_DOMAIN,
        summaryCounts: {
          organizations: { total: totalOrgs, active: activeOrgs, deactive: totalOrgs - activeOrgs },
          doctors: {
            total: totalDoctors,
            active: activeDoctors,
            deactive: totalDoctors - activeDoctors,
            pendingApproval: pendingDoctors,
            permanentlyDeletedHistory: platformConfig?.deletedDoctorsCount || 0,
          },
          websites: {
            total: totalWebsites,
            activeWebsitesCount: activeWebsites,
            deactiveWebsitesCount: deactiveWebsites,
          },
          customDomains: {
            usedCount: customDomainSites.length,
            maxLimit: MAX_CUSTOM_DOMAINS,
            domains: customDomainSites,
          },
          totalUsers,
          appointments: appts.counts,
        },
        hospitalsAndClinics: orgsList.map((o: any) => ({
          name: o.name,
          slug: o.slug,
          type: o.type,
          status: o.status,
          city: o.address?.city || "",
          webChatbot: o.isWebsiteChatbotEnabled !== false,
          adminChatbot: o.isAdminChatbotEnabled !== false,
          chatbotBooking: o.isChatbotBookingEnabled !== false,
          aiRegenerate: Boolean(o.isAiRegenerateEnabled),
        })),
        doctorsDirectory: doctorsList.map((d: any) => ({
          name: `Dr. ${d.doctorName}`,
          specialization: d.specialization,
          degree: d.degree,
          experienceYears: d.yearsOfExperience,
          affiliation: d.organizationId?.name || "Only Doctor",
          status: d.status,
          approvalStatus: d.approvalStatus,
          deactivatedBy: d.deactivatedByRole || null,
          timings: d.consultationHours || "N/A",
          weeklyOff: d.weeklyOff || "None",
          newCaseFee: d.newCaseFee ?? "N/A",
          oldCaseFee: d.oldCaseFee ?? "N/A",
          chatbotBooking: d.isChatbotBookingEnabled !== false,
        })),
        recentAppointments: appts.recent,
      };
      return JSON.stringify(snapshot);
    }

    if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
      const orgId = new mongoose.Types.ObjectId(user.organizationId);
      const [org, hospitalWebsite, hospitalDoctors, appts] = await Promise.all([
        Organization.findById(orgId).lean(),
        Website.findOne({ organizationId: orgId, websiteType: "HOSPITAL_CLINIC" })
          .select("slug publishStatus deactivatedByRole customDomain customDomainStatus")
          .lean(),
        Doctor.find({ organizationId: orgId })
          .select("doctorName slug degree specialization yearsOfExperience status approvalStatus deactivatedByRole consultationHours weeklyOff newCaseFee oldCaseFee whatsApp email appointmentRequired")
          .sort({ createdAt: -1 })
          .lean(),
        this.getAppointmentBreakdown({ organizationId: orgId }),
      ]);

      const approvedDocs = hospitalDoctors.filter((d: any) => d.approvalStatus !== "PENDING" && d.approvalStatus !== "REJECTED");
      const pendingDocs = hospitalDoctors.filter((d: any) => d.approvalStatus === "PENDING");
      const activeDoctorSites = approvedDocs.filter((d: any) => d.status === "ACTIVE").length;
      const deactiveDoctorSites = approvedDocs.filter((d: any) => d.status !== "ACTIVE").length;
      const isHospitalSiteActive =
        hospitalWebsite?.publishStatus !== "DRAFT" && hospitalWebsite?.publishStatus !== "SUSPENDED";

      const snapshot = {
        role: "HOSPITAL_ADMIN",
        hospitalProfile: org
          ? {
              name: org.name,
              type: org.type,
              slug: org.slug,
              status: org.status,
              workingHours: org.workingHours || "N/A",
              weeklyOff: org.weeklyOff || "None",
              departments: org.departments || [],
              phone: org.phone || "N/A",
              whatsApp: org.whatsApp || "N/A",
              email: org.email || "N/A",
              address: org.address,
              websiteStatus: hospitalWebsite?.publishStatus || "PUBLISHED",
              customDomain: hospitalWebsite?.customDomain || null,
            }
          : null,
        websiteAndDoctorCounts: {
          activeWebsitesCount: activeDoctorSites + (isHospitalSiteActive ? 1 : 0),
          deactiveWebsitesCount: deactiveDoctorSites + (isHospitalSiteActive ? 0 : 1),
          totalDoctors: approvedDocs.length,
          activeDoctors: activeDoctorSites,
          deactiveDoctors: deactiveDoctorSites,
          pendingApprovalRequests: pendingDocs.length,
        },
        doctors: hospitalDoctors.map((d: any) => ({
          name: `Dr. ${d.doctorName}`,
          degree: d.degree,
          specialization: d.specialization,
          experienceYears: d.yearsOfExperience,
          status: d.status,
          approvalStatus: d.approvalStatus,
          deactivatedBy:
            d.status !== "ACTIVE" && d.deactivatedByRole === "SUPERADMIN"
              ? "Deactive by Superadmin"
              : d.deactivatedByRole || null,
          timings: d.consultationHours || org?.workingHours || "N/A",
          weeklyOff: d.weeklyOff || org?.weeklyOff || "None",
          newCaseFee: d.newCaseFee ?? "N/A",
          oldCaseFee: d.oldCaseFee ?? "N/A",
          email: d.email,
          whatsApp: d.whatsApp || "N/A",
          urlSlug: org?.slug && d.slug ? `/${org.slug}/${d.slug}` : d.slug,
        })),
        appointmentsSummary: appts.counts,
        recentAppointments: appts.recent,
      };
      return JSON.stringify(snapshot);
    }

    // ONLY_DOCTOR or HOSPITAL_DOCTOR (strictly isolated to this doctor only)
    if (user.doctorProfileId) {
      const doctorId = new mongoose.Types.ObjectId(user.doctorProfileId);
      const [doc, docWebsite, parentOrg, appts] = await Promise.all([
        Doctor.findById(doctorId).lean(),
        Website.findOne({ doctorId })
          .select("slug publishStatus deactivatedByRole customDomain customDomainStatus browserTabTitle")
          .lean(),
        user.organizationId ? Organization.findById(user.organizationId).select("name slug workingHours weeklyOff phone address").lean() : Promise.resolve(null),
        this.getAppointmentBreakdown({ doctorId }),
      ]);

      const snapshot = {
        role: user.role,
        doctorProfile: doc
          ? {
              name: `Dr. ${doc.doctorName}`,
              degree: doc.degree,
              specialization: doc.specialization,
              experienceYears: doc.yearsOfExperience,
              status: doc.status,
              websiteStatus: docWebsite?.publishStatus || (doc.status === "ACTIVE" ? "PUBLISHED" : "DRAFT"),
              deactivatedBy:
                doc.status !== "ACTIVE" && (doc.deactivatedByRole === "SUPERADMIN" || docWebsite?.deactivatedByRole === "SUPERADMIN")
                  ? "Deactive by Superadmin"
                  : doc.deactivatedByRole || docWebsite?.deactivatedByRole || null,
              approvalStatus: doc.approvalStatus,
              timings: doc.consultationHours || parentOrg?.workingHours || "N/A",
              weeklyOff: doc.weeklyOff || parentOrg?.weeklyOff || "None",
              appointmentRequired: doc.appointmentRequired,
              newCaseFee: doc.newCaseFee ?? "N/A",
              oldCaseFee: doc.oldCaseFee ?? "N/A",
              clinicOrHospital: parentOrg?.name || doc.clinicName || "Clinic",
              email: doc.email,
              whatsApp: doc.whatsApp || "N/A",
              address: doc.address || parentOrg?.address || null,
              customDomain: docWebsite?.customDomain || null,
              urlSlug: parentOrg?.slug && doc.slug ? `/${parentOrg.slug}/${doc.slug}` : `/${doc.slug}`,
            }
          : null,
        appointmentsSummary: appts.counts,
        recentAppointments: appts.recent,
      };
      return JSON.stringify(snapshot);
    }

    return JSON.stringify({ role: user.role, message: "No specific tenant records linked." });
  }

  /**
   * Executes strict READ-ONLY backend queries with tenant isolation.
   * ZERO mutation/write/delete/activate/deactivate tools exist here by design.
   */
  public async executeTool(
    toolName: string,
    args: Record<string, any>,
    user: AuthUserPayload
  ): Promise<{ result: any }> {
    switch (toolName) {
      case "searchAppointments": {
        const parsed = searchAppointmentsArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Invalid searchAppointments parameters");
        const limit = parsed.data.limit || 20;

        const filter: Record<string, any> = {};
        if (user.role === UserRole.ONLY_DOCTOR || user.role === UserRole.HOSPITAL_DOCTOR) {
          if (!user.doctorProfileId) throw new Error("Doctor profile missing");
          filter.doctorId = new mongoose.Types.ObjectId(user.doctorProfileId);
        } else if (user.role === UserRole.HOSPITAL_ADMIN) {
          if (!user.organizationId) throw new Error("Hospital organization missing");
          filter.organizationId = new mongoose.Types.ObjectId(user.organizationId);
        }

        if (parsed.data.status) {
          filter.status = parsed.data.status;
        }
        if (parsed.data.search) {
          const safeRegex = { $regex: parsed.data.search.trim(), $options: "i" };
          filter.$or = [
            { patientName: safeRegex },
            { patientPhone: safeRegex },
            { appointmentId: safeRegex },
          ];
        }
        if (parsed.data.doctorName && (user.role === UserRole.HOSPITAL_ADMIN || user.role === UserRole.SUPERADMIN)) {
          const docFilter: Record<string, any> = {
            doctorName: { $regex: parsed.data.doctorName.trim(), $options: "i" },
          };
          if (user.organizationId) {
            docFilter.organizationId = new mongoose.Types.ObjectId(user.organizationId);
          }
          const matchingDocs = await Doctor.find(docFilter).select("_id").lean();
          filter.doctorId = { $in: matchingDocs.map((d) => d._id) };
        }

        const [totalMatching, items] = await Promise.all([
          Appointment.countDocuments(filter),
          Appointment.find(filter)
            .populate("doctorId", "doctorName specialization")
            .populate("organizationId", "name")
            .sort({ appointmentDate: -1, createdAt: -1 })
            .limit(limit)
            .select("appointmentId patientName patientAge patientPhone appointmentDate timeSlot status source notes doctorId organizationId")
            .lean(),
        ]);

        return {
          result: {
            totalMatching,
            appointments: items.map((a: any) => ({
              appointmentId: a.appointmentId,
              patientName: a.patientName,
              patientAge: a.patientAge,
              patientPhone: a.patientPhone,
              doctorName: a.doctorId?.doctorName ? `Dr. ${a.doctorId.doctorName}` : "N/A",
              hospitalName: a.organizationId?.name || null,
              date: a.appointmentDate ? new Date(a.appointmentDate).toISOString().split("T")[0] : "N/A",
              timeSlot: a.timeSlot,
              status: a.status,
              source: a.source || "WEBSITE_FORM",
              notes: a.notes,
            })),
          },
        };
      }

      case "listDoctors": {
        const parsed = listDoctorsArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Invalid listDoctors parameters");

        const query: Record<string, any> = {};
        if (user.role === UserRole.ONLY_DOCTOR || user.role === UserRole.HOSPITAL_DOCTOR) {
          if (!user.doctorProfileId) throw new Error("Doctor profile missing");
          query._id = new mongoose.Types.ObjectId(user.doctorProfileId);
        } else if (user.role === UserRole.HOSPITAL_ADMIN) {
          if (!user.organizationId) throw new Error("Organization missing");
          query.organizationId = new mongoose.Types.ObjectId(user.organizationId);
        }

        if (parsed.data.status) query.status = parsed.data.status;
        if (parsed.data.specialization) {
          query.specialization = { $regex: parsed.data.specialization.trim(), $options: "i" };
        }

        const doctors = await Doctor.find(query)
          .populate("organizationId", "name slug")
          .select("doctorName specialization degree yearsOfExperience status approvalStatus deactivatedByRole consultationHours weeklyOff newCaseFee oldCaseFee email whatsApp")
          .sort({ createdAt: -1 })
          .limit(parsed.data.limit || 50)
          .lean();

        return {
          result: {
            count: doctors.length,
            doctors: doctors.map((d: any) => ({
              name: `Dr. ${d.doctorName}`,
              specialization: d.specialization,
              degree: d.degree,
              experienceYears: d.yearsOfExperience,
              affiliation: d.organizationId?.name || "Only Doctor",
              status: d.status,
              approvalStatus: d.approvalStatus,
              deactivatedBy: d.deactivatedByRole || null,
              timings: d.consultationHours || "N/A",
              weeklyOff: d.weeklyOff || "None",
              newCaseFee: d.newCaseFee ?? "N/A",
              oldCaseFee: d.oldCaseFee ?? "N/A",
            })),
          },
        };
      }

      case "getPlatformOrHospitalDetails": {
        const parsed = getPlatformOrHospitalDetailsArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Invalid parameters");

        if (user.role === UserRole.SUPERADMIN) {
          const orgFilter: Record<string, any> = {};
          if (parsed.data.organizationStatus) orgFilter.status = parsed.data.organizationStatus;

          const [orgs, customDomains] = await Promise.all([
            Organization.find(orgFilter)
              .select("name slug type status address.city workingHours")
              .sort({ createdAt: -1 })
              .limit(50)
              .lean(),
            parsed.data.includeCustomDomains !== false
              ? Website.find({ customDomain: { $exists: true, $nin: [null, ""] } })
                  .select("slug customDomain customDomainStatus customDomainRedirect")
                  .lean()
              : Promise.resolve([]),
          ]);

          return { result: { organizations: orgs, customDomains } };
        }

        if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
          const org = await Organization.findById(user.organizationId).lean();
          return { result: { hospital: org } };
        }

        return { result: { message: "Only basic clinic info is accessible for this role." } };
      }

      default:
        throw new Error(
          `Read-only policy violation: "${toolName}" is not an authorized read tool.`
        );
    }
  }

  /**
   * Processes a turn for the Authenticated Read-Only Admin AI Assistant
   */
  public async handleAdminMessage(params: {
    user: AuthUserPayload;
    sessionId?: string;
    message: string;
    confirmActionId?: string;
  }): Promise<{
    response: string;
    sessionId: string;
    pendingConfirmation?: IPendingAction | null;
  }> {
    const { user, message } = params;

    // Enforce Admin AI Copilot status (doctor's own setting + parent hospital inheritance)
    if (user.doctorProfileId) {
      const doc = await Doctor.findById(user.doctorProfileId)
        .select("isAdminChatbotEnabled organizationId")
        .lean();
      let isDisabled = Boolean(doc && doc.isAdminChatbotEnabled === false);
      const targetOrgId = doc?.organizationId || user.organizationId;
      if (!isDisabled && targetOrgId) {
        const parentOrg = await Organization.findById(targetOrgId)
          .select("isAdminChatbotEnabled")
          .lean();
        if (parentOrg && parentOrg.isAdminChatbotEnabled === false) {
          isDisabled = true;
        }
      }
      if (isDisabled) {
        const disabledErr: any = new Error("Admin AI Copilot is currently disabled by administrator.");
        disabledErr.status = 403;
        disabledErr.code = "CHATBOT_DISABLED";
        throw disabledErr;
      }
    } else if (user.organizationId) {
      const org = await Organization.findById(user.organizationId).select("isAdminChatbotEnabled").lean();
      if (org && org.isAdminChatbotEnabled === false) {
        const disabledErr: any = new Error("Admin AI Copilot is currently disabled by administrator.");
        disabledErr.status = 403;
        disabledErr.code = "CHATBOT_DISABLED";
        throw disabledErr;
      }
    }

    const sessionId = params.sessionId || new mongoose.Types.ObjectId().toString();

    let conversation = await ChatbotConversation.findOne({
      sessionId,
      conversationType: "ADMIN",
    });

    if (!conversation) {
      conversation = await ChatbotConversation.create({
        conversationType: "ADMIN",
        sessionId,
        userId: toObjectIdSafe(user.userId),
        organizationId: toObjectIdSafe(user.organizationId),
        doctorId: toObjectIdSafe(user.doctorProfileId),
        messages: [],
      });
    } else if (conversation.pendingAction) {
      // Clear any legacy pendingAction from older sessions since assistant is strictly read-only
      conversation.pendingAction = null;
    }

    // 1. Fast Path: Polite Conversational Courtesies (Hi, Hello, Thank You, Sorry, Kaise Ho, Ok, Bye)
    if (isConversationalGreeting(message)) {
      const greetingReply = sanitizeToPlainText(getConversationalReply(message));
      conversation.messages.push({ role: "user", content: message, timestamp: new Date() });
      conversation.messages.push({ role: "assistant", content: greetingReply, timestamp: new Date() });
      await conversation.save();

      return { response: greetingReply, sessionId, pendingConfirmation: null };
    }

    // 2. Fast Path: Current Real-World Date & Day Queries
    if (isDateOrDayQuery(message)) {
      const dateReply = sanitizeToPlainText(getRealDateAndDayReply(message));
      conversation.messages.push({ role: "user", content: message, timestamp: new Date() });
      conversation.messages.push({ role: "assistant", content: dateReply, timestamp: new Date() });
      await conversation.save();

      return { response: dateReply, sessionId, pendingConfirmation: null };
    }

    // 3. Fast Path: Strictly Refuse ALL Delete / Edit / Modify / Create / Activate / Deactivate / Booking Commands
    if (isMutationOrActionRequest(message)) {
      const mutationRefusal = sanitizeToPlainText(getMutationRefusalReply(message));
      conversation.messages.push({ role: "user", content: message, timestamp: new Date() });
      conversation.messages.push({ role: "assistant", content: mutationRefusal, timestamp: new Date() });
      await conversation.save();

      return { response: mutationRefusal, sessionId, pendingConfirmation: null };
    }

    // 4. Fast Path: Strictly Refuse Outside World Knowledge & Medical Treatments / Home Remedies
    if (isOutsideOrOffTopicQuery(message) || isAdminMedicalTreatmentOrRemedyQuery(message)) {
      const refusalReply = sanitizeToPlainText(getOutsideTopicRefusal(message));
      conversation.messages.push({ role: "user", content: message, timestamp: new Date() });
      conversation.messages.push({ role: "assistant", content: refusalReply, timestamp: new Date() });
      await conversation.save();

      return { response: refusalReply, sessionId, pendingConfirmation: null };
    }

    // 5. Load real-time role-scoped snapshot from MongoDB in parallel (~20ms)
    const liveSnapshotJson = await this.buildLiveAdminSnapshot(user);

    const now = new Date();
    const currentDateStr = now.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const userLang = detectLanguage(message);

    // Include up to last 4 turns for natural follow-up questions
    const recentHistoryText = conversation.messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "Admin" : "Assistant"}: ${m.content}`)
      .join("\n");

    const systemInstruction = `
You are the official READ-ONLY administrative information assistant for the Doczeno healthcare portal.
Authenticated User Role: ${user.role}
Current Real-World Date: ${currentDateStr}

<LIVE_ADMIN_DATA_SNAPSHOT>
${liveSnapshotJson}
</LIVE_ADMIN_DATA_SNAPSHOT>

MANDATORY LANGUAGE & TONE MIRRORING (CRITICAL):
Detected language of current message: ${userLang}.
You MUST respond in the EXACT SAME language, script, and tone as the user's message:
1. ENGLISH -> 100% pure, crisp, professional English. Never use Hindi/Hinglish/Gujarati words.
2. HINDI_SCRIPT (देवनागरी) -> 100% Hindi Devanagari script.
3. GUJARATI_SCRIPT (ગુજરાતી) -> 100% Gujarati script.
4. GUJLISH (Roman Gujarati, e.g. "kem cho", "ketla doctor chhe") -> Natural, polite Gujlish.
5. HINGLISH (Roman Hindi, e.g. "kon active hai", "fees aur timing batao") -> Natural, polite Hinglish.

STRICT READ-ONLY & NO-MUTATION POLICY (ABSOLUTE - NEVER VIOLATE):
1. You ONLY read and present information from <LIVE_ADMIN_DATA_SNAPSHOT> or the read-only tools (searchAppointments, listDoctors, getPlatformOrHospitalDetails).
2. You CANNOT delete, edit, modify, update, create, add, approve, reject, activate, deactivate, suspend, cancel, or book ANY record.
3. If the user asks (directly OR indirectly) to perform ANY action/change (e.g. "deactivate Dr. X", "delete appointment", "change fees", "edit timing", "activate website", "add a doctor", "cancel booking"), you MUST politely refuse in their exact language (${userLang}) and tell them to use the buttons/controls inside the admin panel.

STRICT SCOPE BOUNDARY (NO EXTERNAL WORLD OR MEDICAL REMEDIES):
1. Answer ONLY questions about this admin panel's data (doctors, specialties, timings, fees, active/deactive status, websites, custom domains, hospital/platform overview, and appointments).
2. Polite greetings ("hi", "hello", "thank you", "sorry", "kaise ho", "ok", "bye") and date/day queries are allowed.
3. NEVER answer external world questions (news, politics, celebrities, coding, sports, weather, recipes, trivia).
4. NEVER give medical treatment advice, disease cure explanations, prescriptions, or home remedies ("bimari ka ilaj kaise hota hai", "gharelu upay", diet/wellness tips). Politely refuse in the user's exact language (${userLang}).

ACCURACY, SPEED & FORMATTING RULES:
1. ZERO HALLUCINATION: Report ONLY exact names, numbers, fees, timings, appointment IDs, phone numbers, and active/deactive statuses present in <LIVE_ADMIN_DATA_SNAPSHOT> or tool results. If a list is empty or 0, clearly say so.
2. Answer directly and concisely from <LIVE_ADMIN_DATA_SNAPSHOT> whenever the answer is already there (fast single-step response). Call a read-only tool ONLY if you need filtered search across older appointments or more doctors beyond the snapshot.
3. Output ONLY pure plain text: NO bold (** or __), NO italic (* or _), NO markdown headers (#), NO HTML tags, NO emojis. Use simple numbered lines (1., 2., 3.) or plain dashes (-).
`.trim();

    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    const promptWithHistory = recentHistoryText
      ? `Recent conversation:\n${recentHistoryText}\n\nCurrent Admin Question: ${message}`
      : message;

    try {
      const geminiResponse = await this.generateContentWithFallback({
        contents: promptWithHistory,
        systemInstruction,
        tools: [{ functionDeclarations: ADMIN_ASSISTANT_TOOL_DECLARATIONS as any }],
        organizationId: user.organizationId,
        doctorId: user.doctorProfileId,
        userId: user.userId,
      });

      const functionCalls = geminiResponse.functionCalls;

      if (functionCalls && functionCalls.length > 0 && functionCalls[0]?.name) {
        const fc = functionCalls[0];
        const toolName = fc.name!;
        const toolArgs = (fc.args as Record<string, any>) || {};

        const toolExecution = await this.executeTool(toolName, toolArgs, user);
        const resultString = JSON.stringify(toolExecution.result, null, 2);

        const followUp = await this.generateContentWithFallback({
          contents: `Read-only tool ${toolName} returned:\n${resultString}\n\nAnswer the administrator's question accurately in plain text only (no bold, no italic, no emojis): "${message}"\n\nReply strictly in ${userLang}.`,
          systemInstruction,
          organizationId: user.organizationId,
          doctorId: user.doctorProfileId,
          userId: user.userId,
        });

        const finalReply = sanitizeToPlainText(
          followUp.text?.trim() || "Here are the requested details from your admin panel."
        );

        conversation.messages.push({
          role: "assistant",
          content: finalReply,
          timestamp: new Date(),
        });
        await conversation.save();

        return {
          response: finalReply,
          sessionId,
          pendingConfirmation: null,
        };
      }

      const rawPlain =
        geminiResponse.text?.trim() || "How can I help you check information from your admin panel?";
      let plainReply = rawPlain;

      if (
        /elon musk|spacex|tesla|hydration|skin glow|digestion|detoxification/i.test(plainReply) ||
        isOutsideOrOffTopicQuery(message) ||
        isAdminMedicalTreatmentOrRemedyQuery(message)
      ) {
        plainReply = getOutsideTopicRefusal(message);
      }

      plainReply = sanitizeToPlainText(plainReply);

      conversation.messages.push({
        role: "assistant",
        content: plainReply,
        timestamp: new Date(),
      });
      await conversation.save();

      return {
        response: plainReply,
        sessionId,
        pendingConfirmation: null,
      };
    } catch (err: any) {
      const errorReply = sanitizeToPlainText(
        `Error fetching admin information: ${err?.message || "Please try again."}`
      );
      conversation.messages.push({
        role: "assistant",
        content: errorReply,
        timestamp: new Date(),
      });
      await conversation.save();

      return {
        response: errorReply,
        sessionId,
        pendingConfirmation: null,
      };
    }
  }
}

export const adminAssistantService = new AdminAssistantService();
