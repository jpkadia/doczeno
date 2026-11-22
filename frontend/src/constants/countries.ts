export interface CountryInfo {
  code: string;
  name: string;
  nativeName?: string;
  dialCode: string;
  flag: string;
  minDigits: number;
  maxDigits: number;
  placeholder: string;
  formatHint: string;
  regex?: RegExp;
  customError?: string;
}

export const COUNTRIES: CountryInfo[] = [
  {
    code: "IN",
    name: "India",
    nativeName: "भारत",
    dialCode: "+91",
    flag: "🇮🇳",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "98765 43210",
    formatHint: "10 digits",
    regex: /^[6-9]\d{9}$/,
    customError: "Indian mobile number must be 10 digits",
  },
  {
    code: "US",
    name: "United States",
    dialCode: "+1",
    flag: "🇺🇸",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "(555) 000-0000",
    formatHint: "10 digits",
    regex: /^[2-9]\d{9}$/,
    customError: "US phone number must be 10 digits",
  },
  {
    code: "GB",
    name: "United Kingdom",
    dialCode: "+44",
    flag: "🇬🇧",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "7911 123456",
    formatHint: "10 digits",
    regex: /^[1-9]\d{9}$/,
    customError: "UK phone number must be 10 digits",
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    nativeName: "الإمارات",
    dialCode: "+971",
    flag: "🇦🇪",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "50 123 4567",
    formatHint: "9 digits",
    regex: /^5\d{8}$/,
    customError: "UAE mobile number must be 9 digits",
  },
  {
    code: "CA",
    name: "Canada",
    dialCode: "+1",
    flag: "🇨🇦",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "(555) 000-0000",
    formatHint: "10 digits",
    regex: /^[2-9]\d{9}$/,
    customError: "Canada phone number must be 10 digits",
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    nativeName: "السعودية",
    dialCode: "+966",
    flag: "🇸🇦",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "50 123 4567",
    formatHint: "9 digits",
    regex: /^5\d{8}$/,
    customError: "Saudi mobile number must be 9 digits",
  },
  {
    code: "AU",
    name: "Australia",
    dialCode: "+61",
    flag: "🇦🇺",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "412 345 678",
    formatHint: "9 digits",
    regex: /^4\d{8}$/,
    customError: "Australian mobile number must be 9 digits",
  },
  {
    code: "SG",
    name: "Singapore",
    dialCode: "+65",
    flag: "🇸🇬",
    minDigits: 8,
    maxDigits: 8,
    placeholder: "8123 4567",
    formatHint: "8 digits",
    regex: /^[89]\d{7}$/,
    customError: "Singapore phone number must be 8 digits",
  },
  {
    code: "HK",
    name: "Hong Kong",
    nativeName: "香港",
    dialCode: "+852",
    flag: "🇭🇰",
    minDigits: 8,
    maxDigits: 8,
    placeholder: "9123 4567",
    formatHint: "8 digits",
    regex: /^\d{8}$/,
    customError: "Hong Kong phone number must be 8 digits",
  },
  {
    code: "HU",
    name: "Hungary",
    nativeName: "Magyarország",
    dialCode: "+36",
    flag: "🇭🇺",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "20 123 4567",
    formatHint: "9 digits",
    regex: /^\d{9}$/,
    customError: "Hungary phone number must be 9 digits",
  },
  {
    code: "IS",
    name: "Iceland",
    nativeName: "Ísland",
    dialCode: "+354",
    flag: "🇮🇸",
    minDigits: 7,
    maxDigits: 7,
    placeholder: "612 3456",
    formatHint: "7 digits",
    regex: /^\d{7}$/,
    customError: "Iceland phone number must be 7 digits",
  },
  {
    code: "ID",
    name: "Indonesia",
    dialCode: "+62",
    flag: "🇮🇩",
    minDigits: 10,
    maxDigits: 12,
    placeholder: "812 3456 7890",
    formatHint: "10-12 digits",
    regex: /^8\d{9,11}$/,
    customError: "Indonesia mobile number must be 10-12 digits",
  },
  {
    code: "IR",
    name: "Iran",
    nativeName: "ایران",
    dialCode: "+98",
    flag: "🇮🇷",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "912 345 6789",
    formatHint: "10 digits",
    regex: /^9\d{9}$/,
    customError: "Iran phone number must be 10 digits",
  },
  {
    code: "IQ",
    name: "Iraq",
    nativeName: "العراق",
    dialCode: "+964",
    flag: "🇮🇶",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "790 123 4567",
    formatHint: "10 digits",
    regex: /^7\d{9}$/,
    customError: "Iraq phone number must be 10 digits",
  },
  {
    code: "QA",
    name: "Qatar",
    nativeName: "قطر",
    dialCode: "+974",
    flag: "🇶🇦",
    minDigits: 8,
    maxDigits: 8,
    placeholder: "3312 3456",
    formatHint: "8 digits",
    regex: /^[3567]\d{7}$/,
    customError: "Qatar phone number must be 8 digits",
  },
  {
    code: "OM",
    name: "Oman",
    nativeName: "عُمان",
    dialCode: "+968",
    flag: "🇴🇲",
    minDigits: 8,
    maxDigits: 8,
    placeholder: "9123 4567",
    formatHint: "8 digits",
    regex: /^[79]\d{7}$/,
    customError: "Oman phone number must be 8 digits",
  },
  {
    code: "KW",
    name: "Kuwait",
    nativeName: "الكويت",
    dialCode: "+965",
    flag: "🇰🇼",
    minDigits: 8,
    maxDigits: 8,
    placeholder: "5123 4567",
    formatHint: "8 digits",
    regex: /^[569]\d{7}$/,
    customError: "Kuwait phone number must be 8 digits",
  },
  {
    code: "BH",
    name: "Bahrain",
    nativeName: "البحرين",
    dialCode: "+973",
    flag: "🇧🇭",
    minDigits: 8,
    maxDigits: 8,
    placeholder: "3612 3456",
    formatHint: "8 digits",
    regex: /^[36]\d{7}$/,
    customError: "Bahrain phone number must be 8 digits",
  },
  {
    code: "DE",
    name: "Germany",
    nativeName: "Deutschland",
    dialCode: "+49",
    flag: "🇩🇪",
    minDigits: 10,
    maxDigits: 11,
    placeholder: "151 23456789",
    formatHint: "10-11 digits",
    regex: /^\d{10,11}$/,
    customError: "German phone number must be 10 or 11 digits",
  },
  {
    code: "FR",
    name: "France",
    dialCode: "+33",
    flag: "🇫🇷",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "6 12 34 56 78",
    formatHint: "9 digits",
    regex: /^[67]\d{8}$/,
    customError: "French mobile number must be 9 digits",
  },
  {
    code: "NP",
    name: "Nepal",
    nativeName: "नेपाल",
    dialCode: "+977",
    flag: "🇳🇵",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "9812345678",
    formatHint: "10 digits",
    regex: /^9\d{9}$/,
    customError: "Nepal phone number must be 10 digits",
  },
  {
    code: "BD",
    name: "Bangladesh",
    nativeName: "বাংলাদেশ",
    dialCode: "+880",
    flag: "🇧🇩",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "1712345678",
    formatHint: "10 digits",
    regex: /^1\d{9}$/,
    customError: "Bangladesh mobile number must be 10 digits",
  },
  {
    code: "LK",
    name: "Sri Lanka",
    nativeName: "ශ්‍රී ලංකාව",
    dialCode: "+94",
    flag: "🇱🇰",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "71 234 5678",
    formatHint: "9 digits",
    regex: /^7\d{8}$/,
    customError: "Sri Lanka mobile number must be 9 digits",
  },
  {
    code: "MY",
    name: "Malaysia",
    dialCode: "+60",
    flag: "🇲🇾",
    minDigits: 9,
    maxDigits: 10,
    placeholder: "12 345 6789",
    formatHint: "9-10 digits",
    regex: /^\d{9,10}$/,
    customError: "Malaysia phone number must be 9 or 10 digits",
  },
  {
    code: "NZ",
    name: "New Zealand",
    dialCode: "+64",
    flag: "🇳🇿",
    minDigits: 9,
    maxDigits: 10,
    placeholder: "21 123 4567",
    formatHint: "9-10 digits",
    regex: /^\d{9,10}$/,
    customError: "New Zealand phone number must be 9 or 10 digits",
  },
  {
    code: "ZA",
    name: "South Africa",
    dialCode: "+27",
    flag: "🇿🇦",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "82 123 4567",
    formatHint: "9 digits",
    regex: /^[6-8]\d{8}$/,
    customError: "South Africa mobile number must be 9 digits",
  },
  {
    code: "JP",
    name: "Japan",
    nativeName: "日本",
    dialCode: "+81",
    flag: "🇯🇵",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "90 1234 5678",
    formatHint: "10 digits",
    regex: /^\d{10}$/,
    customError: "Japan phone number must be 10 digits",
  },
  {
    code: "PH",
    name: "Philippines",
    nativeName: "Pilipinas",
    dialCode: "+63",
    flag: "🇵🇭",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "917 123 4567",
    formatHint: "10 digits",
    regex: /^9\d{9}$/,
    customError: "Philippines mobile number must be 10 digits",
  },
  {
    code: "TH",
    name: "Thailand",
    nativeName: "ไทย",
    dialCode: "+66",
    flag: "🇹🇭",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "81 234 5678",
    formatHint: "9 digits",
    regex: /^[689]\d{8}$/,
    customError: "Thailand mobile number must be 9 digits",
  },
  {
    code: "IE",
    name: "Ireland",
    nativeName: "Éire",
    dialCode: "+353",
    flag: "🇮🇪",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "85 123 4567",
    formatHint: "9 digits",
    regex: /^8\d{8}$/,
    customError: "Ireland mobile number must be 9 digits",
  },
  {
    code: "NL",
    name: "Netherlands",
    nativeName: "Nederland",
    dialCode: "+31",
    flag: "🇳🇱",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "6 12345678",
    formatHint: "9 digits",
    regex: /^6\d{8}$/,
    customError: "Netherlands mobile number must be 9 digits",
  },
  {
    code: "CH",
    name: "Switzerland",
    nativeName: "Schweiz",
    dialCode: "+41",
    flag: "🇨🇭",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "78 123 45 67",
    formatHint: "9 digits",
    regex: /^7\d{8}$/,
    customError: "Switzerland mobile number must be 9 digits",
  },
  {
    code: "SE",
    name: "Sweden",
    nativeName: "Sverige",
    dialCode: "+46",
    flag: "🇸🇪",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "70 123 45 67",
    formatHint: "9 digits",
    regex: /^7\d{8}$/,
    customError: "Sweden mobile number must be 9 digits",
  },
  {
    code: "ES",
    name: "Spain",
    nativeName: "España",
    dialCode: "+34",
    flag: "🇪🇸",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "612 34 56 78",
    formatHint: "9 digits",
    regex: /^[67]\d{8}$/,
    customError: "Spain mobile number must be 9 digits",
  },
  {
    code: "IT",
    name: "Italy",
    nativeName: "Italia",
    dialCode: "+39",
    flag: "🇮🇹",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "312 345 6789",
    formatHint: "10 digits",
    regex: /^3\d{9}$/,
    customError: "Italy mobile number must be 10 digits",
  },
  {
    code: "BR",
    name: "Brazil",
    nativeName: "Brasil",
    dialCode: "+55",
    flag: "🇧🇷",
    minDigits: 11,
    maxDigits: 11,
    placeholder: "11 91234 5678",
    formatHint: "11 digits",
    regex: /^\d{11}$/,
    customError: "Brazil mobile number must be 11 digits",
  },
  {
    code: "MX",
    name: "Mexico",
    nativeName: "México",
    dialCode: "+52",
    flag: "🇲🇽",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "55 1234 5678",
    formatHint: "10 digits",
    regex: /^\d{10}$/,
    customError: "Mexico phone number must be 10 digits",
  },
  {
    code: "TR",
    name: "Turkey",
    nativeName: "Türkiye",
    dialCode: "+90",
    flag: "🇹🇷",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "512 345 6789",
    formatHint: "10 digits",
    regex: /^5\d{9}$/,
    customError: "Turkey mobile number must be 10 digits",
  },
  {
    code: "NG",
    name: "Nigeria",
    dialCode: "+234",
    flag: "🇳🇬",
    minDigits: 10,
    maxDigits: 10,
    placeholder: "801 234 5678",
    formatHint: "10 digits",
    regex: /^[789]\d{9}$/,
    customError: "Nigeria mobile number must be 10 digits",
  },
  {
    code: "KE",
    name: "Kenya",
    dialCode: "+254",
    flag: "🇰🇪",
    minDigits: 9,
    maxDigits: 9,
    placeholder: "712 345678",
    formatHint: "9 digits",
    regex: /^[71]\d{8}$/,
    customError: "Kenya mobile number must be 9 digits",
  },
];

