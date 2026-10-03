# 🤖 Olive Pizza AI — Dedicated Intelligence & RAG Service

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Firebase Admin](https://img.shields.io/badge/Firebase_Admin-13.10-FFCA28?logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Pinecone](https://img.shields.io/badge/Pinecone-Vector_RAG-000000?logo=pinecone&logoColor=white)](https://www.pinecone.io/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare_R2-Object_Storage-F38020?logo=cloudflare&logoColor=white)](https://cloudflare.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red.svg)]()

> **Olive Pizza AI** is the dedicated, separate AI intelligence layer serving the Olive Pizza multi-application ecosystem. Responsible for customer AI assistance, owner analytics reasoning, developer diagnostics, RAG knowledge retrieval, and prompt enhancements.

---

## 🏗️ Architecture & Component Overview

```text
Olive Pizza AI/
├── backend/                  # AI Intelligence Server (Port 5001)
│   ├── src/
│   │   ├── config/           # Firebase Admin, Pinecone, Cloudflare R2, secrets.ts
│   │   ├── controllers/      # Chat, health, and event controllers
│   │   ├── middleware/       # Firebase ID token verification, role gates, HMAC service auth
│   │   ├── routes/           # Role-scoped chat & event routes
│   │   ├── services/         # Vector RAG, tool execution, LLM orchestrators
│   │   └── tests/            # Unit & security test suites
│   └── server.ts             # Entry point with strict CORS allowlist
└── frontend/                 # AI Diagnostic Studio
```

---

## 🏛️ Ecosystem Relationship & Principles

1. **Olive Pizza AI is the Intelligence Layer**:
   - Customer AI Assistant & Recommendations
   - Owner AI Operational Assistant & Analytics Reasoning
   - Developer AI Diagnostics
   - Vector RAG & Knowledge Retrieval (Pinecone / Cloudflare R2)
   - Prompt Enhancement for Products, Combos, and Visual Generation
2. **Business Operations Remain in the Central Backend**:
   - The AI service does **NOT** maintain an independent database for orders, users, inventory, or cart states.
   - Any requested business action (e.g., "Add Margherita Pizza to cart") is securely delegated to the Canonical Central Backend via authenticated service calls.
3. **No Mock Authentication**:
   - All client chat interactions require a verified Firebase ID token verified against Firebase Admin with revocation checks (`checkRevoked: true`).
   - Business tools fail closed (`AUTH_REQUIRED`) if a valid caller token is not present.
4. **Server-to-Server HMAC Security**:
   - Event ingestion (`/api/ai/events`) requires a timing-safe HMAC-SHA256 signature generated with `AI_GATEWAY_SECRET`.
   - Zero fallback secrets; operations fail closed if secrets are missing in production.

---

## 🔒 Security & Authorization Model

| Route / Capability | Authentication / Role Required | Description |
| :--- | :--- | :--- |
| `POST /api/ai/chat/customer` | Verified Firebase Token (`customer`, `staff`, `owner`) | Customer conversational assistant & food recommendations. |
| `POST /api/ai/chat/owner` | Verified Token (`owner`, `developer`) | Executive metrics explanation and operational insights. |
| `POST /api/ai/chat/developer` | Verified Token (`developer` only) | System diagnostics and architecture inspection. |
| `POST /api/ai/events` | HMAC-SHA256 Signature (`X-Signature`) | Canonical backend event stream ingestion for AI memory. |
| `GET /health` | Public | Minimal health probe returning `{ status: 'healthy', timestamp }`. |

---

## ⚡ Getting Started

### 1. Prerequisites
- Node.js `v20+` or `v22+`
- Canonical Central Backend running on `http://localhost:5000`
- Firebase Admin SDK credentials
- Pinecone API Key & Index

### 2. Installation
```bash
cd backend
npm install
```

### 3. Environment Configuration
Configure `.env` in `backend/`:
```env
PORT=5001
AI_GATEWAY_SECRET=your_secure_hmac_secret
MAIN_BACKEND_URL=http://localhost:5000
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX=olive-pizza-knowledge
CLOUDFLARE_R2_BUCKET=olive-pizza-knowledge
```

### 4. Running Locally
```bash
npm run dev
```

---

## 🧪 Testing & Verification

```bash
# Run TypeScript compilation check
npm run typecheck

# Run automated security and middleware tests
npm test
```

---

## 📜 License

Proprietary © Olive Pizza. All rights reserved.
