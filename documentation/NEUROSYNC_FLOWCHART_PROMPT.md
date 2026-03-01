# NeuroSync System Flowchart — Antigravity Prompt

> **Purpose**: Generate a comprehensive system architecture flowchart for the NeuroSync distributed AI orchestration platform. This prompt contains all parameters, device roles, communication flows, fallback logic, security layers, and storage architecture.

---

## PROMPT FOR ANTIGRAVITY

Create a detailed, multi-layered system architecture flowchart for **NeuroSync** — a distributed, privacy-first AI orchestration system that connects a Xiaomi Android phone, an AMD desktop PC, and a Snapdragon X Elite laptop across an encrypted mesh network. The flowchart must capture every layer described below.

---

### LAYER 1: DEVICES & THEIR ROLES

**DEVICE A — Xiaomi Android Phone (The Exo-Cortex)**
- Runs the NeuroSync React Native/Expo mobile app (the "Servitor")
- Contains **HyperOS AI** — Xiaomi's built-in AI model (on-device)
- HyperOS is NOT autonomous. It requires external input to perform tasks
- The Servitor's job is to **task HyperOS AI** with phone-level operations via structured commands
- If HyperOS does not return a positive result (failure or unavailable), the Servitor **falls back to using app permissions directly** to perform the task itself (e.g., toggle flashlight via expo-camera torch, open browser via Linking.openURL, trigger Gemini Cloud search, open equalizer app, etc.)
- Acts as the **user-facing interface** and **intermediary** between:
  - The local on-device HyperOS AI
  - The PC server (primary compute)
  - The Laptop server (secondary compute, not always available)
  - Cloud LLMs (Gemini, Claude — last resort / complementary only)
- When the phone receives user input, it processes it internally first, then routes to the appropriate node

**DEVICE B — AMD Desktop PC (The Omnissiah — Primary Server)**
- OS: **Pop!_OS (Linux, AMD build)**
- Runs **Ollama** with a **7B parameter LLM** (e.g., llama3.2, mistral) for local task automation and inference
- Runs the **NeuroBeam Host Bridge** (Python/WebSocket server with AES-256-GCM encryption)
- Runs **AnythingLLM** as the routing cogitator (decides target and action from user intent)
- Hosts the **PC Executor** module for local system actions (mute audio, screen capture, launch apps)
- This is the **always-on primary server**
- Has a **dedicated storage partition** granted to the AI — the AI has free roam on this partition to create files, folders, and workspaces with no permission/inheritance issues

**DEVICE C — Snapdragon X Elite Laptop (The Forge — Secondary Server)**
- OS: **Windows 11 ARM**
- Runs a **7B parameter LLM** using the **NPU cores only** — CPU cores remain free for other tasks
- Connected via **Tailscale VPN** (not always available / mobile)
- Uses **Noosphere pairing** for dynamic discovery when the laptop joins or leaves the network
- Has its own **dedicated storage partition** granted to the AI with the same free-roam policy as the PC
- Acts as a secondary compute node — takes overflow or provides redundancy when the PC is busy or offline

---

### LAYER 2: COMMUNICATION FLOW

Show the following communication paths as distinct labeled arrows:

```
USER INPUT → Phone App (Servitor)
                │
                ├──→ [INTERNAL] Process intent locally
                │         │
                │         ├──→ Task HyperOS AI on phone
                │         │         │
                │         │         ├── SUCCESS → Return result to user
                │         │         └── FAIL → Servitor uses app permissions directly
                │         │                      (Flashlight, Equalizer, Browser,
                │         │                       Gemini Cloud for better prompt,
                │         │                       Google Search, App Launch)
                │         │
                │         └──→ Route to external compute:
                │
                ├──→ [PRIMARY] PC Server (AMD/PopOS) via NeuroBeam tunnel
                │         │
                │         ├── AnythingLLM routes intent
                │         ├── Ollama 7B processes query
                │         ├── PC Executor handles local PC actions
                │         └── Returns encrypted result → Phone
                │
                ├──→ [SECONDARY] Laptop Server (Snapdragon/Win11) via Tailscale + Noosphere
                │         │
                │         ├── 7B LLM on NPU cores processes query
                │         └── Returns encrypted result → Phone
                │         (Only when available — Noosphere pairing handles discovery)
                │
                └──→ [LAST RESORT] Cloud LLMs (Gemini / Claude)
                          │
                          ├── Used as little as possible
                          ├── Complementary (multimodal, large context)
                          └── Redundancy if both local servers are down
```

