# Auth Security Plan — Firebase App Check

## The problem

`POST /auth/otp/request` is a **fully public HTTP endpoint**. Any bot, script, or
fraudster can call it with random Indian phone numbers and rack up Exotel SMS costs.
Your existing per-phone rate limit (5 OTPs/hour) caps per-number cost, but an attacker
with 1,000 numbers burns 5,000 SMS/hour before any block kicks in.

## The solution: App Attestation

Prove every OTP request came from **your signed app binary on a real device** before
Exotel is ever called. Bots and scripts have no valid attestation token → 401 before
any SMS fires.

```
User opens app
      ↓
App Check SDK fetches attestation token from Google/Apple (~100ms, cached 1 hr)
      ↓
POST /auth/otp/request  { phone, ... }  +  x-firebase-appcheck: <token>
      ↓
API verifies token with Firebase (~30ms round trip to Google)
      ↓  token invalid → 401, no SMS
      ↓  token valid
Exotel fires → OTP sent
```

Platform coverage:
- **Android** → Google Play Integrity API (hardware-backed on Android 13+)
- **iOS**     → Apple App Attest

Both are wrapped by the Firebase App Check SDK — one integration covers both.

## What you need to set up (one-time, ~30 mins)

### 1. Firebase project (free)
- Go to console.firebase.google.com → Create project
- Add Android app: package name from `app.json` android config
- Add iOS app: bundle ID from `app.json` ios config
- Download `google-services.json` → place in `apps/mobile/`
- Download `GoogleService-Info.plist` → place in `apps/mobile/`

### 2. Enable App Check in Firebase console
- Firebase console → App Check → Apps
- Android → Play Integrity (recommended, hardware-backed)
- iOS → App Attest
- Set enforcement to **Monitor** first, switch to **Enforce** after confirming traffic

### 3. Service account for the API
- Firebase console → Project Settings → Service Accounts → Generate new private key
- Download the JSON file
- Extract three values for your `.env` / GitHub secrets:
  ```
  FIREBASE_PROJECT_ID=your-project-id
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
  FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
  ```

### 4. EAS Build (replaces Expo Go for development)
`@react-native-firebase` requires native modules → won't run in Expo Go.
Switch to a custom dev client built with EAS:
```bash
npm install -g eas-cli
eas build --profile development --platform android
```
In development, App Check uses a **debug token** (printed to console on first run) —
register this debug token in Firebase console → App Check → Apps → overflow menu →
Manage debug tokens.

## Code changes (when you're ready)

### API
```
apps/api/
  package.json              + firebase-admin
  src/modules/auth/
    app-check.guard.ts      NEW — verifies x-firebase-appcheck header
    auth.controller.ts      + @UseGuards(AppCheckGuard) on POST otp/request only
    auth.module.ts          + AppCheckGuard provider
.env.example                + FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
```

Guard behaviour:
- `NODE_ENV !== 'production'` → guard is bypassed entirely (local dev works without Firebase)
- `NODE_ENV === 'production'`  → missing/invalid token → 401 before Exotel fires

### Mobile
```
apps/mobile/
  package.json              + @react-native-firebase/app, @react-native-firebase/app-check
  app.json                  + @react-native-firebase/app plugin, google-services files config
  src/
    lib/app-check.ts        NEW — init + getToken helper
    lib/api.ts              + x-firebase-appcheck header on requestOtp() only
    app/_layout.tsx         + initAppCheck() call on mount
```

App Check applies **only to OTP requests** — not all API calls. Adding it everywhere
would add a 30ms Firebase call to every request for no benefit, since session tokens
already handle post-login authentication.

## Cost

Firebase App Check: **$0** — it's included in the free Spark plan.
At 10,000 OTP requests/day you are well within free limits.

## What this does NOT protect against

- A real device with a bad actor who creates an account legitimately. Your existing
  5 OTPs/hour/phone limit still covers this.
- Rooted/jailbroken devices (Play Integrity will flag these as MEETS_BASIC_INTEGRITY
  failed — you can choose to reject these in the guard).

## Rollout order

1. Set Firebase to **Monitor** mode (allows all traffic but logs token validity)
2. Deploy API with guard in **log-only** mode (warn but don't reject)
3. Confirm >99% of real app traffic has valid tokens in Firebase console
4. Switch Firebase to **Enforce** + make guard reject invalid tokens
5. Watch Exotel costs drop
