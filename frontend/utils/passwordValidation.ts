export const ALLOWED_PASSWORD_SYMBOLS = "!@#$%&*\u00A7";

export const PASSWORD_RULES = {
  minLength: /^.{8,}$/,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  number: /[0-9]/,
  symbol: /[!@#$%&*\u00A7]/,
} as const;

export type PasswordChecks = {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  symbol: boolean;
};

export const getPasswordChecks = (password: string): PasswordChecks => ({
  minLength: PASSWORD_RULES.minLength.test(password),
  uppercase: PASSWORD_RULES.uppercase.test(password),
  lowercase: PASSWORD_RULES.lowercase.test(password),
  number: PASSWORD_RULES.number.test(password),
  symbol: PASSWORD_RULES.symbol.test(password),
});

export const hasUnsupportedPasswordSymbol = (password: string) =>
  /[^A-Za-z0-9]/.test(password) && !PASSWORD_RULES.symbol.test(password);

const joinWithCommasAndAmpersand = (items: string[]) => {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} & ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} & ${items[items.length - 1]}`;
};

export const getPasswordNeedsMessage = (password: string) => {
  const checks = getPasswordChecks(password);
  const hasUnsupportedSymbol = hasUnsupportedPasswordSymbol(password);

  const unmet: string[] = [];
  if (!checks.minLength) unmet.push("8 characters");
  if (!checks.uppercase) unmet.push("an uppercase");
  if (!checks.lowercase) unmet.push("lowercase");
  if (!checks.number) unmet.push("number");
  if (!checks.symbol || hasUnsupportedSymbol) unmet.push("symbol (!@#$%&*§)");

  if (unmet.length === 0) return null;

  const hasMinLengthUnmet = unmet[0] === "8 characters";
  if (hasMinLengthUnmet && unmet.length > 1) {
    return `Password needs : at least 8 characters with ${joinWithCommasAndAmpersand(
      unmet.slice(1)
    )}.`;
  }

  return `Password needs : at least ${joinWithCommasAndAmpersand(unmet)}.`;
};

export const getPasswordStrength = (checks: PasswordChecks) => {
  const score = Object.values(checks).filter(Boolean).length;

  if (score <= 2) {
    return { label: "Weak", color: "#EF4444", progress: 0.33 };
  }

  if (score <= 4) {
    return { label: "Medium", color: "#F59E0B", progress: 0.66 };
  }

  return { label: "Strong", color: "#10B981", progress: 1 };
};
