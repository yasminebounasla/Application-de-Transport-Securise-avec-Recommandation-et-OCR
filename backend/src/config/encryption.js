import crypto from "node:crypto";
import 'dotenv/config';
const ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "default-key-32-chars-required!";
const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;

if (ENCRYPTION_KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY must be exactly 32 characters");
}

/**
 * Chiffre une chaîne de caractères (ex: NIN)
 * @param {string} text - Texte à chiffrer
 * @returns {string} - Texte chiffré au format "iv:encryptedData"
 */
export function encrypt(text) {
  if (!text) return null;

  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv,
    );

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Déchiffre une chaîne de caractères
 * @param {string} encryptedText - Texte chiffré au format "iv:encryptedData"
 * @returns {string} - Texte déchiffré
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;

  try {
    const parts = encryptedText.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted text format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encryptedData = parts[2];

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      Buffer.from(ENCRYPTION_KEY),
      iv,
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}
export function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY),
    iv,
  );

  // On concatène l'IV au début du résultat chiffré
  const encrypted = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]);
}

export function decryptBuffer(encryptedBuffer) {
  const iv = encryptedBuffer.slice(0, 12);
  const authTag = encryptedBuffer.slice(-AUTH_TAG_LENGTH);
  const encryptedData = encryptedBuffer.slice(12, -AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY),
    iv,
  );
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedData), decipher.final()]);
}
