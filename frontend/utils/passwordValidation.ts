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
