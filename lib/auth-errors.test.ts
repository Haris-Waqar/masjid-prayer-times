import { describe, expect, it } from "vitest";
import { getSignInErrorMessage } from "@/lib/auth-errors";

describe("sign-in error messages", () => {
  it.each([
    ["invalid_credentials", "The email or password is incorrect."],
    [
      "email_not_confirmed",
      "This email address has not been confirmed. Contact the super administrator.",
    ],
    [
      "user_banned",
      "This account is temporarily unavailable. Contact the super administrator.",
    ],
    [
      "over_request_rate_limit",
      "Too many sign-in attempts. Wait a few minutes before trying again.",
    ],
  ])("maps %s without exposing provider details", (code, expected) => {
    expect(getSignInErrorMessage({ code })).toBe(expected);
  });

  it("distinguishes service and connection failures", () => {
    expect(getSignInErrorMessage({ status: 429 })).toContain(
      "Too many sign-in attempts",
    );
    expect(getSignInErrorMessage({ status: 503 })).toContain(
      "temporarily unavailable",
    );
    expect(getSignInErrorMessage(new Error("Failed to fetch"))).toContain(
      "could not be reached",
    );
  });

  it("uses a safe fallback for unknown errors", () => {
    expect(getSignInErrorMessage({ code: "unknown_provider_error" })).toBe(
      "Sign-in could not be completed. Please try again.",
    );
  });
});
