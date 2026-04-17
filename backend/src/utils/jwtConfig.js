const warnedMessages = new Set();

const warnOnce = (message) => {
  if (warnedMessages.has(message)) return;
  warnedMessages.add(message);
  console.warn(message);
};

export const getJwtSecrets = () => {
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

  if (!accessSecret) {
    throw new Error("JWT_SECRET is missing from backend environment variables.");
  }

  if (!process.env.JWT_REFRESH_SECRET) {
    warnOnce(
      "JWT_REFRESH_SECRET is missing; falling back to JWT_SECRET. Add JWT_REFRESH_SECRET to backend/.env."
    );
  }

  return { accessSecret, refreshSecret };
};