export const DEFAULT_COUNTRY: CountryInfo = COUNTRIES[0]!; // India (+91)

export function getCountryByCode(code: string): CountryInfo {
  return COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase()) ?? DEFAULT_COUNTRY;
}

export function getCountryByDialCode(dialCode: string): CountryInfo {
  const cleanDial = dialCode.startsWith("+") ? dialCode : `+${dialCode}`;
  return COUNTRIES.find((c) => c.dialCode === cleanDial) ?? DEFAULT_COUNTRY;
}

/**
 * Parses any incoming phone string into its matched Country and National Number
 */
export function parsePhoneNumber(raw: string | undefined | null): {
  country: CountryInfo;
  nationalNumber: string;
} {
  if (!raw || !raw.trim()) {
    return { country: DEFAULT_COUNTRY, nationalNumber: "" };
  }

  const trimmed = raw.trim();

  // If starts with +, try matching against known dial codes (longest first to distinguish +971 from +9, etc.)
  if (trimmed.startsWith("+")) {
    const sortedCountries = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const c of sortedCountries) {
      if (trimmed.startsWith(c.dialCode)) {
        const remaining = trimmed.slice(c.dialCode.length).replace(/[^0-9]/g, "");
        return { country: c, nationalNumber: remaining };
      }
    }
  }

  // If numeric string without +, check if it starts with 91 and has 12 digits (India E.164 without plus)
  const allDigits = trimmed.replace(/[^0-9]/g, "");
  if (allDigits.length === 12 && allDigits.startsWith("91")) {
    return { country: DEFAULT_COUNTRY, nationalNumber: allDigits.slice(2) };
  }

  // Otherwise, default to India with the digits entered
  return { country: DEFAULT_COUNTRY, nationalNumber: allDigits };
}

