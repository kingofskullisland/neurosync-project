# 3. NeuroBeam Protocol Specification

## 3.1 Overview
NeuroBeam is a proprietary peer-to-peer (P2P) tunneling protocol developed for NeuroSync. It enables a secure, encrypted, and persistent connection between a mobile client (Tier 1) and a local compute node (Tier 2/3) without requiring complex firewall configuration or third-party relay servers (like ngrok or Cloudflare Tunnels).

**Core Philosophy**: "Trust No Relay." The path between client and server is assumed to be hostile.

## 3.2 Protocol Stack
*   **Transport**: WebSockets (WS) over HTTP/1.1 or HTTP/2.
*   **Encryption**: AES-256-GCM (Galois/Counter Mode).
    *   *Note*: The React Native client currently uses a simplified AES implementation due to `react-native-crypto` limitations, with plans to upgrade to full GCM.
*   **Discovery**: QR Code (Optical Air-Gap).
*   **Keep-Alive**: Heartbeat ping every 10 seconds.

---

## 3.3 Connection Flow

### Phase 1: The Handshake (Identity Proof)
1.  **Host (Server)** starts `host-bridge.py`.
    *   Generates a 256-bit Session Key (`K`).
    *   Generates a 128-bit Session ID (`SID`).
    *   Displays `K`, `SID`, `IP`, and `PORT` as a QR code.

2.  **Client (Mobile)** scans the QR code.
    *   Parses the connection config.
    *   Initiates WebSocket connection to `ws://<IP>:<PORT>`.

3.  **Authentication**:
    *   Client sends: `{"type": "handshake", "sid": "SID"}` (Plaintext).
    *   Server verifies `SID`.
    *   If valid, Server enacts encryption.
    *   Server sends: `Encrypt({"type": "handshake_ok", "timestamp": "..."})`.

4.  **Lock-In**:
    *   Client attempts to decrypt the response using `K`.
    *   If successful, connection enters **LOCKED** state.
    *   If decryption fails, connection is **TERMINATED**.

### Phase 2: The Tunnel (Transport)
All messages are now encrypted JSON envelopes.

**Envelope Structure**:
```json
{
  "c": "BASE64_CIPHERTEXT",
  "n": "BASE64_NONCE"
}
```

**Payload Structure (Decrypted)**:
```json
{
  "type": "request",
  "id": "req_12345",
  "path": "/api/generate",
  "method": "POST",
  "body": {
    "model": "llama3",
    "prompt": "Why is the sky blue?"
  }
}
```

### Phase 3: The Response
1.  Host bridge receives decrypted request.
2.  Host proxies the request to `http://localhost:11434` (Ollama).
3.  Host receives Ollama response.
4.  Host encrypts response and sends back to Client.

---

## 3.4 Future Improvements
*   **UDP Hole Punching**: Currently relies on direct IP visibility (LAN or VPN like Tailscale). Future version will implement STUN/TURN for true WAN traversal.
*   **Key Rotation**: Session keys currently persist for the duration of the WebSocket connection. Ideally, they should rotate every hour.
