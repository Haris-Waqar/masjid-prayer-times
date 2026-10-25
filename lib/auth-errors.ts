type AuthErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

export function getSignInErrorMessage(error: unknown) {
  const authError = error as AuthErrorLike | null;
  switch (authError?.code) {
    case "invalid_credentials":
      return "The email or password is incorrect.";
    case "email_not_confirmed":
      return "This email address has not been confirmed. Contact the super administrator.";
    case "user_banned":
      return "This account is temporarily unavailable. Contact the super administrator.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many sign-in attempts. Wait a few minutes before trying again.";
    case "captcha_failed":
      return "The security check failed. Refresh the page and try again.";
  }

  if (
    authError?.status === 400 &&
    /invalid login credentials/i.test(authError.message ?? "")
  ) {
    return "The email or password is incorrect.";
  }
  if (authError?.status === 429) {
    return "Too many sign-in attempts. Wait a few minutes before trying again.";
  }

  if (typeof authError?.status === "number" && authError.status >= 500) {
    return "The sign-in service is temporarily unavailable. Please try again shortly.";
  }
  if (
    authError?.message &&
    /failed to fetch|network|timeout|load failed/i.test(authError.message)
  ) {
    return "The sign-in service could not be reached. Check your connection and try again.";
  }
  return "Sign-in could not be completed. Please try again.";
}
