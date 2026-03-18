# 04 — Core Architecture

## Architecture Style

**Chosen: Modular Monolith → Microservices (evolutionary)**

| Phase | Users | Architecture |
|-------|-------|-------------|
| 1 | 0-10K | Modular Monolith |
| 2 | 10K-100K | Extract Payment & Fraud |
| 3 | 100K-1M | Full Microservices |
| 4 | 1M+ | Event-Driven |

## System Context Diagram

```
                            ┌──────────────┐
                            │   BRANDS     │
                            │ (Amazon etc) │
                            └──────┬───────┘
                                   │ Verification APIs
┌──────────┐              ┌────────▼────────┐              ┌──────────┐
│  SELLER  │──List/Sell──►│  COUPONBAZAAR   │◄──Browse/Buy─│  BUYER   │
│          │◄──Payouts────│   PLATFORM      │──Code Reveal─►│          │
└──────────┘              └──┬────┬────┬────┘              └──────────┘
                             │    │    │
                    ┌────────┘    │    └────────┐
              ┌─────▼─────┐ ┌────▼─────┐ ┌────▼──────┐
              │ Razorpay  │ │DigiLocker│ │ SMS/Email │
              │ Route     │ │ Aadhaar  │ │ Push/WA   │
              └───────────┘ └──────────┘ └───────────┘
```

## High-Level Architecture

```
           Mobile App (React Native)
                  │
            API Gateway (Nginx/Kong)
            [Rate Limit, JWT Auth, Routing]
                  │
    ┌─────────────────────────────────────┐
    │     APPLICATION SERVER              │
    │     (Modular Monolith)              │
    │                                     │
    │  ┌────────┐ ┌────────┐ ┌────────┐ │
    │  │  USER  │ │VOUCHER │ │TRANSACT│ │
    │  │ Auth   │ │Listing │ │Order   │ │
    │  │ KYC    │ │Search  │ │Escrow  │ │
    │  │ Trust  │ │Verify  │ │Timer   │ │
    │  └────────┘ └────────┘ └────────┘ │
    │  ┌────────┐ ┌────────┐ ┌────────┐ │
    │  │ FRAUD  │ │DISPUTE │ │NOTIFIC │ │
    │  │ Rules  │ │Evidence│ │Push/SMS│ │
    │  │ Score  │ │Resolve │ │Email   │ │
    │  └────────┘ └────────┘ └────────┘ │
    │  ┌────────┐ ┌────────┐            │
    │  │PAYMENT │ │ ADMIN  │            │
    │  │Escrow  │ │Dashboard            │
    │  │Payout  │ │Reports │            │
    │  └────────┘ └────────┘            │
    └──────┬──────────┬──────────┬──────┘
           │          │          │
     PostgreSQL    Redis      AWS S3
     (Primary DB)  (Cache+    (Evidence,
                    Timers)    KYC docs)
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile | React Native (Android + iOS) |
| Backend | Node.js + NestJS (TypeScript) |
| Database | PostgreSQL (AWS RDS) |
| Cache | Redis (ElastiCache) |
| Search | Meilisearch or Elasticsearch |
| Storage | AWS S3 |
| Encryption | AWS KMS |
| Payments | Razorpay Route |
| Push | Firebase Cloud Messaging |
| SMS | MSG91 |
| Email | SendGrid |
| KYC | DigiLocker + HyperVerge |
| Monitoring | CloudWatch + Sentry |