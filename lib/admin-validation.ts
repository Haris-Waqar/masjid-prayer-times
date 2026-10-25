import { randomInt } from "node:crypto";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const NUMBERS = "23456789";
const SYMBOLS = "!@#$%&*+-=?";
const ALL = `${UPPER}${LOWER}${NUMBERS}${SYMBOLS}`;

export function normalizeAdminEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidAdminEmail(email: string) {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

function pick(characters: string) {
  return characters[randomInt(characters.length)];
}

export function generateTemporaryPassword() {
  const characters = [pick(UPPER), pick(LOWER), pick(NUMBERS), pick(SYMBOLS)];
  while (characters.length < 20) characters.push(pick(ALL));

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }
  return characters.join("");
}
