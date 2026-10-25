import { expect, type Page } from "@playwright/test";

export type Credentials = {
  email: string;
  password: string;
};

export function credentialsFromEnv(
  emailKey: string,
  passwordKey: string,
): Credentials | null {
  const email = process.env[emailKey];
  const password = process.env[passwordKey];
  if (!email || !password) return null;
  return { email, password };
}

/** Regular administrator: can publish times, cannot open management. */
export function regularAdmin() {
  return credentialsFromEnv("E2E_ADMIN_EMAIL", "E2E_ADMIN_PASSWORD");
}

/** Administrator who still has to replace a temporary password. */
export function setupAdmin() {
  return credentialsFromEnv("E2E_SETUP_EMAIL", "E2E_SETUP_PASSWORD");
}

export async function signIn(page: Page, credentials: Credentials) {
  await page.goto("/admin/login");
  await page.getByLabel("Authorized email").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}
