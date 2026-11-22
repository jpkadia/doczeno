import mongoose from "mongoose";
import {
  ChatbotConversation,
  IPendingAction,
  Doctor,
  Organization,
  Website,
  Appointment,
  AuditLog,
} from "@/models";
import { GoogleGenAI } from "@google/genai";
import { getEnv } from "@/config/env";
import { AuthUserPayload, UserRole } from "@/types";
import { GeminiLoggerService } from "./gemini-logger.service";
import { z } from "zod";

// Zod schemas for tool arguments validation
const getHospitalDoctorsArgsSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

const getDoctorProfileArgsSchema = z.object({
  doctorId: z.string().min(1, "Doctor ID is required"),
});

const getUpcomingAppointmentsArgsSchema = z.object({
  doctorId: z.string().optional(),
  limit: z.number().max(50).optional(),
});

const getHospitalOverviewArgsSchema = z.object({
  organizationId: z.string().optional(),
});

const updateDoctorProfileArgsSchema = z.object({
  doctorId: z.string().min(1, "Doctor ID is required"),
  bio: z.string().max(2000).optional(),
  yearsOfExperience: z.number().min(0).max(80).optional(),
  degree: z.string().max(200).optional(),
});

const updateHospitalContentArgsSchema = z.object({
  tagline: z.string().max(200).optional(),
  about: z.string().max(2500).optional(),
});

const updateWebsiteTabTitleArgsSchema = z.object({
  tabTitle: z.string().min(2).max(100),
});

const updateHospitalBrandingArgsSchema = z.object({
  selectedTheme: z.string().optional(),
  faviconUrl: z.string().url().optional(),
});

const createDoctorArgsSchema = z.object({
  doctorName: z.string().min(2).max(100),
  degree: z.string().min(2).max(100),
  specialization: z.string().min(2).max(100),
  yearsOfExperience: z.number().min(0).max(75),
  email: z.string().email(),
});