---

### LAYER 3: SERVER VARIANTS (Show as parallel columns)

| Parameter | PC Server (Omnissiah) | Laptop Server (Forge) |
|---|---|---|
| **OS** | Pop!_OS (Linux, AMD) | Windows 11 (ARM, Snapdragon X Elite) |
| **LLM Runtime** | Ollama (CPU/GPU) | Ollama or llama.cpp (NPU-only) |
| **Model** | 7B (llama3.2 / mistral) | 7B (llama3.2 / mistral) |
| **Compute Target** | Full system (CPU + GPU) | NPU only (CPU cores reserved for user) |
| **Availability** | Always-on (primary) | Intermittent (secondary, mobile) |
| **Network** | LAN + Tailscale | Tailscale only |
| **Bridge** | NeuroBeam Host Bridge (WebSocket) | NeuroBeam Host Bridge (WebSocket) |
| **Router** | AnythingLLM | AnythingLLM or direct Ollama |
| **AI Storage Partition** | Dedicated partition, full read/write, no permission inheritance | Dedicated partition, full read/write, no permission inheritance |
| **Discovery** | Static IP / QR handshake | Noosphere dynamic pairing |

---

### LAYER 4: SECURITY & ENCRYPTION

Show these as a security perimeter wrapping all communication:

1. **NeuroBeam Tunnel Encryption**: AES-256-GCM on all WebSocket traffic between Phone ↔ PC and Phone ↔ Laptop
2. **Tailscale VPN**: WireGuard-based mesh VPN connecting all three devices (100.x.x.x address space)
3. **Platform Account Authentication**: Local platform account with password protection on the web interface — prevents exposed tunnel from being accessed by unauthorized users
4. **QR Code Handshake**: Session key (256-bit) + Session ID exchanged via optical air-gap (QR scan) — no keys transmitted over network
5. **SSH/RDP Tunnel Option**: Model-to-model communication can be tunneled over SSH or RDP sessions for additional security
6. **Authorized Nodes Allowlist**: Only pre-sanctified IP addresses can execute SSH/RDP commands
7. **App Permissions Sandbox**: Android device executor operates within a strict allowlist of permitted actions (flashlight, camera, mic, app launch, keep-awake)
8. **PC Executor Allowlist**: Windows/Linux action executor only permits pre-approved applications (notepad, calc, terminal, explorer, edge)

---

### LAYER 5: FALLBACK & REDUNDANCY CHAIN

Show this as a numbered priority cascade:

```
PRIORITY 1: Local Processing (Phone HyperOS AI + Servitor app permissions)
     ↓ (if insufficient or failed)
PRIORITY 2: PC Server — AMD Pop!_OS, Ollama 7B (always-on, primary)
     ↓ (if unavailable or overloaded)
PRIORITY 3: Laptop Server — Snapdragon Win11, 7B on NPU (when available via Tailscale)
     ↓ (if unavailable)
PRIORITY 4: Cloud LLMs — Gemini / Claude (last resort, complementary)
```

Key rules:
- Cloud LLMs are used **as little as possible** — local-first philosophy
- Cloud is **complementary** (multimodal tasks, huge context) or **redundancy** (both servers down)
- If either local server is unavailable, the other compensates
- Phone can always fall back to direct app permission control even if all servers and cloud are offline
- Gemini Cloud can also be invoked from the phone to **improve a prompt** before sending it to a local LLM — making instructions clearer for the 7B model

---

### LAYER 6: AI STORAGE PARTITIONS

Show dedicated storage zones on both PC and Laptop:

```
PC (Pop!_OS):
┌─────────────────────────────┐
│  /dev/sdX — AI Partition    │
│  Owner: neurosync-ai        │
│  Permissions: Full R/W      │
│  No inherited restrictions  │
│  AI can create/delete freely│
│  Isolated from OS partition │
└─────────────────────────────┘

Laptop (Win11):
┌─────────────────────────────┐
│  D:\ or E:\ — AI Partition │
│  Owner: neurosync-ai        │
│  Permissions: Full R/W      │
│  No inherited restrictions  │
│  AI can create/delete freely│
│  Isolated from C:\ system   │
└─────────────────────────────┘
```

