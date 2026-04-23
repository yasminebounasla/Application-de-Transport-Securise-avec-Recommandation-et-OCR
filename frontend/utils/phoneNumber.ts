export type CountryPhoneOption = {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  placeholder: string;
  localLengths: number[];
  localPattern?: RegExp;
  localRuleMessage?: string;
};

export const COUNTRY_PHONE_OPTIONS: CountryPhoneOption[] = [
  { code: "DZ", name: "Algeria", dialCode: "+213", flag: "🇩🇿", placeholder: "551234567", localLengths: [9], localPattern: /^[567]\d{8}$/, localRuleMessage: "For Algeria, enter a mobile number starting with 5, 6, or 7." },
  { code: "TN", name: "Tunisia", dialCode: "+216", flag: "🇹🇳", placeholder: "20123456", localLengths: [8], localPattern: /^[2459]\d{7}$/, localRuleMessage: "For Tunisia, enter an 8-digit number starting with 2, 4, 5, or 9." },
  { code: "MA", name: "Morocco", dialCode: "+212", flag: "🇲🇦", placeholder: "612345678", localLengths: [9], localPattern: /^[67]\d{8}$/, localRuleMessage: "For Morocco, enter a 9-digit number starting with 6 or 7." },
  { code: "LY", name: "Libya", dialCode: "+218", flag: "🇱🇾", placeholder: "912345678", localLengths: [9], localPattern: /^9\d{8}$/, localRuleMessage: "For Libya, enter a 9-digit mobile number starting with 9." },
  { code: "EG", name: "Egypt", dialCode: "+20", flag: "🇪🇬", placeholder: "1001234567", localLengths: [10], localPattern: /^1\d{9}$/, localRuleMessage: "For Egypt, enter a 10-digit mobile number starting with 1." },
  { code: "MR", name: "Mauritania", dialCode: "+222", flag: "🇲🇷", placeholder: "22123456", localLengths: [8], localPattern: /^[2-4]\d{7}$/, localRuleMessage: "For Mauritania, enter an 8-digit number starting with 2, 3, or 4." },
  { code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷", placeholder: "612345678", localLengths: [9], localPattern: /^[67]\d{8}$/, localRuleMessage: "For France, enter a 9-digit mobile number starting with 6 or 7." },
  { code: "BE", name: "Belgium", dialCode: "+32", flag: "🇧🇪", placeholder: "470123456", localLengths: [9], localPattern: /^4\d{8}$/, localRuleMessage: "For Belgium, enter a 9-digit mobile number starting with 4." },
  { code: "ES", name: "Spain", dialCode: "+34", flag: "🇪🇸", placeholder: "612345678", localLengths: [9], localPattern: /^[67]\d{8}$/, localRuleMessage: "For Spain, enter a 9-digit mobile number starting with 6 or 7." },
  { code: "IT", name: "Italy", dialCode: "+39", flag: "🇮🇹", placeholder: "3123456789", localLengths: [10], localPattern: /^3\d{9}$/, localRuleMessage: "For Italy, enter a 10-digit mobile number starting with 3." },
  { code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪", placeholder: "15123456789", localLengths: [10, 11], localPattern: /^1[5-7]\d{8,9}$/, localRuleMessage: "For Germany, enter a mobile number starting with 15, 16, or 17." },
  { code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱", placeholder: "612345678", localLengths: [9], localPattern: /^6\d{8}$/, localRuleMessage: "For the Netherlands, enter a 9-digit mobile number starting with 6." },
  { code: "CH", name: "Switzerland", dialCode: "+41", flag: "🇨🇭", placeholder: "781234567", localLengths: [9], localPattern: /^7[5-9]\d{7}$/, localRuleMessage: "For Switzerland, enter a 9-digit mobile number starting with 75, 76, 77, 78, or 79." },
  { code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧", placeholder: "7123456789", localLengths: [10], localPattern: /^7\d{9}$/, localRuleMessage: "For the United Kingdom, enter a 10-digit mobile number starting with 7." },
  { code: "IE", name: "Ireland", dialCode: "+353", flag: "🇮🇪", placeholder: "851234567", localLengths: [9], localPattern: /^8\d{8}$/, localRuleMessage: "For Ireland, enter a 9-digit mobile number starting with 8." },
  { code: "TR", name: "Turkey", dialCode: "+90", flag: "🇹🇷", placeholder: "5012345678", localLengths: [10], localPattern: /^5\d{9}$/, localRuleMessage: "For Turkey, enter a 10-digit mobile number starting with 5." },
  { code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪", placeholder: "501234567", localLengths: [9], localPattern: /^5\d{8}$/, localRuleMessage: "For the UAE, enter a 9-digit mobile number starting with 5." },
  { code: "SA", name: "Saudi Arabia", dialCode: "+966", flag: "🇸🇦", placeholder: "501234567", localLengths: [9], localPattern: /^5\d{8}$/, localRuleMessage: "For Saudi Arabia, enter a 9-digit mobile number starting with 5." },
  { code: "QA", name: "Qatar", dialCode: "+974", flag: "🇶🇦", placeholder: "33123456", localLengths: [8], localPattern: /^[3567]\d{7}$/, localRuleMessage: "For Qatar, enter an 8-digit number starting with 3, 5, 6, or 7." },
  { code: "KW", name: "Kuwait", dialCode: "+965", flag: "🇰🇼", placeholder: "51234567", localLengths: [8], localPattern: /^[569]\d{7}$/, localRuleMessage: "For Kuwait, enter an 8-digit mobile number starting with 5, 6, or 9." },
  { code: "BH", name: "Bahrain", dialCode: "+973", flag: "🇧🇭", placeholder: "36001234", localLengths: [8], localPattern: /^(3|6)\d{7}$/, localRuleMessage: "For Bahrain, enter an 8-digit number starting with 3 or 6." },
  { code: "OM", name: "Oman", dialCode: "+968", flag: "🇴🇲", placeholder: "92123456", localLengths: [8], localPattern: /^[79]\d{7}$/, localRuleMessage: "For Oman, enter an 8-digit mobile number starting with 7 or 9." },
  { code: "JO", name: "Jordan", dialCode: "+962", flag: "🇯🇴", placeholder: "790123456", localLengths: [9], localPattern: /^7\d{8}$/, localRuleMessage: "For Jordan, enter a 9-digit mobile number starting with 7." },
  { code: "LB", name: "Lebanon", dialCode: "+961", flag: "🇱🇧", placeholder: "71123456", localLengths: [8], localPattern: /^(3|7|8)\d{7}$/, localRuleMessage: "For Lebanon, enter an 8-digit number starting with 3, 7, or 8." },
  { code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦", placeholder: "5551234567", localLengths: [10], localPattern: /^[2-9]\d{2}[2-9]\d{6}$/, localRuleMessage: "For Canada, enter a 10-digit number with a valid area code and exchange code." },
  { code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸", placeholder: "5551234567", localLengths: [10], localPattern: /^[2-9]\d{2}[2-9]\d{6}$/, localRuleMessage: "For the United States, enter a 10-digit number with a valid area code and exchange code." },
  { code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽", placeholder: "5512345678", localLengths: [10], localPattern: /^[1-9]\d{9}$/, localRuleMessage: "For Mexico, enter a 10-digit number." },
];

export const DEFAULT_COUNTRY_PHONE = COUNTRY_PHONE_OPTIONS[0];

export const getCountryPhoneOption = (countryCode?: string) =>
  COUNTRY_PHONE_OPTIONS.find((country) => country.code === countryCode) ||
  DEFAULT_COUNTRY_PHONE;

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

export const normalizeLocalPhoneNumber = (
  value: string,
  country: CountryPhoneOption = DEFAULT_COUNTRY_PHONE,
) => {
  const digits = digitsOnly(value);

  if (!digits) return "";

  if (digits.startsWith("0")) {
    return digits.replace(/^0+/, "");
  }

  return digits;
};

export const validatePhoneNumberForCountry = (
  value: string,
  country: CountryPhoneOption = DEFAULT_COUNTRY_PHONE,
) => {
  const normalized = normalizeLocalPhoneNumber(value, country);

  if (!normalized) {
    return "Phone number is required.";
  }

  if (!country.localLengths.includes(normalized.length)) {
    const allowedLengths = country.localLengths.join(" or ");
    return `${country.name} phone numbers must be ${allowedLengths} digits.`;
  }

  if (country.localPattern && !country.localPattern.test(normalized)) {
    return country.localRuleMessage || `${country.name} phone number format looks invalid.`;
  }

  return "";
};

export const buildInternationalPhoneNumber = (
  value: string,
  country: CountryPhoneOption = DEFAULT_COUNTRY_PHONE,
) => `${country.dialCode}${normalizeLocalPhoneNumber(value, country)}`;

export const getCountryPhoneOptionFromInternationalNumber = (value?: string) => {
  const normalized = String(value ?? "").trim();

  if (!normalized.startsWith("+")) {
    return null;
  }

  return [...COUNTRY_PHONE_OPTIONS]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((country) => normalized.startsWith(country.dialCode)) || null;
};

export const formatPhoneNumberForDisplay = (value?: string) => {
  const rawValue = String(value ?? "").trim();
  if (!rawValue) return "";

  const country = getCountryPhoneOptionFromInternationalNumber(rawValue);
  if (!country) return rawValue;

  const localDigits = digitsOnly(rawValue.slice(country.dialCode.length));
  if (!localDigits) return rawValue;

  const localWithZero = `0${localDigits}`;
  return localWithZero;
};

export const getCallablePhoneNumber = (value?: string) => {
  const formatted = formatPhoneNumberForDisplay(value);
  return formatted || String(value ?? "").trim();
};
