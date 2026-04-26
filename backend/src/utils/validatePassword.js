export const validatePassword = (password) => {
  const errors = [];

  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*]/.test(password);

  if (password.length < minLength) {
    errors.push("8+ characters");
  }

  if (!hasUpperCase) {
    errors.push("uppercase letter");
  }

  if (!hasLowerCase) {
    errors.push("lowercase letter");
  }

  if (!hasDigit) {
    errors.push("number");
  }

  if (!hasSpecialChar) {
    errors.push("symbol");
  }

  return errors;
};
