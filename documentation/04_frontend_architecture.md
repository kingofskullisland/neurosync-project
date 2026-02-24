# 4. Frontend Architecture (Mobile Client)

## 4.1 Tech Stack
The mobile client is built on a modern, high-performance stack designed for cross-platform compatibility and native-like feel.

*   **Framework**: Expo (SDK 54) + React Native (0.76).
*   **Routing**: Expo Router (File-based routing).
*   **Styling**: NativeWind v4 (Tailwind CSS for React Native).
*   **Language**: TypeScript (Strict Mode).
*   **State Management**: React Context + Local Storage (`AsyncStorage`) + URL State.

## 4.2 Directory Structure
The project follows the standard Expo Router structure, but with a specific organizational philosophy:

```
app/
├── (tabs)/             # Main tab navigation
│   ├── index.tsx       # The "Chat" screen (Home)
│   ├── history.tsx     # Chat history log
│   └── settings.tsx    # Configuration & Connection setup
├── _layout.tsx         # Root layout (Providers, Theme)
├── [..].tsx            # Dynamic routes (if any)
components/             # Reusable UI atoms
├── BeamMonitor.tsx     # Signal strength visualizer
├── ChatBubble.tsx      # Message renderer
├── GlitchText.tsx      # Cyberpunk text effect
└── ModelPicker.tsx     # AI model selector
lib/                    # Business Logic (Pure TS)
├── api.ts              # HTTP Client logic
├── neurobeam.ts        # P2P Client logic
└── storage.ts          # Persistence layer
```

---

## 4.3 Key Components

### 4.3.1 `BeamMonitor.tsx`
A visual component that represents the state of the NeuroBeam connection. It uses `Animated` API to creating pulsing heartbeat effects based on connection latency.
*   **States**: `IDLE` (Gray), `SCANNING` (Amber Pulse), `LOCKED` (Red Solid), `ERROR` (Red Blink).
*   **Function**: Polling the `NeuroBeam` singleton for stats every 100ms.

### 4.3.2 `GlitchText.tsx`
Implements the "Cyberpunk 2077" text glitch effect.
*   **Logic**: Randomly replaces characters with special symbols (`$`, `#`, `%`, `&`) during mounting, then stabilizes to the correct text.
*   **Usage**: Headers, Titles, and System Alerts.

---

## 4.4 State Management Strategy

### 4.4.1 Ephemeral State (React `useState`)
Used for input fields, loading spinners, and immediate UI feedback. Cleared on app restart.

### 4.4.2 Persistent State (`AsyncStorage`)
Used for critical user data that must survive restarts:
*   **Settings (`AppSettings`)**:
    *   `vpnIp`: The IP address of the NeuroSync Router.
    *   `selectedModel`: The preferred AI model (e.g., `llama3.2`).
    *   `systemPersona`: The chosen personality (e.g., `HADRON`).
*   **Chat History**: Stores the last 50 messages for context continuity.

### 4.4.3 Network State (`lib/api.ts`)
The `checkHealth` function is the source of truth for connectivity.
*   It pings `/health` on the backend.
*   It distinguishes between **Bridge Online** (The Python server is reachable) vs **Ollama Online** (The AI engine is loaded).
*   This distinction is crucial for debugging: "Why can I connect to the server but the AI won't reply?" (Likely Ollama is crashed or model is unloading).

---

## 4.5 Styling Philosophy (NativeWind)
We use utility classes for 95% of styling.
*   **Theme**: Defined in `tailwind.config.js`.
*   **Colors**: custom `neon-red`, `neon-blue` palette.
*   **Font**: Monospace (Courier/Roboto Mono) for that "Terminal" aesthetic.
