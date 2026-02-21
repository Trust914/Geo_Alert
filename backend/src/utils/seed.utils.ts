// Manual lookup for state names to their actual state codes
export const STATE_CODE_LOOKUP: Record<string, string> = {
  Abia: "AB",
  Adamawa: "AD",
  "Akwa Ibom": "AK",
  Anambra: "AN",
  Bauchi: "BA",
  Bayelsa: "BY",
  Benue: "BE",
  Borno: "BO",
  "Cross River": "CR",
  Delta: "DE",
  Ebonyi: "EB",
  Edo: "ED",
  Ekiti: "EK",
  Enugu: "EN",
  Gombe: "GO",
  Imo: "IM",
  Jigawa: "JI",
  Kaduna: "KD",
  Kano: "KN",
  Katsina: "KT",
  Kebbi: "KE",
  Kogi: "KO",
  Kwara: "KW",
  Lagos: "LA",
  Nasarawa: "NA",
  Niger: "NI",
  Ogun: "OG",
  Ondo: "ON",
  Osun: "OS",
  Oyo: "OY",
  Plateau: "PL",
  Rivers: "RI",
  Sokoto: "SO",
  Taraba: "TA",
  Yobe: "YO",
  Zamfara: "ZA",
  "Federal Capital Territory": "FC",
};

export function getStateCode(stateName: string): string {
  const code = STATE_CODE_LOOKUP[stateName];
  if (!code) throw new Error(`Missing State Code lookup for: ${stateName}`);
  return code;
}

export function escapeSqlString(str: string): string {
  return str.replace(/'/g, "''");
}

export function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .replace(/[\/\s_]+/g, "-") // Replace / and space with -
    .replace(/[^a-z0-9\-]/g, ""); // Remove any other special chars
}

export const makeKey = (...parts: string[]) => parts.map(normalizeName).join(":");
