# Error handling

- Expected failures are validation, authentication, authorization, missing records, conflicts, and configuration errors. Return a safe, actionable message with the documented HTTP status.
- Unexpected provider or database failures return a generic 500 response. Log operation, method, path, and a bounded error description for diagnosis.
- Never log passwords, temporary passwords, tokens, secrets, push endpoints/keys, rate-limit identifiers, or email addresses unless the address is indispensable to diagnosis.
- Use 400 for validation, 401 for missing authentication, 403 for insufficient authorization, 404 for missing records, 409 for conflicts, 503 for missing server configuration, and 500 for unexpected failures.
- If a multi-step mutation partially succeeds, compensate immediately. Log a compensation failure with non-secret identifiers and leave the original user-facing response generic.
- Retry only idempotent reads or explicitly idempotent operations. Use bounded attempts with backoff; do not retry validation, authorization, or destructive mutations automatically.
- Preserve the user's entered values after recoverable form failures and move/announce focus to the useful error message.
