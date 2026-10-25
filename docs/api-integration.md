# API integration

- Every protected handler authenticates the current user and authorizes the operation independently. Never rely on a hidden link or page redirect as authorization.
- Validate JSON type, required fields, formats, and practical size limits before mutation. Normalize email addresses by trimming and lowercasing.
- Success responses use `{ "ok": true, ... }`; failures use `{ "error": "safe message" }`.
- Return only purpose-built DTOs. Sensitive responses use `Cache-Control: no-store`; management endpoints should default to no-store.
- Keep the Supabase admin client isolated in server-only modules. Browser code may use only the publishable client and must never receive service credentials or raw privileged records.
- Design creation endpoints to reject duplicates before mutation and handle provider conflicts. Compensate for later failures after an external resource is created.
- Add timeouts/abort signals to calls that can outlive a user request when provider support permits. Client reads should cancel stale requests.
- Route tests must cover unauthenticated and unauthorized access, validation, successful DTO shape, provider/database failure, conflicts, compensation, and cache headers.
- Destructive operations identify one exact resource, reject protected/self targets, and avoid automatic retries.
- Reversible access changes update `admin_members.active`; all protected handlers
  must check current active membership so revoked sessions cannot continue using APIs.
