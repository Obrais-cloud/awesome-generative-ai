# PrivateAI — Privacy-First Mobile AI Assistant

## MVP Product Requirements Document (PRD)

> Version 1.0 | March 2026

---

## 1. Product Overview

**PrivateAI** is a mobile AI assistant that runs entirely on-device using optimized open-source language models. It works offline, never sends user data to the cloud, and provides a fast, private chat experience.

**Tagline**: "Your AI. Your device. Your data."

## 2. Problem Statement

Every top AI chatbot (ChatGPT, Gemini, Claude, Copilot) requires internet connectivity and sends all conversations to cloud servers. Users in regulated industries, privacy-conscious individuals, and people in low-connectivity areas have no viable mobile AI assistant option.

## 3. Target Users

- **Privacy-conscious consumers** who want AI without data collection
- **Professionals in regulated industries** (healthcare, legal, finance) who can't send client data to third-party servers
- **Travelers and remote workers** who need AI in low/no connectivity environments
- **Technical enthusiasts** interested in running local LLMs on mobile

## 4. Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Downloads | 100K |
| DAU/MAU ratio | 25%+ |
| Premium conversion | 5% |
| App Store rating | 4.5+ |
| Avg. session length | 8+ minutes |

## 5. Core Features (MVP)

### 5.1 On-Device Chat
- Real-time text generation using local LLM
- Streaming token output (word by word)
- Markdown rendering in responses
- Copy/share individual messages

### 5.2 Conversation Management
- Create, rename, delete conversations
- Full conversation history stored locally (SQLite)
- Search across conversations
- Export as text or PDF

### 5.3 Model Management
- Pre-bundled small model (~1B params, ~700MB)
- Download additional models from in-app catalog
- Model info: size, speed, capability description
- Delete downloaded models to free space

### 5.4 Privacy Dashboard
- Visual confirmation: "All data stays on device"
- Storage usage breakdown
- One-tap data wipe
- No analytics, no telemetry, no network calls (in offline mode)

### 5.5 Settings
- Theme: light/dark/system
- Font size adjustment
- Model temperature/creativity slider
- Max response length
- Optional cloud toggle (future premium feature)

## 6. Design Theme

| Property | Value |
|----------|-------|
| Background | `#0F0F0F` (dark), `#FAFAFA` (light) |
| Card style | Rounded, subtle elevation |
| Accent color | `#6C63FF` (indigo/purple) |
| Secondary accent | `#00D9A3` (mint green) |
| Text color | `#E8E8E8` (dark), `#1A1A1A` (light) |
| Corner radius | 16px cards, 24px input, 12px buttons |
| Effects | Subtle blur on headers, smooth spring animations |
| Font | System default (SF Pro / Roboto) |

## 7. Navigation Structure

### Tab Bar (4 tabs)
1. **Chat** (icon: `message-square`) — Active conversation
2. **History** (icon: `clock`) — Past conversations
3. **Models** (icon: `cpu`) — Model management
4. **Settings** (icon: `settings`) — App settings

### Modal Screens
- New conversation modal
- Model download/details modal
- Export options modal
- Privacy dashboard modal

## 8. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 52+, React Native |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| LLM Runtime | llama.rn (React Native bindings for llama.cpp) |
| Local Storage | expo-sqlite for conversations |
| State Management | Zustand |
| Styling | Nativewind (TailwindCSS for RN) |
| Animations | react-native-reanimated |
| Icons | lucide-react-native |
| File Export | expo-file-system + expo-sharing |

## 9. Model Strategy

### MVP Models
| Model | Params | Size (Q4) | Use Case |
|-------|--------|-----------|----------|
| Llama 3.2 1B | 1B | ~700MB | Fast, bundled default |
| Llama 3.2 3B | 3B | ~1.8GB | Better quality, downloadable |
| Phi-3 Mini | 3.8B | ~2.2GB | Best quality, downloadable |

### Quantization
- All models served in Q4_K_M GGUF format
- Balances quality and speed on mobile hardware
- Targeting 10-20 tokens/second on modern devices

## 10. Data Architecture

### Conversation Schema (SQLite)
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  model_id TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  tokens INTEGER,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

### Model Registry (Local JSON)
```json
{
  "models": [
    {
      "id": "llama-3.2-1b",
      "name": "Llama 3.2 1B",
      "filename": "llama-3.2-1b-q4_k_m.gguf",
      "size_bytes": 734003200,
      "description": "Fast and efficient. Great for quick questions.",
      "bundled": true
    }
  ]
}
```

## 11. Privacy Architecture

- **Zero network calls** in offline mode — verified by no network permission requests
- **No analytics SDKs** — no Firebase, no Amplitude, no Mixpanel
- **Local-only storage** — SQLite database in app sandbox
- **No crash reporting** to external services
- **Open source** inference engine (llama.cpp)
- **Transparent model provenance** — all models from Hugging Face with documented licenses

## 12. Monetization

### Free Tier
- Bundled 1B model
- Unlimited conversations
- Full offline functionality
- Basic export (text)

### Premium ($9.99/month)
- Access to larger downloadable models (3B, 3.8B)
- PDF export with formatting
- Cloud burst mode (optional, encrypted)
- Priority model updates
- Custom system prompts

## 13. Launch Strategy

1. **Beta** — TestFlight/Play Store internal testing (2 weeks)
2. **Product Hunt launch** — Emphasize privacy angle
3. **Reddit/HN** — Target r/LocalLLaMA, r/privacy, Hacker News
4. **App Store Optimization** — Keywords: "offline AI", "private AI", "local LLM", "no data collection"

## 14. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| On-device models too slow | Start with 1B model; optimize with Metal/NNAPI |
| Large download size | Progressive model download; clear size warnings |
| Model quality perceived as poor | Set clear expectations; comparison with cloud fallback |
| Apple/Google policy changes | No content generation that violates policies; stick to text chat |
| Battery drain | Background inference limits; battery-aware throttling |

## 15. Future Roadmap (Post-MVP)

- Voice input/output (whisper.cpp on-device)
- Document upload and Q&A (local RAG)
- Image understanding (LLaVA on-device)
- Foldable device optimized layouts
- Apple Watch companion (quick queries)
- Encrypted cloud sync between user's own devices

## 16. Competitive Positioning

```
                    High Quality
                        │
         Cloud AI ──────┼────── PrivateAI (Premium)
         (ChatGPT,      │
          Gemini)        │
                         │
    PrivateAI (Free) ────┼────── Desktop Local AI
                         │       (Ollama, LM Studio)
                         │
                    Low Quality

         Online ─────────────── Offline
```

PrivateAI occupies the unique "offline + mobile" quadrant that no competitor currently serves.
