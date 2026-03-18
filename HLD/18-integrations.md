# 18 — Integration Map

## All Third-Party Services

### Payments
| Provider | Purpose | Priority |
|----------|---------|----------|
| Razorpay Gateway | Collect payments | P0 (MVP) |
| Razorpay Route | Escrow + splits + payout | P0 (MVP) |
| Razorpay Refunds | Buyer refunds | P0 (MVP) |

### Identity & KYC
| Provider | Purpose | Priority |
|----------|---------|----------|
| DigiLocker | Aadhaar verification | P1 (Month 2) |
| Razorpay/Cashfree | Penny drop bank verification | P1 (Month 2) |
| HyperVerge/IDfy | Liveness detection | P2 (Month 4) |

### Communication
| Provider | Purpose | Priority |
|----------|---------|----------|
| Firebase FCM | Push notifications | P0 (MVP) |
| MSG91 | SMS OTP + alerts | P0 (MVP) |
| SendGrid | Transactional email | P1 (Month 2) |
| Gupshup | WhatsApp | P2 (Month 4) |

### Verification
| Provider | Purpose | Priority |
|----------|---------|----------|
| Amazon (scraping) | Gift card balance check | P1 (Month 3) |
| Flipkart (scraping) | Gift card balance check | P1 (Month 3) |
| AWS Rekognition | Screenshot fraud detection | P2 (Month 4) |

### Monitoring
| Provider | Purpose | Priority |
|----------|---------|----------|
| Sentry | Error tracking | P0 (MVP) |
| Mixpanel | Product analytics | P1 (Month 2) |
| CloudWatch | Infra monitoring | P0 (MVP) |
| Firebase Crashlytics | App stability | P0 (MVP) |

### Security
AWS KMS (encryption), AWS Secrets Manager (credentials), AWS WAF (API protection)