/**
 * country-flags — name → flag-emoji + name → ISO 3166-1 alpha-2 lookup.
 *
 * The recipe mock data (lib/te-mock/recipes.ts) carries country names only
 * (`countriesTop: [{name, score}]`); V4.1 wants to render flags next to
 * each top/bottom-country entry. This file is a small static lookup
 * keyed by the country names that actually appear in the populated recipes.
 *
 * Mockup-only — when the bake ships per-country JSONs the flag will come
 * from `countries/<iso>.json#flag_emoji` (and `iso2`) directly.
 *
 *
 * Flag-rendering note (V4.1 #163)
 * ───────────────────────────────
 * Founder reported flag-emoji not rendering on Windows 10 (Segoe UI Emoji
 * on Win10 ships the regional-indicator pair as plain "IR"/"TM"/etc. — no
 * glyphs). The cross-browser fix is to render flags as `<img>` from
 * flagcdn.com using the alpha-2 code. `iso2For(name)` is the bridge: same
 * name keys as `FLAGS`, returns the lowercase code consumed by the CDN
 * URL pattern `https://flagcdn.com/16x12/{iso2}.png`.
 *
 * Emoji renderer is kept for tooling that runs in environments where the
 * `<img>` request would be undesirable (Storybook screenshot baselines,
 * unit-test diff fixtures) but the canonical user-facing renderer is
 * now image-based.
 */

const FLAGS: Record<string, string> = {
  // MENA
  Iran: "🇮🇷",
  Iraq: "🇮🇶",
  Israel: "🇮🇱",
  Lebanon: "🇱🇧",
  Syria: "🇸🇾",
  Yemen: "🇾🇪",
  "Saudi Arabia": "🇸🇦",
  Qatar: "🇶🇦",
  Egypt: "🇪🇬",
  Tunisia: "🇹🇳",
  Morocco: "🇲🇦",
  Libya: "🇱🇾",
  Algeria: "🇩🇿",
  Jordan: "🇯🇴",
  // Africa
  Sudan: "🇸🇩",
  "South Sudan": "🇸🇸",
  Eritrea: "🇪🇷",
  Ethiopia: "🇪🇹",
  Somalia: "🇸🇴",
  Kenya: "🇰🇪",
  Uganda: "🇺🇬",
  Rwanda: "🇷🇼",
  Burundi: "🇧🇮",
  DRC: "🇨🇩",
  "Congo, DRC": "🇨🇩",
  "Central African Republic": "🇨🇫",
  CAR: "🇨🇫",
  Mali: "🇲🇱",
  "Burkina Faso": "🇧🇫",
  Niger: "🇳🇪",
  Guinea: "🇬🇳",
  Senegal: "🇸🇳",
  Cameroon: "🇨🇲",
  Mozambique: "🇲🇿",
  Nigeria: "🇳🇬",
  Ghana: "🇬🇭",
  Angola: "🇦🇴",
  "Equatorial Guinea": "🇬🇶",
  Zambia: "🇿🇲",
  "South Africa": "🇿🇦",
  Madagascar: "🇲🇬",
  "Sierra Leone": "🇸🇱",
  // Asia
  Pakistan: "🇵🇰",
  Afghanistan: "🇦🇫",
  India: "🇮🇳",
  "Sri Lanka": "🇱🇰",
  Bangladesh: "🇧🇩",
  Nepal: "🇳🇵",
  Bhutan: "🇧🇹",
  China: "🇨🇳",
  "North Korea": "🇰🇵",
  "South Korea": "🇰🇷",
  Japan: "🇯🇵",
  Mongolia: "🇲🇳",
  Taiwan: "🇹🇼",
  Vietnam: "🇻🇳",
  Cambodia: "🇰🇭",
  Laos: "🇱🇦",
  Thailand: "🇹🇭",
  Indonesia: "🇮🇩",
  Philippines: "🇵🇭",
  Malaysia: "🇲🇾",
  Singapore: "🇸🇬",
  Myanmar: "🇲🇲",
  "Myanmar (2011-15)": "🇲🇲",
  // Central Asia
  Kazakhstan: "🇰🇿",
  Uzbekistan: "🇺🇿",
  Turkmenistan: "🇹🇲",
  Tajikistan: "🇹🇯",
  Kyrgyzstan: "🇰🇬",
  // Caucasus
  Armenia: "🇦🇲",
  Azerbaijan: "🇦🇿",
  Georgia: "🇬🇪",
  // Europe (East)
  Russia: "🇷🇺",
  Ukraine: "🇺🇦",
  Belarus: "🇧🇾",
  Moldova: "🇲🇩",
  Poland: "🇵🇱",
  "Czech Republic": "🇨🇿",
  Hungary: "🇭🇺",
  Slovakia: "🇸🇰",
  Romania: "🇷🇴",
  Bulgaria: "🇧🇬",
  Croatia: "🇭🇷",
  Serbia: "🇷🇸",
  Albania: "🇦🇱",
  "North Macedonia": "🇲🇰",
  "Bosnia and Herzegovina": "🇧🇦",
  Slovenia: "🇸🇮",
  Estonia: "🇪🇪",
  Latvia: "🇱🇻",
  Lithuania: "🇱🇹",
  // Europe (West)
  France: "🇫🇷",
  Germany: "🇩🇪",
  "United Kingdom": "🇬🇧",
  Ireland: "🇮🇪",
  Iceland: "🇮🇸",
  Norway: "🇳🇴",
  Sweden: "🇸🇪",
  Finland: "🇫🇮",
  Denmark: "🇩🇰",
  Netherlands: "🇳🇱",
  Belgium: "🇧🇪",
  Switzerland: "🇨🇭",
  Austria: "🇦🇹",
  Italy: "🇮🇹",
  Spain: "🇪🇸",
  Portugal: "🇵🇹",
  Greece: "🇬🇷",
  Cyprus: "🇨🇾",
  Luxembourg: "🇱🇺",
  // Oceania
  "New Zealand": "🇳🇿",
  Australia: "🇦🇺",
  // Americas
  "United States": "🇺🇸",
  Canada: "🇨🇦",
  Mexico: "🇲🇽",
  Argentina: "🇦🇷",
  Brazil: "🇧🇷",
  Chile: "🇨🇱",
  Colombia: "🇨🇴",
  Ecuador: "🇪🇨",
  Peru: "🇵🇪",
  Venezuela: "🇻🇪",
  Uruguay: "🇺🇾",
  Bolivia: "🇧🇴",
  Paraguay: "🇵🇾",
  Cuba: "🇨🇺",
  Nicaragua: "🇳🇮",
  Honduras: "🇭🇳",
  Guatemala: "🇬🇹",
  "El Salvador": "🇸🇻",
  "Costa Rica": "🇨🇷",
  // Other / Special
  Turkey: "🇹🇷",
  "Hong Kong": "🇭🇰",
  // 2026-05-29 gap fills (V4.1 polish)
  "Ivory Coast": "🇨🇮",
  "Côte d'Ivoire": "🇨🇮",
  "Cote d'Ivoire": "🇨🇮",
  Benin: "🇧🇯",
  Togo: "🇹🇬",
  Liberia: "🇱🇷",
  Tanzania: "🇹🇿",
  Zimbabwe: "🇿🇼",
  Botswana: "🇧🇼",
  Namibia: "🇳🇦",
  Lesotho: "🇱🇸",
  Eswatini: "🇸🇿",
  Malawi: "🇲🇼",
  Gabon: "🇬🇦",
  Chad: "🇹🇩",
  "Republic of Congo": "🇨🇬",
  "United Arab Emirates": "🇦🇪",
  Bahrain: "🇧🇭",
  Oman: "🇴🇲",
  Malta: "🇲🇹",
  Montenegro: "🇲🇪",
  Kosovo: "🇽🇰",
  "Dominican Republic": "🇩🇴",
  Haiti: "🇭🇹",
  Jamaica: "🇯🇲",
};