Purpose: Avoids permission/rights issues when the AI creates new folders or files. Security is not inherited from parent directories. The AI has a sandboxed workspace to operate autonomously with minimal oversight.

---

### LAYER 7: NOOSPHERE PAIRING (Dynamic Device Discovery)

Show the Noosphere as a conceptual overlay network connecting all devices:

- When the Laptop joins Tailscale, it broadcasts its presence via **Noosphere pairing**
- The Phone and PC detect the new node and add it to the active compute pool
- When the Laptop disconnects, the Noosphere gracefully removes it from the routing table
- The Noosphere context maintains tether state, connection status, active agents, and communication logs
- All Noosphere communication is encrypted (AES-256-GCM inside the NeuroBeam tunnel, over WireGuard/Tailscale)

---

### LAYER 8: SERVITOR → HYPEROS AI TASK DELEGATION

Detail the phone's internal decision tree:

```
User Input Received by Servitor App
         │
         ▼
   Parse Intent Locally
         │
         ├── Is this a phone-local task? (flashlight, EQ, browser, app)
         │         │
         │         ▼
         │    Task HyperOS AI with structured command
         │         │
         │         ├── HyperOS SUCCESS → Return result to UI
         │         │
         │         └── HyperOS FAIL / UNAVAILABLE
         │                   │
         │                   ▼
         │              Servitor uses granted app permissions directly:
         │              • Toggle Flashlight (expo-camera torch)
         │              • Open Equalizer app (Linking.openURL)
         │              • Open Browser (Linking.openURL)
         │              • Google Search via Gemini Cloud (better prompt)
         │              • Launch any permitted app
         │              • Camera, Mic, Keep-Awake controls
         │
         └── Is this a compute/inference task?
                   │
                   ▼
              Route to Priority Cascade (Layer 5)
```

---

### VISUAL STYLE

- Use a **dark industrial / cyberpunk / Warhammer 40K Mechanicus** aesthetic
- Color coding: Red/orange for encryption layers, green for active connections, amber for fallback paths, grey for offline/unavailable nodes
- Label each device with its codename: **Exo-Cortex** (Phone), **Omnissiah** (PC), **Forge** (Laptop)
- Show Tailscale as a translucent VPN overlay mesh connecting all nodes
- Show the Noosphere as a glowing neural overlay above the physical network
- Use cog/gear iconography for the AI processing nodes
- Use skull/servo-skull iconography for the Servitor agent on the phone

---

### SUMMARY OF ALL PARAMETERS

| Parameter | Value |
|---|---|
| Phone | Xiaomi (HyperOS AI + Servitor App) |
| PC OS | Pop!_OS (AMD, Linux) |
| Laptop OS | Windows 11 ARM (Snapdragon X Elite) |
| LLM Size | 7B parameters on both servers |
| PC Compute | CPU + GPU (full system) |
| Laptop Compute | NPU only (CPU free for user) |
| VPN | Tailscale (WireGuard mesh) |
| Tunnel Protocol | NeuroBeam (WebSocket + AES-256-GCM) |
| Discovery | QR Handshake (static) + Noosphere Pairing (dynamic) |
| Router | AnythingLLM (intent → target/action) |
| Cloud Fallback | Gemini, Claude (complementary / last resort) |
| Auth | Local platform account with password |
| AI Storage | Dedicated partitions on PC and Laptop (full R/W, no inherited permissions) |
| Phone Fallback | HyperOS AI → App Permissions → Cloud |
| Servitor Permissions | Flashlight, Equalizer, Browser, Google/Gemini Search, Camera, Mic, App Launch, Keep-Awake |
| Encryption | AES-256-GCM (app layer) + WireGuard (network layer) + SSH/RDP (session layer) |
| PC Executor Allowlist | notepad, calc, terminal, explorer, edge |
| Authorized SSH/RDP Nodes | Pre-sanctified IPs only |