const deactivateDoctorArgsSchema = z.object({
  doctorId: z.string().min(1, "Doctor ID is required"),
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

  // 3. Strip italic markdown (*text* or _text_)
  clean = clean.replace(/(^|[^\*])\*([^\*\n]+)\*([^\*]|$)/g, "$1$2$3");
  clean = clean.replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, "$1$2$3");

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
    /\b(ketla|ketli|ketlu|kyan|koni|kayo|kai|kayu)\b/i,
    /\b(saru|majama|aavjo|aabhar|khub|vaat|vato|kaho|thayu)\b/i,
    /\b(taklif|rog|bimar|bimari)\s+ch+e\b/i,
  ];
  if (gujlishPatterns.some((pattern) => pattern.test(lower))) {
    return "GUJLISH";
  }

  // 4. Hinglish detection (Roman Hindi words / markers)
  const hinglishPatterns = [
    /\b(namaste|namaskar|pranam|ram\s*ram|radhe\s*radhe)\b/i,
    /\b(kaise|kaisa|kaisi|kese|haal\s*chal)\b/i,
    /\b(aap|aapka|aapki|aapke|aapko|tum|tumhara|mera|meri|mere|mujhe|mujhko|hum|hamara)\b/i,
    /\b(hai|hain|ho|hu|tha|thi|the|hoga|hogi|hoge|raha|rahi|rahe|karo|karna|kariye)\b/i,
    /\b(kya|kyu|kyun|kab|kahan|kaha|kidhar|kitna|kitne|kitni|kaun|kon)\b/i,
    /\b(batao|bataiye|batayein|dekhna|dekh|sun|bolo|boliye)\b/i,
    /\b(aaj|kal|parso|abhi|baad|pehle)\b/i,
    /\b(nahi|nahin|mat)\b/i,
    /\b(theek|thik|accha|achha|sahi|galat)\b/i,
    /\b(shukriya|dhanyawad|dhanyavaad|bahut)\b/i,
    /\b(kripya|madad|sahayata|chahiye)\b/i,
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

  // Gujarati script greetings
  if (/^(નમસ્તે|નમસ્કાર|પ્રણામ|કેમ છો|કેમછો|સુપ્રભાત|આભાર|ધન્યવાદ|સારું|આવજો)/i.test(norm)) {
    return true;
  }

  // Hindi script greetings
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
      return "You are welcome! Please let me know if you need any assistance with hospital management, doctor schedules, or patient appointments.";
    }
    if (lang === "GUJARATI_SCRIPT") {
      return "તમારું સ્વાગત છે! જો હોસ્પિટલ મેનેજમેન્ટ, ડોક્ટર્સ રોસ્ટર અથવા પેશન્ટ એપોઇન્ટમેન્ટ્સ શેડ્યૂલ સંબંધિત કોઈ કામ હોય, તો જરૂર જણાવશો.";
    }
    if (lang === "HINDI_SCRIPT") {
      return "आपका स्वागत है! यदि अस्पताल प्रबंधन, डॉक्टरों की सूची या अपॉइंटमेंट्स शेड्यूल से जुड़ा कोई कार्य हो, तो अवश्य बताएं।";
    }
    if (lang === "GUJLISH") {
      return "Tamaru swagat chhe! Jo hospital management, doctors ni vigat ke upcoming appointments babate koi kaam hoy, to zaroor janavjo.";
    }
    return "Aapka swagat hai! Agar hospital management, doctors ki roster ya patient appointments schedule se juda koi aur kaam ho, toh zaroor batayein.";
  }

  // 2. Acknowledgement / OK
  if (
    /^(ok|okay|theek hai|thik hai|saru|saru chhe|sure|alright|fine|done)/i.test(norm) ||
    /^(સારું|બરાબર)/i.test(norm) ||
    /^(ठीक है|बिल्कुल)/i.test(norm)
  ) {
    if (lang === "ENGLISH") {
      return "Understood! Please let me know if you would like to check the doctor roster, review upcoming appointments, or update clinic settings.";
    }
    if (lang === "GUJARATI_SCRIPT") {
      return "બરાબર! જો તમારે ક્લિનિક રોસ્ટર, આગામી એપોઇન્ટમેન્ટ્સ શેડ્યૂલ અથવા કોઈ ડોક્ટરની પ્રોફાઇલ તપાસવી હોય, તો જણાવશો.";
    }
    if (lang === "HINDI_SCRIPT") {
      return "ठीक है! यदि आपको क्लिनिक रोस्टर, आगामी अपॉइंटमेंट्स शेड्यूल या किसी डॉक्टर की प्रोफाइल चेक करनी हो, तो बताएं।";
    }
    if (lang === "GUJLISH") {
      return "Saru! Jo tamare clinic roster, upcoming appointments schedule ke doctor ni profile check karvi hoy, to janavjo.";
    }
    return "Theek hai! Agar aapko clinic roster, upcoming appointments schedule ya kisi doctor ki profile check karni ho, toh batayein.";
  }

  // 3. How are you
  if (
    /^(how are you|kaise ho|kaisa ho|kese ho|kaise hain|kaise ho aap|kaise hain aap|kem cho|kem chho|kemcho|kemchho)/i.test(norm) ||
    /^(કેમ છો|તમે કેમ છો)/i.test(norm) ||
    /^(आप कैसे हैं|कैसे हो|कैसे हैं आप)/i.test(norm)
  ) {
    if (lang === "ENGLISH") {
      return "I am doing well, thank you! I am your healthcare portal administrative assistant. How can I assist you with clinic or hospital administration today?";
    }
    if (lang === "GUJARATI_SCRIPT") {
      return "હું એકદમ મજામાં છું, આભાર! હું તમારા હેલ્થકેર પોર્ટલનો એડમિનિસ્ટ્રેટિવ આસિસ્ટન્ટ છું. કહો, આજે હોસ્પિટલ કે ક્લિનિક મેનેજમેન્ટમાં હું તમારી શું સહાયતા કરું?";
    }
    if (lang === "HINDI_SCRIPT") {
      return "मैं बिल्कुल ठीक हूँ, धन्यवाद! मैं आपका हेल्थकेयर पोर्टल प्रशासनिक सहायक हूँ। कहिए, आज अस्पताल या क्लिनिक प्रबंधन में मैं आपकी क्या सहायता करूँ?";
    }
    if (lang === "GUJLISH") {
      return "Hu bilkul majama chhu, aabhar! Hu tamara Doczeno portal no administrative assistant chhu. Kaho, aaje hospital ke clinic administration ma shu madad kari shaku?";
    }
    return "Main bilkul theek hoon, dhanyawad! Main aapka healthcare portal administrative assistant hoon. Kahiye, aaj hospital ya clinic management mein kya sahayata karoon?";
  }

  // 4. Apology
  if (
    /^(sorry|maaf karna|maafi)/i.test(norm) ||
    /^(માફ કરશો|ક્ષમા)/i.test(norm) ||
    /^(माफ करना|माफी|क्षमा)/i.test(norm)
  ) {
    if (lang === "ENGLISH") {
      return "No problem at all! How can I assist you with hospital or clinic administration today?";
    }
    if (lang === "GUJARATI_SCRIPT") {
      return "કોઈ વાંધો નહીં! કહો, હોસ્પિટલ કે ક્લિનિક એડમિનિસ્ટ્રેશનમાં આજે હું તમારી શું મદદ કરી શકું?";
    }
    if (lang === "HINDI_SCRIPT") {
      return "कोई बात नहीं! कहिए, अस्पताल या क्लिनिक प्रशासन में मैं आपकी क्या सहायता कर सकता हूँ?";
    }
    if (lang === "GUJLISH") {
      return "Kain vandho nahi! Kaho, hospital ke clinic administration ma hu tamari shu madad kari shaku?";
    }
    return "Koi baat nahi! Kahiye, hospital ya clinic administration mein main aapki kya madad kar sakta hoon?";
  }

  // 5. Farewells
  if (
    /^(bye|goodbye|alvida|aavjo)/i.test(norm) ||
    /^(આવજો)/i.test(norm) ||
    /^(अलविदा)/i.test(norm)
  ) {
    if (lang === "ENGLISH") {
      return "Goodbye! Take care. Feel free to reach out whenever you need clinic administration support.";
    }
    if (lang === "GUJARATI_SCRIPT") {
      return "આવજો! કાળજી રાખજો. ક્યારેય પણ ક્લિનિક એડમિનિસ્ટ્રેશનની જરૂર હોય ત્યારે જણાવશો.";
    }
    if (lang === "HINDI_SCRIPT") {
      return "अलविदा! अपना ध्यान रखें। कभी भी क्लिनिक प्रशासन में सहायता की आवश्यकता हो तो अवश्य बताएं।";
    }
    if (lang === "GUJLISH") {
      return "Aavjo! Dhyan rakhjo. Tyare pan clinic administration ni zaroorat hoy to janavjo.";
    }
    return "Alvida! Apna khayal rakhein. Kabhi bhi clinic administration ki zaroorat ho toh batayein.";
  }

  // 6. General greetings (hi, hello, namaste, kem cho, etc.)
  if (lang === "ENGLISH") {
    return "Hello! Welcome to the Doczeno healthcare management portal. How can I assist you with hospital administration, doctor rosters, appointments, or clinic settings today?";
  }
  if (lang === "GUJARATI_SCRIPT") {
    return "નમસ્તે! હું Doczeno હેલ્થકેર મેનેજમેન્ટ પોર્ટલનો ઓફિશિયલ એડમિનિસ્ટ્રેટિવ આસિસ્ટન્ટ છું. હોસ્પિટલ મેનેજમેન્ટ, ડોક્ટર્સની માહિતી, એપોઇન્ટમેન્ટ્સ શેડ્યૂલ અથવા ક્લિનિક સેટિંગ્સ માટે આજે હું તમારી શું મદદ કરી શકું?";
  }
  if (lang === "HINDI_SCRIPT") {
    return "नमस्ते! मैं Doczeno हेल्थकेयर मैनेजमेंट पोर्टल का आधिकारिक प्रशासनिक सहायक हूँ। अस्पताल प्रबंधन, डॉक्टरों की सूची, अपॉइंटमेंट्स शेड्यूल या क्लिनिक सेटिंग्स से जुड़ी किसी भी जानकारी के लिए बताएं, आज मैं आपकी क्या सहायता कर सकता हूँ?";
  }
  if (lang === "GUJLISH") {
    return "Namaste! Hu tamara Doczeno healthcare portal no official administrative assistant chhu. Hospital management, doctors ni vigat, upcoming patient appointments schedule ke clinic settings mate kaho, aaje hu tamari shu madad kari shaku?";
  }
  return "Namaste! Main Doczeno healthcare management portal ka official administrative assistant hoon. Hospital management, doctors ki details, upcoming patient appointments schedule ya clinic settings se judi kisi bhi jaankari ke liye batayein, aaj main aapki kya madad kar sakta hoon?";
}

/**
 * Checks if a user message is asking about today's date, day of the week, or tomorrow's date
 */
