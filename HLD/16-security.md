# 16 — Security Architecture

## Layer 1: Network
- AWS WAF, CloudFront (DDoS via Shield), VPC private subnets, Security Groups, TLS everywhere

## Layer 2: Application
- JWT auth (30-min access, 7-day refresh rotation)
- Rate limiting per endpoint (Redis)
- Input validation, OWASP Top 10 protection
- API versioning, request signing for sensitive ops

## Layer 3: Data

### Voucher Codes (Most Critical)
- AES-256-GCM encryption at rest
- Keys in AWS KMS (never in app code), rotated every 90 days
- Decryption only via authorized call, every access logged
- Code hash (SHA-256) stored separately for dedup

### User Data
- Aadhaar: NEVER stored (only hash)
- Phone, bank account: Encrypted
- KYC docs: Encrypted in S3
- No passwords (OTP-based auth)

### Database
- RDS encryption at rest, SSL connections enforced
- No direct DB access, daily encrypted backups (30-day retention)

## Layer 4: Client-Side
- Certificate pinning, root/jailbreak detection
- Secure storage (Keychain/Keystore)
- Code obfuscation (ProGuard/R8)
- Screenshot prevention on code reveal screen
- Biometric/PIN for sensitive operations

## Layer 5: Audit
- Immutable append-only audit log
- Every state change: actor + timestamp + IP + device
- PII access logging, admin action logging
- Data deletion capability (DPDP Act compliance)