# NeuroSync "Adeptus Mechanicus" Update — Code Review

## File Name Discrepancies

Several files referenced in the review request don't exist under those names:

| Referenced | Actual File |
|---|---|
| `components/BeamScanner.tsx` | `components/QRScanner.tsx` |
| `components/TetherStatus.tsx` | `components/StatusPill.tsx` + `components/BeamMonitor.tsx` |
| `components/PuritySeal.tsx` | **Does not exist** |
| `hooks/useWorkloadRouter.ts` | `lib/router.ts` (plain function, not a hook) |
| `context/NoosphereContext.tsx` | **Does not exist** (no React Context in the project) |

---

## 1. SECURITY

### CRITICAL: Broken Encryption in Mobile Client

`lib/neurobeam.ts:59-91` — The comments say "AES-256-CTR" but the implementation is a simple XOR cipher:

```typescript
ciphertext[i] = data[i] ^ this.key[i % this.key.length] ^ nonce[i % nonce.length];
```

This is **not real encryption**. XOR with a repeating key is trivially breakable. Worse, the backend `host-bridge.py` uses proper AES-256-GCM via Python's `cryptography` library (`AESGCM`). **The mobile client and backend are using incompatible encryption** — they cannot actually exchange encrypted messages. The handshake will fail when the mobile client tries to XOR-"decrypt" an AES-GCM ciphertext.

**Fix:** Use a proper AES implementation for React Native:
- `react-native-quick-crypto` (native module, best performance)
- `@noble/ciphers` (pure JS, no native deps, works with Expo)
- `crypto-js` (widely used, but slower)

### CORS: Wide Open with Credentials

`backend/app/main.py:41-47`:
```python
allow_origins=["*"],
allow_credentials=True,
```

This violates the CORS specification — browsers refuse to send credentials with wildcard origin. Restrict `allow_origins` to known client origins or remove `allow_credentials=True`.

### QR Payload: No Host Validation

`components/QRScanner.tsx:31-48` — The `host` field from scanned QR data is used directly to construct WebSocket URLs. A malicious QR code could point to an attacker's server. Add private IP validation:

```typescript
function isPrivateIP(host: string): boolean {
    return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)
        || host === 'localhost' || host === '127.0.0.1';
}
```

### Plaintext WebSocket Transport

`lib/neurobeam.ts:126` — Uses `ws://` not `wss://`. The handshake (containing the session ID in plaintext) is interceptable on untrusted networks.

### Error Message Leakage

`backend/app/main.py:107,179` — `str(e)` in response bodies can leak internal details. Return generic messages to clients; log details server-side only.

### Gemini API Key in URL Parameters

`backend/app/core/router.py:245` — API key in query string gets logged in access/proxy logs. Use `x-goog-api-key` header instead.

### No Rate Limiting

No backend endpoints have rate limiting. A single client could exhaust Ollama resources or Gemini API budget.

### Bare `except:` Clauses

`backend/app/main.py:75`, `backend/app/core/router.py:168,214` — Swallows all exceptions including `SystemExit`. Use `except Exception:` at minimum.

---

## 2. PERFORMANCE

### QRScanner Modal — Good

Modal approach is the correct fix for the Android `IllegalViewOperationException`. The `scanned` debounce pattern is standard Expo. Consider unmounting `CameraView` after a successful scan.

### ScrollView vs FlatList for Chat

`app/index.tsx:347-427` — `ScrollView` renders all children at once. For 50+ messages, switch to `FlatList` with `inverted` prop.

### httpx Client Recreation

A new `httpx.AsyncClient()` is created per request — no connection pooling. Create a shared client in the lifespan context.

### BeamMonitor INTERRUPTED Flicker

`components/BeamMonitor.tsx:42` — Random bar state only fires once on state change. Add an interval for visible flickering.

### Animated API Usage — Fine

`useNativeDriver: true` throughout is correct. Animations run on the native thread.

---

## 3. CODE QUALITY

### Missing React Context

No global state management. State is scattered across screens with the `neurobeam` singleton imported directly. A `NoosphereContext` wrapping beam state, settings, and connection status would improve architecture.

### Redundant Client-Side Routing