/**
 * ISO 3166-1 alpha-2 codes (lowercase, the form flagcdn.com expects).
 * Keys MUST stay in lock-step with `FLAGS` above — every name renderable
 * as an emoji must also be renderable as a CDN image, otherwise Win10
 * users get an empty placeholder instead of a flag.
 */
const ISO2: Record<string, string> = {
  // MENA
  Iran: "ir",
  Iraq: "iq",
  Israel: "il",
  Lebanon: "lb",
  Syria: "sy",
  Yemen: "ye",
  "Saudi Arabia": "sa",
  Qatar: "qa",
  Egypt: "eg",
  Tunisia: "tn",
  Morocco: "ma",
  Libya: "ly",
  Algeria: "dz",
  Jordan: "jo",
  // Africa
  Sudan: "sd",
  "South Sudan": "ss",
  Eritrea: "er",
  Ethiopia: "et",
  Somalia: "so",
  Kenya: "ke",
  Uganda: "ug",
  Rwanda: "rw",
  Burundi: "bi",
  DRC: "cd",
  "Congo, DRC": "cd",
  "Central African Republic": "cf",
  CAR: "cf",
  Mali: "ml",
  "Burkina Faso": "bf",
  Niger: "ne",
  Guinea: "gn",
  Senegal: "sn",
  Cameroon: "cm",
  Mozambique: "mz",
  Nigeria: "ng",
  Ghana: "gh",
  Angola: "ao",
  "Equatorial Guinea": "gq",
  Zambia: "zm",
  "South Africa": "za",
  Madagascar: "mg",
  "Sierra Leone": "sl",
  // Asia
  Pakistan: "pk",
  Afghanistan: "af",
  India: "in",
  "Sri Lanka": "lk",
  Bangladesh: "bd",
  Nepal: "np",
  Bhutan: "bt",
  China: "cn",
  "North Korea": "kp",
  "South Korea": "kr",
  Japan: "jp",
  Mongolia: "mn",
  Taiwan: "tw",
  Vietnam: "vn",
  Cambodia: "kh",
  Laos: "la",
  Thailand: "th",
  Indonesia: "id",
  Philippines: "ph",
  Malaysia: "my",
  Singapore: "sg",
  Myanmar: "mm",
  "Myanmar (2011-15)": "mm",
  // Central Asia
  Kazakhstan: "kz",
  Uzbekistan: "uz",
  Turkmenistan: "tm",
  Tajikistan: "tj",
  Kyrgyzstan: "kg",
  // Caucasus
  Armenia: "am",
  Azerbaijan: "az",
  Georgia: "ge",
  // Europe (East)
  Russia: "ru",
  Ukraine: "ua",
  Belarus: "by",
  Moldova: "md",
  Poland: "pl",
  "Czech Republic": "cz",
  Hungary: "hu",
  Slovakia: "sk",
  Romania: "ro",
  Bulgaria: "bg",
  Croatia: "hr",
  Serbia: "rs",
  Albania: "al",
  "North Macedonia": "mk",
  "Bosnia and Herzegovina": "ba",
  Slovenia: "si",
  Estonia: "ee",
  Latvia: "lv",
  Lithuania: "lt",
  // Europe (West)
  France: "fr",
  Germany: "de",
  "United Kingdom": "gb",
  Ireland: "ie",
  Iceland: "is",
  Norway: "no",
  Sweden: "se",
  Finland: "fi",
  Denmark: "dk",
  Netherlands: "nl",
  Belgium: "be",
  Switzerland: "ch",
  Austria: "at",
  Italy: "it",
  Spain: "es",
  Portugal: "pt",
  Greece: "gr",
  Cyprus: "cy",
  Luxembourg: "lu",
  // Oceania
  "New Zealand": "nz",
  Australia: "au",
  // Americas
  "United States": "us",
  Canada: "ca",
  Mexico: "mx",
  Argentina: "ar",
  Brazil: "br",
  Chile: "cl",
  Colombia: "co",
  Ecuador: "ec",
  Peru: "pe",
  Venezuela: "ve",
  Uruguay: "uy",
  Bolivia: "bo",
  Paraguay: "py",
  Cuba: "cu",
  Nicaragua: "ni",
  Honduras: "hn",
  Guatemala: "gt",
  "El Salvador": "sv",
  "Costa Rica": "cr",
  // Other / Special
  Turkey: "tr",
  "Hong Kong": "hk",
  // ─── 2026-05-29 gap fills (V4.1 polish — Naila #27) ────────────────
  // Country names surfaced as "flag missing" during the recipe-page audit.
  // Africa
  "Ivory Coast": "ci",
  "Côte d'Ivoire": "ci",
  "Cote d'Ivoire": "ci",
  Benin: "bj",
  Togo: "tg",
  Liberia: "lr",
  Gambia: "gm",
  "Guinea-Bissau": "gw",
  "Cape Verde": "cv",
  Mauritania: "mr",
  Tanzania: "tz",
  Zimbabwe: "zw",
  Botswana: "bw",
  Namibia: "na",
  Lesotho: "ls",
  Eswatini: "sz",
  Malawi: "mw",
  Comoros: "km",
  Djibouti: "dj",
  Gabon: "ga",
  Chad: "td",
  Congo: "cg",
  "Republic of Congo": "cg",
  // Middle East
  "United Arab Emirates": "ae",
  Bahrain: "bh",
  Oman: "om",
  Palestine: "ps",
  // Asia
  Maldives: "mv",
  Brunei: "bn",
  "Timor-Leste": "tl",
  // Europe
  Malta: "mt",
  Liechtenstein: "li",
  Montenegro: "me",
  Kosovo: "xk",
  // Americas
  "Dominican Republic": "do",
  Haiti: "ht",
  Jamaica: "jm",
  Suriname: "sr",
  Guyana: "gy",
  // Oceania
  Fiji: "fj",
};

export function flagFor(name: string): string {
  return FLAGS[name] ?? "🏳️";
}

/**
 * Returns the lowercase ISO 3166-1 alpha-2 code for a country name, or
 * null when the name isn't in the lookup. Callers should render a sized
 * placeholder (preserving the flag's 16×12 footprint) on null so the row
 * grid does not collapse.
 *
 * Lookup is case-sensitive and exact-match: the mock data uses canonical
 * names ("United States", "Equatorial Guinea") and we want a hard miss
 * for unexpected spellings rather than a silent wrong-flag.
 */
export function iso2For(name: string): string | null {
  return ISO2[name] ?? null;
}
