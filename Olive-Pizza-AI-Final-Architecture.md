# Olive Pizza AI — Final Master AI Architecture

## Objective
Olive Pizza AI becomes the ONLY intelligence platform for the entire Olive Pizza ecosystem.
Everything related to AI must live here.

---

# Responsibilities
Olive Pizza AI owns:
- Customer Assistant
- Owner Assistant
- Developer Assistant
- Prompt Enhancer
- Image Prompt Enhancer
- Product AI
- Combo AI
- Email AI
- Advertisement AI
- SDUI Designer
- Website Designer
- Google Stitch Pipeline
- Multi LLM Router
- RAG
- Knowledge Search
- Analytics Explanation
- Recommendations
- Reasoning
- Planning
- Tool Calling

Nothing else.

---

# Models
Use ONLY:

### Text Models
- GLM 5.2
- DeepSeek V4 Pro
- DeepSeek V4 Flash
- Kimi 2.6
- Qwen 3
- Gemma 4
- GPT OSS 120B

### Image Models
- Qwen Image
- FLUX.1-dev
- FLUX.1-kontext-dev
- FLUX.1-schnell
- Stable Diffusion 3.5 Large

Do not substitute these models.

---

# Knowledge
```
Main Project
     ↓
Cloudflare R2
     ↓
version.json
     ↓
Check version
     ↓
Download only changed JSON
     ↓
knowledge/
     ↓
Local Cache
     ↓
Memory Index
     ↓
RAG
     ↓
LLM
```
Never regenerate knowledge. Never upload knowledge. Download only.

---

# Business Actions
Never execute business logic. Always call Main Backend.

Examples:
- Add Cart
- Apply Coupon
- Place Order
- Track Order
- Cancel Order
- Publish SDUI
- Generate Report
- Create Banner
- Send Notification

Everything uses SDK.

---

# SDUI
```
Prompt
  ↓
Google Stitch
  ↓
Visual Layout
  ↓
Convert to SDUI JSON
  ↓
Preview
  ↓
Owner approves
  ↓
Main Backend publishes
```
AI never publishes directly.

---

# Image Generation
```
Generate
  ↓
Preview
  ↓
Owner approves
  ↓
Main Backend uploads Cloudinary
```
Never upload directly.

---

# Tool Registry
At startup:
- Download available tools from Main Backend.
- Example: Place Order, Track Order, Generate Banner, Publish SDUI, Apply Coupon, Generate Email, etc.
- Never hardcode tools.

---

# Local Memory
Use `knowledge/`:
- `products.json`
- `combos.json`
- `offers.json`
- `ads.json`
- `restaurant.json`
- `faq.json`
- etc.

Load once. Use RAM. Never request R2 every chat.

---

# Resource Target
- 0.1 CPU
- 500MB RAM

Optimize everything.
No local models.
No duplicate Firestore.
No duplicate Pinecone.
No duplicate knowledge.

---

# Verification
Verify:
- Knowledge sync
- Version sync
- Prompt Enhancement
- Image Generation
- SDUI Google Stitch
- Tool Calling
- Business Delegation
- Authentication
- Everything works.

---

# IMPORTANT
If confused: STOP. Open browser. Open ChatGPT. Continue discussion.
