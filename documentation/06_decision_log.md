# 6. Architectural Decision Log (ADL)

**Date**: 2026-02-12
**Status**: Living Document

This document records the "Why" behind the technical choices in NeuroSync.

---

## 6.1 Backend: FastAPI vs. Flask vs. Django

### Decision
We chose **FastAPI**.

### Rationale
1.  **Asynchronous I/O**: AI orchestration involves waiting for network requests (Ollama/Gemini). FastAPI's native `async/await` support handles high concurrency better than Flask's threaded model.
2.  **Type Safety**: Pydantic integration ensures that data moving between the Mobile App and the Router is strictly validated. This prevents "silent failures" where a malformed JSON crashes the app.
3.  **Documentation**: Automatic Swagger UI (`/docs`) makes it easy to test endpoints during development.

**Trade-off**: Slightly higher complexity than Flask for simple scripts.
**Mitigation**: We kept a small `Flask` bridge (`mobile_bridge.py`) for legacy support if FastAPI fails on old hardware.

---

## 6.2 Mobile: Expo vs. React Native CLI

### Decision
We chose **Expo (Managed Workflow)**.

### Rationale
1.  **Speed of Iteration**: `npx expo start` allows instant testing on physical devices via QR code.
2.  **OTA Updates**: `eas update` allows us to push bug fixes (JavaScript/Assets) without going through the App Store review process.
3.  **Native Modules**: Expo SDK 54 covers 99% of our needs (Camera, Haptics, FileSystem, Crypto).
4.  **Config Plugins**: We can modify native code (AndroidManifest.xml) via `app.json` config plugins without ever ejecting/prebuilding manually.

**Trade-off**: Native Binary size is slightly larger.
**Mitigation**: Accepted. Detailed control over native code is less important than iteration speed for this project.

---

## 6.3 P2P Protocol: Custom WebSocket vs. WebRTC

### Decision
We chose **Custom WebSocket over HTTP (NeuroBeam)**.

### Rationale
1.  **Reliability**: WebRTC is complex and often fails on strict corporate networks (UDP blocking). WebSockets over HTTP/443 (or standard ports) are rarely blocked.
2.  **Statefulness**: We need a persistent, ordered stream for specific AI tokens. WebRTC data channels are great for unordered data, but TCP-based WebSockets guarantee order.
3.  **Simplicity**: Implementing a handshake + AES encryption on WebSocket is ~300 lines of code. WebRTC setup is massive.

**Trade-off**: Higher latency than UDP.
**Mitigation**: For text streaming, 50ms vs 200ms does not significantly impact user experience.

---

## 6.4 Encryption: AES-256-GCM vs. TLS

### Decision
We use **Application-Layer Encryption (AES)** inside the WebSocket.

### Rationale
1.  **End-to-End Control**: We cannot always guarantee valid TLS certificates on local IPs (e.g., `192.168.1.5`). Browsers/Apps block self-signed certs.
2.  **"Trust No Relay"**: Even if we use a public relay server later, the relay sees only encrypted bytes. TLS terminates at the relay; our AES encryption terminates at the destination.

**Trade-off**: Key management complexity (QR code exchange).
**Mitigation**: The QR code handshake is a one-time setup that is user-friendly.