/**
 * Validates a national phone number according to country rules
 */
export function validatePhoneForCountry(
  country: CountryInfo,
  nationalNumber: string
): { isValid: boolean; error?: string } {
  const digits = nationalNumber.replace(/[^0-9]/g, "");

  if (!digits) {
    return { isValid: false, error: "Phone number is required" };
  }

  if (country.minDigits === country.maxDigits) {
    if (digits.length !== country.minDigits) {
      return {
        isValid: false,
        error: `${country.name} requires exactly ${country.minDigits} digits (entered ${digits.length})`,
      };
    }
  } else {
    if (digits.length < country.minDigits || digits.length > country.maxDigits) {
      return {
        isValid: false,
        error: `${country.name} requires between ${country.minDigits} and ${country.maxDigits} digits (entered ${digits.length})`,
      };
    }
  }

  if (country.regex && !country.regex.test(digits)) {
    return {
      isValid: false,
      error: country.customError || `Invalid phone format for ${country.name}`,
    };
  }

  return { isValid: true };
}

/**
 * Formats country dial code + national digits into standard international string
 */
export function formatToInternational(country: CountryInfo, nationalNumber: string): string {
  const cleanDigits = nationalNumber.replace(/[^0-9]/g, "");
  if (!cleanDigits) return "";
  return `${country.dialCode} ${cleanDigits}`;
}