export function isDateOrDayQuery(message: string): boolean {
  const norm = message.trim().toLowerCase();

  // Gujarati script date/day inquiries
  if (/[\u0A80-\u0AFF]/.test(message)) {
    return /(તારીખ|વાર|દિવસ|આજે|આવતીકાલે|આવતીકાલ|કાલે|પરમ\s*દિવસે)/i.test(message);
  }

  // Hindi script date/day inquiries
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
 * Returns accurate real-world current date and day description in the user's exact language (Plain text only)
 */
export function getRealDateAndDayReply(message: string): string {
  const norm = message.toLowerCase();
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
    return `Today's date is ${todayInfo.dateNum} ${todayInfo.monthName} ${todayInfo.year} (${todayInfo.dateFormatted}), and today is ${todayInfo.dayNameEn}. Tomorrow's date will be ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dayNameEn}).`;
  }

  if (lang === "GUJARATI_SCRIPT") {
    if (isTomorrow) {
      return `આવતીકાલની તારીખ ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dateFormatted}) છે અને તે દિવસે ${tomorrowInfo.dayNameGu} (${tomorrowInfo.dayNameEn}) હશે.`;
    }
    if (isParso) {
      return `પરમ દિવસની તારીખ ${parsoInfo.dateNum} ${parsoInfo.monthName} ${parsoInfo.year} (${parsoInfo.dateFormatted}) છે અને તે દિવસે ${parsoInfo.dayNameGu} (${parsoInfo.dayNameEn}) હશે.`;
    }
    return `આજની તારીખ ${todayInfo.dateNum} ${todayInfo.monthName} ${todayInfo.year} (${todayInfo.dateFormatted}) છે અને આજનો વાર ${todayInfo.dayNameGu} (${todayInfo.dayNameEn}) છે. આવતીકાલે ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dayNameGu}) રહેશે.`;
  }

  if (lang === "HINDI_SCRIPT") {
    if (isTomorrow) {
      return `कल की तारीख ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dateFormatted}) है और दिन ${tomorrowInfo.dayNameHiScript} (${tomorrowInfo.dayNameEn}) होगा।`;
    }
    if (isParso) {
      return `परसों की तारीख ${parsoInfo.dateNum} ${parsoInfo.monthName} ${parsoInfo.year} (${parsoInfo.dateFormatted}) है और दिन ${parsoInfo.dayNameHiScript} (${parsoInfo.dayNameEn}) होगा।`;
    }
    return `आज की तारीख ${todayInfo.dateNum} ${todayInfo.monthName} ${todayInfo.year} (${todayInfo.dateFormatted}) है और आज का दिन ${todayInfo.dayNameHiScript} (${todayInfo.dayNameEn}) है। कल की तारीख ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dayNameHiScript}) होगी।`;
  }

  if (lang === "GUJLISH") {
    if (isTomorrow) {
      return `Kaal ni tarikh ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dateFormatted}) chhe ane vaar ${tomorrowInfo.dayNameEn} (${tomorrowInfo.dayNameHi}) hashe.`;
    }
    if (isParso) {
      return `Parme divas ni tarikh ${parsoInfo.dateNum} ${parsoInfo.monthName} ${parsoInfo.year} (${parsoInfo.dateFormatted}) chhe ane vaar ${parsoInfo.dayNameEn} hashe.`;
    }
    return `Aaj ni tarikh ${todayInfo.dateNum} ${todayInfo.monthName} ${todayInfo.year} (${todayInfo.dateFormatted}) chhe ane aaje ${todayInfo.dayNameEn} (${todayInfo.dayNameHi}) chhe. Kaale ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dayNameEn}) thashe.`;
  }

  // Hinglish
  if (isTomorrow) {
    return `Kal ki tareekh ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dateFormatted}) hai aur din ${tomorrowInfo.dayNameEn} (${tomorrowInfo.dayNameHi}) hoga.`;
  }
  if (isParso) {
    return `Parso ki tareekh ${parsoInfo.dateNum} ${parsoInfo.monthName} ${parsoInfo.year} (${parsoInfo.dateFormatted}) hai aur din ${parsoInfo.dayNameEn} (${parsoInfo.dayNameHi}) hoga.`;
  }
  return `Aaj ki tareekh ${todayInfo.dateNum} ${todayInfo.monthName} ${todayInfo.year} (${todayInfo.dateFormatted}) hai aur aaj ka din ${todayInfo.dayNameEn} (${todayInfo.dayNameHi}) hai. Kal ki tareekh ${tomorrowInfo.dateNum} ${tomorrowInfo.monthName} ${tomorrowInfo.year} (${tomorrowInfo.dayNameEn}) hogi.`;
}

/**
 * Checks if a message is an off-topic / outside question (e.g. Elon Musk, drinking water benefits, politics, recipes)
 */