`lib/router.ts` `routeQuery` is called in `app/index.tsx:171-176` but the result only tags the message bubble — the backend makes its own routing decision. Either remove client-side routing or use it to select endpoints.

### Duplicate `.json()` Call

`backend/app/main.py:97-98`:
```python
data = response.json()
data = response.json()  # duplicate — remove
```

### Message ID Collisions

`app/index.tsx:133,153` — `Date.now().toString()` IDs can collide. Use `crypto.randomUUID()`.

### Stale Closure in `checkStatus`

`app/index.tsx:81-84` — `setInterval` captures `checkStatus` which closes over initial `settings` (null). Wrap in `useCallback` with proper deps or use a ref.

### Dead Code

- `app/index.tsx:271-272` — Commented-out haptics
- `backend/app/core/router.py:259-261` — Empty legacy stubs
- `backend/app/core/prompts.py:148-168` — Commented-out config block
- `components/GlitchText.tsx:54` — Backward-compat alias

### Inline Imports

`backend/app/core/router.py:138,161,208,249` — `import httpx` and `import json` inside method bodies. Move to top of file.

---

## 4. SPECIFIC QUESTIONS ANSWERED

### Q1: Is the atob/btoa handling robust for React Native?

The codebase does **not use `atob`/`btoa`**. `QRScanner.tsx` uses `JSON.parse(data)` directly. `lib/neurobeam.ts` uses the `buffer` polyfill (`Buffer.from(x, 'base64')`) which is the correct approach for React Native.

### Q2: Can the PuritySeal animation be made more performant?

`PuritySeal.tsx` doesn't exist yet. Recommendations for building it:
- Use `react-native-reanimated` (already in dependencies) instead of core `Animated`
- Consider `lottie-react-native` for complex seal animations
- Always use `useNativeDriver: true` or Reanimated's shared values

### Q3: Memory leaks in useWorkloadRouter?

`useWorkloadRouter` doesn't exist. Leak surface is in `lib/neurobeam.ts`:

1. **`pendingRequests` Map** (line 113): `disconnect()` doesn't reject pending promises or clear timeout timers
2. **WebSocket on unmount**: If the calling component unmounts without `disconnect()`, the socket and ping interval persist
3. **Listeners**: Correctly cleaned up in `app/settings.tsx:82`

---

## 5. AESTHETICS — Grimdark Enhancements

1. **CRT Scan Lines**: Semi-transparent horizontal line overlay across the screen
2. **Custom Font**: Replace system monospace with `Share Tech Mono` or `Fira Code` via `expo-font`
3. **State Transition Flicker**: Flash opacity to 0.85 for 80ms on beam state changes
4. **Replace ActivityIndicator**: Custom cog rotation or binary cascade animation
5. **Imperial Timestamps**: Format as `0.23.41.M3` instead of standard time
6. **Aquila Watermark**: Low-opacity (0.03) Mechanicus cog behind chat messages
7. **Sound Design**: Mechanical servo clicks on haptic events via `expo-av`
8. **Phosphor Text**: Give AI responses a green-on-dark tint for terminal authenticity

---

## Priority Summary

| Priority | Issue | File |
|---|---|---|
| **P0** | XOR "encryption" incompatible with backend AES-GCM | `lib/neurobeam.ts:59-91` |
| **P0** | CORS wildcard with credentials | `backend/app/main.py:41-47` |
| **P1** | QR host validation (SSRF via malicious QR) | `components/QRScanner.tsx:31-48` |
| **P1** | Pending requests not cleaned on disconnect | `lib/neurobeam.ts:181-193` |
| **P1** | Plaintext WebSocket transport | `lib/neurobeam.ts:126` |
| **P2** | Duplicate `.json()` call | `backend/app/main.py:97-98` |
| **P2** | Error message leakage | `backend/app/main.py:107,179` |
| **P2** | No rate limiting | `backend/app/main.py` |
| **P2** | httpx client recreation (no pool) | `backend/app/main.py`, `router.py` |
| **P3** | ScrollView → FlatList for chat | `app/index.tsx:347` |
| **P3** | Missing React Context for global state | project-wide |
| **P3** | Dead code / commented-out blocks | multiple files |