export interface PostalCodeRule {
  label: string;
  placeholder: string;
  regex: RegExp;
  error: string;
}

/**
 * Returns dynamic postal code / PIN code metadata and validation regex by country
 */
export function getPostalCodeRule(countryNameOrCode: string): PostalCodeRule {
  const norm = (countryNameOrCode || "India").trim().toLowerCase();

  if (norm === "india" || norm === "in") {
    return {
      label: "PIN Code",
      placeholder: "Enter PIN code",
      regex: /^[1-9][0-9]{5}$/,
      error: "Must be a valid 6-digit Indian PIN code",
    };
  }

  if (norm === "united states" || norm === "us" || norm === "usa") {
    return {
      label: "ZIP Code",
      placeholder: "Enter ZIP code",
      regex: /^\d{5}(-\d{4})?$/,
      error: "Must be a valid 5-digit US ZIP code",
    };
  }

  if (norm === "united kingdom" || norm === "gb" || norm === "uk") {
    return {
      label: "Postcode",
      placeholder: "Enter postcode",
      regex: /^[A-Za-z]{1,2}\d[A-Za-z\d]? ?\d[A-Za-z]{2}$/,
      error: "Must be a valid UK postcode",
    };
  }

  if (norm === "canada" || norm === "ca") {
    return {
      label: "Postal Code",
      placeholder: "Enter postal code",
      regex: /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/,
      error: "Must be a valid Canadian postal code",
    };
  }

  if (norm === "australia" || norm === "au") {
    return {
      label: "Postcode",
      placeholder: "Enter postcode",
      regex: /^\d{4}$/,
      error: "Must be a valid 4-digit Australian postcode",
    };
  }

  if (norm === "germany" || norm === "de") {
    return {
      label: "Postal Code (PLZ)",
      placeholder: "Enter postal code",
      regex: /^\d{5}$/,
      error: "Must be a valid 5-digit German postal code",
    };
  }

  if (norm === "france" || norm === "fr") {
    return {
      label: "Code Postal",
      placeholder: "Enter code postal",
      regex: /^\d{5}$/,
      error: "Must be a valid 5-digit French postal code",
    };
  }

  if (norm === "singapore" || norm === "sg") {
    return {
      label: "Postal Code",
      placeholder: "Enter postal code",
      regex: /^\d{6}$/,
      error: "Must be a valid 6-digit Singapore postal code",
    };
  }

  if (norm === "saudi arabia" || norm === "sa") {
    return {
      label: "Postal Code",
      placeholder: "Enter postal code",
      regex: /^\d{5}(-\d{4})?$/,
      error: "Must be a valid 5-digit Saudi postal code",
    };
  }

  if (norm.includes("emirates") || norm === "ae") {
    return {
      label: "Postal / Makani Code",
      placeholder: "Enter postal code",
      regex: /^(\d{4,10}|[A-Za-z0-9\s-]{3,10}|00000)$/,
      error: "Must be a valid postal or Makani code",
    };
  }

  return {
    label: "Postal / PIN Code",
    placeholder: "Enter PIN code",
    regex: /^[A-Za-z0-9\s-]{3,10}$/,
    error: "Must be a valid postal code (3-10 characters)",
  };
}

/**
 * Validates a postal code according to country-specific rules
 */
export function validatePostalCodeForCountry(
  countryNameOrCode: string,
  pincode: string
): { isValid: boolean; error?: string } {
  const rule = getPostalCodeRule(countryNameOrCode);
  const trimmed = (pincode || "").trim();

  if (!trimmed) {
    return { isValid: false, error: `${rule.label} is required` };
  }

  if (!rule.regex.test(trimmed)) {
    return { isValid: false, error: rule.error };
  }

  return { isValid: true };
}