export function isOutsideOrOffTopicQuery(message: string): boolean {
  const norm = message.trim().toLowerCase();

  // Explicitly allow date, day, and calendar inquiries
  if (isDateOrDayQuery(message)) {
    return false;
  }

  // 1. Celebrities, public figures, politicians, entrepreneurs, tech personalities
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

  // 2. Off-topic "kon hai" / "kaun hai" / "who is" queries (not asking about doctor/staff/admin)
  if (/(kon|kaun|who)\s+(hai|h|he|is|was|chhe)/i.test(norm)) {
    const isClinicalQuery = /\b(doctor|dr|physician|surgeon|staff|admin|patient|roster|user|specialist)\b/i.test(norm);
    if (!isClinicalQuery) {
      return true;
    }
  }

  // 3. General health/nutrition/diet advice or wellness queries (off-topic for portal admin)
  // e.g. "jyada pani pine se kya fayda hota hai", "benefits of drinking water", "weight loss kaise kare"
  const generalHealthPatterns = [
    /\bpani\s+(pine|peene)\b/i,
    /\bdrinking\s+water\b/i,
    /\b(fayda|fayde|benefits?|nuksan)\b.*\b(pani|water|food|khana|diet|sleep|nind|fruit|seb|milk|doodh|juice)\b/i,
    /\b(pani|water|food|khana|diet|sleep|nind|fruit|seb|milk|doodh|juice)\b.*\b(fayda|fayde|benefits?|nuksan)\b/i,
    /\b(vajan|weight\s*loss|weight\s*gain|motapa|fat\s*loss)\b/i,
    /\b(diet\s*plan|diet\s*chart|subah\s*uthke|morning\s*walk|workout|yoga)\b/i,
    /\b(gharelu\s*nuskhe|home\s*remed|totke)\b/i,
    /\b(dawa|medicine|tablet|goli)\s+(batao|de|suggest|kya\s+hai)\b/i,
  ];

  if (generalHealthPatterns.some((p) => p.test(norm))) {
    return true;
  }

  // 4. Other external trivia / weather / entertainment / coding / recipes
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
 * Returns a polite plain-text refusal for outside questions in the exact language of the user
 */
export function getOutsideTopicRefusal(message: string): string {
  const lang = detectLanguage(message);

  if (lang === "ENGLISH") {
    return "I am the official administrative assistant for the Doczeno healthcare platform. I can only assist with hospital management, doctor details, appointments, timings, and clinic administration. I cannot answer external or general knowledge questions. Please let me know how I can assist with clinic administration.";
  }

  if (lang === "GUJARATI_SCRIPT") {
    return "હું Doczeno હેલ્થકેર પ્લેટફોર્મનો ઓફિશિયલ એડમિનિસ્ટ્રેટિવ આસિસ્ટન્ટ છું. હું માત્ર હોસ્પિટલ મેનેજમેન્ટ, ડોક્ટર્સની માહિતી, એપોઇન્ટમેન્ટ્સ, સમય અને ક્લિનિક એડમિનિસ્ટ્રેશનમાં જ મદદ કરી શકું છું. બહારના કે સામાન્ય જ્ઞાનના સવાલોના જવાબ આપવા મારા કાર્યક્ષેત્રમાં નથી. કહો, હોસ્પિટલ કે ક્લિનિક વહીવટમાં શું મદદ જોઈએ છે?";
  }

  if (lang === "HINDI_SCRIPT") {
    return "मैं Doczeno हेल्थकेयर प्लेटफॉर्म का आधिकारिक प्रशासनिक सहायक हूँ। मैं केवल अस्पताल प्रबंधन, डॉक्टरों के विवरण, अपॉइंटमेंट्स, समय और क्लिनिक प्रशासन से जुड़े कार्यों में ही सहायता कर सकता हूँ। बाहरी या सामान्य ज्ञान के प्रश्नों के उत्तर देना मेरे कार्यक्षेत्र में नहीं है। बताएं, अस्पताल या क्लिनिक प्रशासन से जुड़ा क्या कार्य करना है?";
  }

  if (lang === "GUJLISH") {
    return "Hu Doczeno healthcare platform no official administrative assistant chhu. Hu fakt hospital management, doctors ni vigat, appointments, timing ane clinic administration ma madad kari shaku chhu. Bahaar na ke general sawalo na jawab aapi shakto nathi. Kaho, clinic ke hospital mate shu madad joiye chhe?";
  }

  return "Main Doczeno healthcare platform ka official administrative assistant hoon. Main sirf hospital management, doctors ki details, appointments, timings aur clinic administration se jude kaam mein hi madad kar sakta hoon. Bahar ke ya general sawalon ke jawab dena mere daayre mein nahi hai. Kahiye, clinic ya hospital administration se juda kya kaam karna hai?";
}

export const ADMIN_ASSISTANT_TOOL_DECLARATIONS = [
  {
    name: "getHospitalDoctors",
    description: "List all doctors currently affiliated with the administrator's hospital organization.",
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filter by status: ACTIVE or INACTIVE" },
      },
    },
  },
  {
    name: "getDoctorProfile",
    description: "Get detailed profile information for a specific doctor.",
    parameters: {
      type: "object",
      properties: {
        doctorId: { type: "string", description: "Doctor ID to retrieve" },
      },
      required: ["doctorId"],
    },
  },
  {
    name: "getUpcomingAppointments",
    description: "Retrieve upcoming scheduled patient appointments for the doctor or hospital.",
    parameters: {
      type: "object",
      properties: {
        doctorId: { type: "string", description: "Optional doctor ID to filter appointments" },
        limit: { type: "number", description: "Maximum number of appointments to retrieve" },
      },
    },
  },
  {
    name: "getHospitalOverview",
    description: "Retrieve hospital profile details, departments, working hours, and doctor counts.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "updateDoctorProfile",
    description: "Update clinical bio, years of experience, or degree qualifications for a doctor.",
    parameters: {
      type: "object",
      properties: {
        doctorId: { type: "string", description: "Doctor ID to update" },
        bio: { type: "string", description: "Updated clinical biography" },
        yearsOfExperience: { type: "number", description: "Updated years of experience" },
        degree: { type: "string", description: "Updated qualifications" },
      },
      required: ["doctorId"],
    },
  },
  {
    name: "updateHospitalContent",
    description: "Update the hospital tagline or about narrative text.",
    parameters: {
      type: "object",
      properties: {
        tagline: { type: "string", description: "Updated hospital tagline" },
        about: { type: "string", description: "Updated hospital about narrative" },
      },
    },
  },
  {
    name: "updateWebsiteTabTitle",
    description: "Update the public browser tab title for the website.",
    parameters: {
      type: "object",
      properties: {
        tabTitle: { type: "string", description: "New browser tab title" },
      },
      required: ["tabTitle"],
    },
  },
  {
    name: "updateHospitalBranding",
    description: "Update hospital theme or favicon URL.",
    parameters: {
      type: "object",
      properties: {
        selectedTheme: { type: "string", description: "Theme identifier (theme-1, theme-2, theme-3)" },
        faviconUrl: { type: "string", description: "New favicon URL" },
      },
    },
  },
  {
    name: "createDoctor",
    description: "Add a new affiliated doctor to the hospital roster.",
    parameters: {
      type: "object",
      properties: {
        doctorName: { type: "string", description: "Full name of the doctor" },
        degree: { type: "string", description: "Medical degrees (e.g. MBBS, MS)" },
        specialization: { type: "string", description: "Medical specialization" },
        yearsOfExperience: { type: "number", description: "Years of clinical experience" },
        email: { type: "string", description: "Doctor's professional email" },
      },
      required: ["doctorName", "degree", "specialization", "yearsOfExperience", "email"],
    },
  },
  {
    name: "deactivateDoctor",
    description: "DESTRUCTIVE ACTION: Deactivates an affiliated doctor. Requires explicit confirmation from the user.",
    parameters: {
      type: "object",
      properties: {
        doctorId: { type: "string", description: "ID of the doctor to deactivate" },
      },
      required: ["doctorId"],
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
    const candidateModels = Array.from(
      new Set([
        this.model,
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash",
      ])
    );

    let lastError: any = null;
    for (const modelName of candidateModels) {
      const startTime = Date.now();
      try {
        const config: any = {
          systemInstruction: params.systemInstruction,
          maxOutputTokens: 1000,
          temperature: 0.3,
        };
        if (params.tools) {
          config.tools = params.tools;
        }
        if (!modelName.toLowerCase().includes("lite")) {
          config.thinkingConfig = { thinkingBudget: 0 };
        }

        const res = await client.models.generateContent({
          model: modelName,
          contents: params.contents,
          config,
        });

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
   * Executes a backend tool with role checking, tenant isolation, argument validation, and audit logging
   */
  public async executeTool(
    toolName: string,
    args: Record<string, any>,
    user: AuthUserPayload,
    isConfirmed = false
  ): Promise<{ result?: any; requiresConfirmation?: boolean; confirmationPrompt?: string; pendingAction?: IPendingAction }> {
    switch (toolName) {
      // 1. getHospitalDoctors
      case "getHospitalDoctors": {
        const parsed = getHospitalDoctorsArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Invalid arguments for getHospitalDoctors");

        if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPERADMIN) {
          throw new Error("Forbidden: Only hospital administrators or superadmins can list hospital doctors");
        }

        const orgId = user.organizationId;
        if (!orgId && user.role !== UserRole.SUPERADMIN) {
          throw new Error("No organization associated with current administrator");
        }

        const query: any = {};
        if (orgId) query.organizationId = new mongoose.Types.ObjectId(orgId);
        if (parsed.data.status) query.status = parsed.data.status;

        const doctors = await Doctor.find(query)
          .select("doctorName specialization degree yearsOfExperience status email")
          .lean();

        return { requiresConfirmation: false, result: { count: doctors.length, doctors } };
      }

      // 2. getDoctorProfile
      case "getDoctorProfile": {
        const parsed = getDoctorProfileArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Doctor ID is required");

        if (
          (user.role === UserRole.ONLY_DOCTOR || user.role === UserRole.HOSPITAL_DOCTOR) &&
          user.doctorProfileId &&
          user.doctorProfileId.toString() !== parsed.data.doctorId.toString()
        ) {
          throw new Error("Forbidden: Cannot access another doctor's profile");
        }

        const doctor = await Doctor.findById(parsed.data.doctorId);
        if (!doctor) throw new Error("Doctor not found");

        // Tenant check for hospital admin
        if (
          user.role === UserRole.HOSPITAL_ADMIN &&
          user.organizationId &&
          doctor.organizationId &&
          doctor.organizationId.toString() !== user.organizationId.toString()
        ) {
          throw new Error("Forbidden: You cannot access doctors outside your hospital");
        }

        return { requiresConfirmation: false, result: doctor };
      }

      // 3. getUpcomingAppointments
      case "getUpcomingAppointments": {
        const parsed = getUpcomingAppointmentsArgsSchema.safeParse(args);
        const limit = parsed.success && parsed.data.limit ? parsed.data.limit : 10;

        const query: any = { status: { $in: ["PENDING", "CONFIRMED"] } };

        if (user.role === UserRole.ONLY_DOCTOR || user.role === UserRole.HOSPITAL_DOCTOR) {
          if (!user.doctorProfileId) throw new Error("Doctor profile not found for user");
          query.doctorId = new mongoose.Types.ObjectId(user.doctorProfileId);
        } else if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
          query.organizationId = new mongoose.Types.ObjectId(user.organizationId);
          if (parsed.success && parsed.data.doctorId) {
            query.doctorId = new mongoose.Types.ObjectId(parsed.data.doctorId);
          }
        }

        const appointments = await Appointment.find(query)
          .sort({ appointmentDate: 1, startTime: 1 })
          .limit(limit)
          .lean();

        return { requiresConfirmation: false, result: { count: appointments.length, appointments } };
      }

      // 4. getHospitalOverview
      case "getHospitalOverview": {
        const parsed = getHospitalOverviewArgsSchema.safeParse(args);
        const targetOrgId = parsed.success && parsed.data.organizationId ? parsed.data.organizationId : user.organizationId;

        if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPERADMIN) {
          throw new Error("Forbidden: Hospital overview requires hospital admin role");
        }
        if (
          user.role === UserRole.HOSPITAL_ADMIN &&
          user.organizationId &&
          targetOrgId &&
          targetOrgId.toString() !== user.organizationId.toString()
        ) {
          throw new Error("Forbidden: Cannot access another hospital's data");
        }
        if (!targetOrgId && user.role !== UserRole.SUPERADMIN) {
          throw new Error("No organization associated with user");
        }

        const org = await Organization.findById(targetOrgId);
        if (!org) throw new Error("Organization not found");

        const doctorCount = await Doctor.countDocuments({ organizationId: org._id, status: "ACTIVE" });
        const apptCount = await Appointment.countDocuments({ organizationId: org._id, status: "CONFIRMED" });

        return {
          requiresConfirmation: false,
          result: {
            name: org.name,
            type: org.type,
            workingHours: org.workingHours,
            activeDoctors: doctorCount,
            totalDoctors: doctorCount,
            confirmedAppointments: apptCount,
            about: org.about,
          },
        };
      }

      // 5. updateDoctorProfile
      case "updateDoctorProfile": {
        const parsed = updateDoctorProfileArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

        const doctor = await Doctor.findById(parsed.data.doctorId);
        if (!doctor) throw new Error("Doctor not found");

        // Tenant authorization
        const isSelf = user.doctorProfileId && user.doctorProfileId.toString() === doctor._id.toString();
        const isOrgAdmin =
          user.role === UserRole.HOSPITAL_ADMIN &&
          user.organizationId &&
          doctor.organizationId &&
          doctor.organizationId.toString() === user.organizationId.toString();
        const isSuper = user.role === UserRole.SUPERADMIN;

        if (!isSelf && !isOrgAdmin && !isSuper) {
          throw new Error("Forbidden: You do not have permission to update this doctor");
        }

        if (parsed.data.bio !== undefined) doctor.bio = parsed.data.bio;
        if (parsed.data.yearsOfExperience !== undefined) doctor.yearsOfExperience = parsed.data.yearsOfExperience;
        if (parsed.data.degree !== undefined) doctor.degree = parsed.data.degree;

        await doctor.save();

        await AuditLog.create({
          userId: user.userId ? new mongoose.Types.ObjectId(user.userId) : null,
          userRole: user.role as any,
          action: "AI_ASSISTANT_UPDATE_DOCTOR",
          entityType: "Doctor",
          entityId: String(doctor._id),
          details: { updatedFields: parsed.data },
          timestamp: new Date(),
        });

        return { requiresConfirmation: false, result: { message: `Profile updated for Dr. ${doctor.doctorName}`, doctor } };
      }

      // 6. updateHospitalContent
      case "updateHospitalContent": {
        const parsed = updateHospitalContentArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

        if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPERADMIN) {
          throw new Error("Forbidden: Only hospital administrators can update hospital content");
        }

        const org = await Organization.findById(user.organizationId);
        if (!org) throw new Error("Organization not found");

        if (parsed.data.about !== undefined) org.about = parsed.data.about;
        await org.save();

        await AuditLog.create({
          userId: user.userId ? new mongoose.Types.ObjectId(user.userId) : null,
          userRole: user.role as any,
          action: "AI_ASSISTANT_UPDATE_HOSPITAL_CONTENT",
          entityType: "Organization",
          entityId: String(org._id),
          details: { updatedFields: parsed.data },
          timestamp: new Date(),
        });

        return { requiresConfirmation: false, result: { message: `Hospital content updated for ${org.name}` } };
      }

      // 7. updateWebsiteTabTitle
      case "updateWebsiteTabTitle": {
        const parsed = updateWebsiteTabTitleArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Tab title is required");

        let website: any = null;
        if (user.role === UserRole.HOSPITAL_ADMIN && user.organizationId) {
          website = await Website.findOne({ organizationId: new mongoose.Types.ObjectId(user.organizationId) });
        } else if (user.doctorProfileId) {
          website = await Website.findOne({ doctorId: new mongoose.Types.ObjectId(user.doctorProfileId) });
        }

        if (!website) throw new Error("Website not found for current tenant");

        website.seoMetadata = {
          ...website.seoMetadata,
          title: parsed.data.tabTitle,
        };
        await website.save();

        return { requiresConfirmation: false, result: { message: `Website tab title updated to: "${parsed.data.tabTitle}"` } };
      }

      // 8. updateHospitalBranding
      case "updateHospitalBranding": {
        const parsed = updateHospitalBrandingArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Invalid branding arguments");

        if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPERADMIN) {
          throw new Error("Forbidden: Hospital branding requires hospital administrator role");
        }

        const org = await Organization.findById(user.organizationId);
        if (!org) throw new Error("Organization not found");

        if (parsed.data.selectedTheme) org.selectedTheme = parsed.data.selectedTheme;
        if (parsed.data.faviconUrl) org.faviconUrl = parsed.data.faviconUrl;
        await org.save();

        return { requiresConfirmation: false, result: { message: `Branding updated for ${org.name}` } };
      }

      // 9. createDoctor
      case "createDoctor": {
        const parsed = createDoctorArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));

        if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPERADMIN) {
          throw new Error("Forbidden: Only hospital administrators can register new doctors");
        }

        const orgId = user.organizationId;
        if (!orgId) throw new Error("Organization context is missing");

        const slug = parsed.data.doctorName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

        const newDoctor = await Doctor.create({
          organizationId: new mongoose.Types.ObjectId(orgId),
          doctorName: parsed.data.doctorName,
          slug: `dr-${slug}`,
          degree: parsed.data.degree,
          specialization: parsed.data.specialization,
          yearsOfExperience: parsed.data.yearsOfExperience,
          email: parsed.data.email,
          gender: "MALE",
          appointmentRequired: true,
          status: "ACTIVE",
        });

        await AuditLog.create({
          userId: user.userId ? new mongoose.Types.ObjectId(user.userId) : null,
          userRole: user.role as any,
          action: "AI_ASSISTANT_CREATE_DOCTOR",
          entityType: "Doctor",
          entityId: String(newDoctor._id),
          details: { doctorName: newDoctor.doctorName, specialization: newDoctor.specialization },
          timestamp: new Date(),
        });

        return { requiresConfirmation: false, result: { message: `Doctor Dr. ${newDoctor.doctorName} successfully created and added to roster`, doctorId: newDoctor._id } };
      }

      // 10. deactivateDoctor (DESTRUCTIVE ACTION: Explicit Confirmation Required)
      case "deactivateDoctor": {
        const parsed = deactivateDoctorArgsSchema.safeParse(args);
        if (!parsed.success) throw new Error("Doctor ID is required");

        const doctor = await Doctor.findById(parsed.data.doctorId);
        if (!doctor) throw new Error("Doctor not found");

        // Role & Tenant check
        const isOrgAdmin =
          user.role === UserRole.HOSPITAL_ADMIN &&
          user.organizationId &&
          doctor.organizationId &&
          doctor.organizationId.toString() === user.organizationId.toString();
        const isSuper = user.role === UserRole.SUPERADMIN;

        if (!isOrgAdmin && !isSuper) {
          throw new Error("Forbidden: You do not have permission to deactivate this doctor");
        }

        // DESTRUCTIVE ACTION SAFEGUARD: Require explicit confirmation
        if (!isConfirmed) {
          const actionId = new mongoose.Types.ObjectId().toString();
          const prompt = `Are you sure you want to deactivate doctor "Dr. ${doctor.doctorName}"?`;

          return {
            requiresConfirmation: true,
            confirmationPrompt: prompt,
            pendingAction: {
              actionId,
              actionType: "deactivateDoctor",
              toolName: "deactivateDoctor",
              args: { doctorId: String(doctor._id) },
              prompt,
              targetDescription: `Dr. ${doctor.doctorName}`,
              expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            },
            result: {
              doctorStatus: doctor.status,
            },
          };
        }

        // Confirmed execution
        doctor.status = "INACTIVE";
        await doctor.save();

        await AuditLog.create({
          userId: toObjectIdSafe(user.userId),
          userRole: user.role as any,
          action: "CHATBOT_DEACTIVATE_DOCTOR",
          entityType: "Doctor",
          organizationId: toObjectIdSafe(user.organizationId),
          entityId: String(doctor._id),
          details: { doctorName: doctor.doctorName },
          timestamp: new Date(),
        });

        return {
          requiresConfirmation: false,
          result: {
            message: `Dr. ${doctor.doctorName} was deactivated successfully.`,
            status: "INACTIVE",
            doctorStatus: "INACTIVE",
          },
        };
      }

      default:
        throw new Error(`Unrecognized administrative tool: "${toolName}"`);
    }
  }

  /**
   * Processes a turn for the Authenticated Admin AI Assistant
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
    const { user, message, confirmActionId } = params;
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
    }

    // 1. Check for Pending Confirmation Resolution
    if (confirmActionId && conversation.pendingAction) {
      if (conversation.pendingAction.actionId === confirmActionId) {
        if (new Date() > conversation.pendingAction.expiresAt) {
          conversation.pendingAction = null;
          await conversation.save();
          return {
            response: "Confirmation request expired. Please re-trigger the action if still required.",
            sessionId,
            pendingConfirmation: null,
          };
        }

        // Execute confirmed tool
        const toolRes = await this.executeTool(
          conversation.pendingAction.toolName,
          conversation.pendingAction.args,
          user,
          true
        );

        conversation.pendingAction = null;
        const confirmReply = sanitizeToPlainText(
          toolRes.result?.message || "Action confirmed and executed successfully."
        );

        conversation.messages.push({
          role: "user",
          content: message || "Confirmed.",
          timestamp: new Date(),
        });
        conversation.messages.push({
          role: "assistant",
          content: confirmReply,
          timestamp: new Date(),
        });
        await conversation.save();

        return {
          response: confirmReply,
          sessionId,
          pendingConfirmation: null,
        };
      }
    }

    // Check if user is responding "confirm" or "cancel" in natural text to an existing pending action
    if (conversation.pendingAction) {
      const lower = message.trim().toLowerCase();
      if (lower === "confirm" || lower === "yes" || lower.startsWith("yes, ")) {
        const toolRes = await this.executeTool(
          conversation.pendingAction.toolName,
          conversation.pendingAction.args,
          user,
          true
        );

        conversation.pendingAction = null;
        const confirmReply = sanitizeToPlainText(
          toolRes.result?.message || "Action confirmed and executed successfully."
        );

        conversation.messages.push({
          role: "user",
          content: message,
          timestamp: new Date(),
        });
        conversation.messages.push({
          role: "assistant",
          content: confirmReply,
          timestamp: new Date(),
        });
        await conversation.save();

        return {
          response: confirmReply,
          sessionId,
          pendingConfirmation: null,
        };
      }

      if (lower === "cancel" || lower === "no" || lower.startsWith("no, ")) {
        conversation.pendingAction = null;
        const cancelReply = sanitizeToPlainText("Action cancelled. No changes were made.");

        conversation.messages.push({
          role: "user",
          content: message,
          timestamp: new Date(),
        });
        conversation.messages.push({
          role: "assistant",
          content: cancelReply,
          timestamp: new Date(),
        });
        await conversation.save();

        return {
          response: cancelReply,
          sessionId,
          pendingConfirmation: null,
        };
      }
    }

    // 2. Pure Conversational Courtesies (Greetings, OK, Thanks, Sorry) - Fast Path
    if (isConversationalGreeting(message)) {
      const greetingReply = sanitizeToPlainText(getConversationalReply(message));

      conversation.messages.push({
        role: "user",
        content: message,
        timestamp: new Date(),
      });
      conversation.messages.push({
        role: "assistant",
        content: greetingReply,
        timestamp: new Date(),
      });
      await conversation.save();

      return {
        response: greetingReply,
        sessionId,
        pendingConfirmation: null,
      };
    }

    // 2b. Current Date & Day of Week Query (e.g. "aaj konsi date hai", "aaj kya din hai", "kal konsi date hai")
    if (isDateOrDayQuery(message)) {
      const dateReply = sanitizeToPlainText(getRealDateAndDayReply(message));

      conversation.messages.push({
        role: "user",
        content: message,
        timestamp: new Date(),
      });
      conversation.messages.push({
        role: "assistant",
        content: dateReply,
        timestamp: new Date(),
      });
      await conversation.save();

      return {
        response: dateReply,
        sessionId,
        pendingConfirmation: null,
      };
    }

    // 3. Strict Scope Boundary: Block & Refuse Outside / Off-Topic Questions
    if (isOutsideOrOffTopicQuery(message)) {
      const refusalReply = sanitizeToPlainText(getOutsideTopicRefusal(message));

      conversation.messages.push({
        role: "user",
        content: message,
        timestamp: new Date(),
      });
      conversation.messages.push({
        role: "assistant",
        content: refusalReply,
        timestamp: new Date(),
      });
      await conversation.save();

      return {
        response: refusalReply,
        sessionId,
        pendingConfirmation: null,
      };
    }

    // 4. Fetch authenticated practice context for ground-truth factual answering
    let practiceContext = "";
    if (user.organizationId) {
      const org = await Organization.findById(user.organizationId).lean();
      if (org) {
        practiceContext += `\nHospital / Organization Name: ${org.name}\nType: ${org.type}\nWorking Hours: ${org.workingHours || "N/A"}\nPhone: ${org.phone || "N/A"}\nEmail: ${org.email || "N/A"}`;
      }
    }
    if (user.doctorProfileId) {
      const doc = await Doctor.findById(user.doctorProfileId).lean();
      if (doc) {
        practiceContext += `\nDoctor Name: Dr. ${doc.doctorName}\nDegree: ${doc.degree || "N/A"}\nSpecialization: ${doc.specialization || "N/A"}\nExperience: ${doc.yearsOfExperience || 0} years\nClinic: ${doc.clinicName || "N/A"}\nTimings: ${doc.consultationHours || "N/A"}\nWeekly Off: ${doc.weeklyOff || "N/A"}`;
      }
    }

    // 5. Call Assistant with Tool Declarations
    const now = new Date();
    const currentDateStr = now.toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const userLang = detectLanguage(message);

    const systemInstruction = `
You are the official administrative assistant (Copilot) for this healthcare management portal.
You are assisting an authenticated healthcare administrator with role: ${user.role}.
Current Real-World Date: Today is ${currentDateStr}.
Practice Details:
${practiceContext || "Practice details loaded dynamically via tools."}

MANDATORY LANGUAGE MIRRORING DIRECTIVE (CRITICAL):
Detected language of current user message: ${userLang}.
You MUST respond in the EXACT SAME language and script:
1. If English (e.g. user typed in English) -> Write your response in 100% pure, natural, professional English. Absolutely do NOT use any Hindi, Hinglish, or Gujarati words.
2. If Gujarati script (ગુજરાતી લિપિ) -> Write your response in 100% Gujarati script.
3. If Hindi script (हिंदी लिपि / देवनागरी) -> Write your response in 100% Hindi Devanagari script.
4. If Gujlish (Roman Gujarati, e.g. 'kem cho', 'aaje ketla doctor chhe') -> Write your response in natural, polite Gujlish.
5. If Hinglish (Roman Hindi, e.g. 'aaj kitne patient hain', 'appointments batao') -> Write your response in natural, polite Hinglish.
NEVER default to Hinglish when the user writes in English or any other language!

STRICT SCOPE DIRECTIVE (CRITICAL - OUTSIDE QUESTIONS ARE STRICTLY FORBIDDEN):
1. You are strictly and exclusively an administrative assistant for this healthcare portal.
2. Inquiries about today's date, current day of the week, tomorrow's date, or calendar dates relative to appointments are completely allowed and should be answered accurately using the Current Real-World Date.
3. ABSOLUTELY NEVER answer questions outside healthcare administration or this specific clinic/hospital portal.
4. This includes:
   - Celebrities, entrepreneurs, politicians, public figures (e.g. Elon Musk, Modi, etc.)
   - General trivia, world news, entertainment, movies, sports, science, weather, coding, recipes
   - General health advice, diet tips, nutrition, home remedies, wellness theories (e.g. "jyada pani pine se kya fayda hota hai", "benefits of drinking water", "weight loss tips", "exercise benefits")
4. When ANY outside or general question is asked:
   - DO NOT answer the question under any circumstances.
   - Do NOT provide even a partial definition, background, or explanation of the outside topic.
   - Do NOT define who Elon Musk is.
   - Do NOT give reasons why drinking water is healthy.
   - IMMEDIATELY and strictly refuse in plain text in the administrator's exact language (${userLang}), stating that you only assist with Doczeno hospital management, doctors roster, appointments, timings, and clinic administration.
   - Ask how you can assist with hospital, doctors, appointments, or clinic administration.

CONVERSATIONAL & LANGUAGE PRINCIPLES:
1. Speak naturally, politely, and conversationally.
2. Courtesies and greetings like "hi", "hello", "hey", "namaste", "kem chho", "good morning", "thank you", "thanks", "dhanyawad", "ok", "theek hai", "saru", "sorry", "bye" are permitted. Reply politely and warmly in the administrator's exact language (${userLang}), and ask how you can assist with hospital/clinic administration.

STRICT PLAIN TEXT OUTPUT RULES (MANDATORY):
1. Output ONLY pure plain text.
2. NEVER use bold formatting: Do NOT use ** or __ around any word.
3. NEVER use italic formatting: Do NOT use * or _ around any word.
4. NEVER use underline formatting: Do NOT use <u> or HTML tags.
5. NEVER use emojis: Absolutely no emojis of any kind (no symbols, pictographs, or icons).
6. NEVER use markdown headers (# or ##) or markdown links.
7. For lists, use simple numbers without bold titles: e.g. "1. Doctor name - details", NOT "1. **Doctor name:** details".

CRITICAL OPERATIONAL & TENANT RULES:
1. STRICT TENANT ISOLATION & TRUTHFULNESS: Always stay strictly within the authenticated user's organization and permissions. Never access or reveal information from other healthcare practices.
2. ZERO HALLUCINATION / REAL DATA ONLY: Never invent, guess, or assume appointments, patient names, inquiries, doctors, or practice statistics. Only report facts returned by database tools or provided in Practice Details. If there are 0 appointments or 0 inquiries, clearly and accurately state that there are no appointments scheduled.
3. ABSOLUTE SYSTEM PRIVACY: Never reveal or discuss underlying technologies, programming languages, database systems, AI models, engine providers, or secrets. Always identify simply as the official clinic management assistant.
4. When the administrator asks to query or perform administrative actions (e.g. view doctors, get upcoming appointments, update profile/bio, deactivate a doctor), invoke the corresponding tool function.
5. For destructive actions like deactivating a doctor, invoke the deactivateDoctor tool so the system requests confirmation.

ADMINISTRATIVE CONSOLE DIRECTIVE — NEVER SOLICIT APPOINTMENT BOOKINGS (MANDATORY):
1. You are communicating exclusively with authenticated doctors, clinic administrators, hospital management, or platform superadmins inside their private management console. You are NOT talking to patients.
2. ABSOLUTELY NEVER ask the administrator if they want to book an appointment.
3. ABSOLUTELY NEVER propose or offer appointment booking for the user. Administrators do not book patient appointments for themselves here.
4. If the administrator asks to check or list appointments, invoke the getUpcomingAppointments tool to summarize existing patient appointments. But NEVER treat the administrator as a patient seeking medical care or consultation.
`.trim();

    conversation.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    try {
      const geminiResponse = await this.generateContentWithFallback({
        contents: message,
        systemInstruction,
        tools: [{ functionDeclarations: ADMIN_ASSISTANT_TOOL_DECLARATIONS as any }],
        organizationId: user.organizationId,
        doctorId: user.doctorProfileId,
        userId: user.userId,
      });

      // Check if Gemini invoked a tool call
      const functionCalls = geminiResponse.functionCalls;

      if (functionCalls && functionCalls.length > 0 && functionCalls[0]?.name) {
        const fc = functionCalls[0];
        const toolName = fc.name!;
        const toolArgs = (fc.args as Record<string, any>) || {};

        const toolExecution = await this.executeTool(toolName, toolArgs, user, false);

        if (toolExecution.requiresConfirmation && toolExecution.pendingAction) {
          conversation.pendingAction = toolExecution.pendingAction;
          await conversation.save();

          const prompt = sanitizeToPlainText(
            toolExecution.confirmationPrompt || "This action requires confirmation. Confirm?"
          );
          conversation.messages.push({
            role: "assistant",
            content: prompt,
            timestamp: new Date(),
          });
          await conversation.save();

          return {
            response: prompt,
            sessionId,
            pendingConfirmation: toolExecution.pendingAction,
          };
        }

        // Tool ran immediately; provide result summary to user
        const resultString = JSON.stringify(toolExecution.result, null, 2);
        const followUp = await this.generateContentWithFallback({
          contents: `Tool ${toolName} returned result:\n${resultString}\n\nSummarize this cleanly and professionally for the administrator in response to: "${message}". Output pure plain text only, no bold, no italic, no underline, no emojis.\n\nCRITICAL LANGUAGE INSTRUCTION: You MUST write your entire response in the EXACT language used by the administrator (${userLang}):\n- If English, reply in pure English.\n- If Gujarati script, reply in Gujarati script.\n- If Hindi script, reply in Hindi script.\n- If Gujlish, reply in Gujlish.\n- If Hinglish, reply in Hinglish.`,
          systemInstruction,
          organizationId: user.organizationId,
          doctorId: user.doctorProfileId,
          userId: user.userId,
        });

        const rawFinal = followUp.text?.trim() || `Tool ${toolName} executed successfully.`;
        const finalReply = sanitizeToPlainText(rawFinal);

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

      // Plain text conversational answer from assistant
      const rawPlain = geminiResponse.text?.trim() || "How can I assist you with clinic administration today?";
      let plainReply = rawPlain;

      // Safety check: If model answered an outside query despite prompt
      if (
        /elon musk|spacex|tesla|hydration|skin glow|digestion|detoxification/i.test(plainReply) ||
        isOutsideOrOffTopicQuery(message)
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
        `Error processing assistant request: ${err?.message || "Operation failed"}`
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
