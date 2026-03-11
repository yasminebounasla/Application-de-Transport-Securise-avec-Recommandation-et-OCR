import { WILAYA_MAP } from "./algerianPlaque.js";

export const extractWilayaFromAddress = (address) => {
  if (!address) return null;

  const state  = (address.state  || "").toLowerCase();
  const county = (address.county || "").toLowerCase();
  const full   = `${state} ${county}`;

  for (const [code, info] of Object.entries(WILAYA_MAP)) {
    if (full.includes(info.nom.toLowerCase())) {
      return { code, ...info };
    }
  }
  return null;
};