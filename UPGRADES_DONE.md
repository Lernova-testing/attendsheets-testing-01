# Upgrades Done Record

Last updated: 2026-04-02

## Scope
This file records the security and cleanup upgrades completed across:
- `sheets-backend`
- `sheets-frontend`

## Backend Upgrades (`sheets-backend/main.py`)

### Password Security
- Replaced insecure plain SHA-256 password hashing flow with PBKDF2-based password storage/verification.
- Added legacy hash compatibility during login so existing users can still authenticate.
- Added automatic legacy-to-PBKDF2 hash upgrade on successful login.

### Authentication Handling
- Added auth cookie helper handling (`set_auth_cookie`, `clear_auth_cookie`).
- Updated auth dependency to accept either Bearer token or auth cookie.
- Set `HTTPBearer(auto_error=False)` to support safer fallback auth flow.

### Information Leakage Reduction
- Removed/avoided returning raw internal exception text (`str(e)`) in API responses.
- Replaced sensitive error details with safer generic messages where appropriate.
- Reduced exposure of verification/reset-related internal details.

### Route and Access Hardening
- Resolved duplicate `/auth/verify-email` route conflict by moving old behavior to `/auth/verify-email-legacy`.
- Hardened `/student/request-device`:
  - Added basic in-memory rate-limiting.
  - Reduced account-enumeration behavior by using generic responses for non-existent student cases.
- Hardened `/qr/debug/{class_id}`:
  - Disabled in production.
  - Added ownership checks.
  - Masked sensitive QR code values in output.

### Backend Validation
- `python -m py_compile sheets-backend/main.py` passed after updates.

## Frontend Upgrades (`sheets-frontend`)

### Phase 2 Lint + Type Cleanup
- Removed lint errors caused by `any` and replaced with safer typing (`unknown`, explicit interfaces, guarded parsing).
- Fixed JSX unescaped entity issues (`'` and `"`).
- Fixed internal Next.js navigation issues (`<a>` to `<Link>` for internal routes where required).
- Refactored problematic React state/effect pattern in multi-session attendance modal.

### Shared Utility Hardening and Cleanup
- Updated and cleaned:
  - `lib/debounce.ts`
  - `lib/requestQueue.ts`
  - `lib/fetchWithTimeout.ts`
  - `lib/classService.ts`
  - `lib/contactService.ts`
  - `lib/deviceFingerprint.ts`
  - `types/index.ts`

### Key App/Component Files Updated
- `app/page.tsx`
- `app/about/page.tsx`
- `app/contact/page.tsx`
- `app/dashboard/page.tsx`
- `app/components/AuthVerification.tsx`
- `app/components/DeviceRequestModal.tsx`
- `app/components/PasswordResetModal.tsx`
- `app/components/StudentDevicesModal.tsx`
- `app/components/StudentQRScanner.tsx`
- `app/components/QRAttendanceModal.tsx`
- `app/components/TeacherDeviceRequestsModal.tsx`
- `app/components/dashboard/ChangePasswordModal.tsx`
- `app/components/dashboard/MultiSessionAttendance.tsx`
- `app/components/dashboard/Sidebar.tsx`
- `app/components/dashboard/SnapshotView.tsx`
- `app/components/students/StudentEnrollmentModal.tsx`

### Frontend Validation
- Full lint reached:
  - `0 errors`
  - warnings remaining (non-blocking, mostly unused vars, hook dependency suggestions, and `next/image` recommendations)

## Notes
- No intentional feature removals were made.
- Changes focused on security hardening, safer error handling, typing correctness, and lint stability.
