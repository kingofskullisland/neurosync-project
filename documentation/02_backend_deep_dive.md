# 2. Backend Architecture Deep Dive

## 2.1 Overview
The backend is a **FastAPI** application designed for stateless, high-concurrency request orchestration. It is strictly typed using Pydantic models and enforces asynchronous I/O for all external calls (Ollama, Gemini, Claude) to prevent blocking the event loop.

**Location**: `backend/app`
**Entry Point**: `main.py`
**Core Logic**: `core/router.py`

---

## 2.2 The Router Engine (`core/router.py`)

The `Router` class is the central nervous system. It does not contain AI logic itself; it contains *business logic for AI selection*.

### 2.2.1 Routing Algorithm
The `route()` method accepts a query and context, then follows this decision tree:

1.  **Complexity Analysis**: Call `scorer.score(query)`.
2.  **Resource Check**: Verify which backends are online (`check_backends()`).
3.  **Resolution**:
    *   If `recommendation == 'local'` → Route to **Ollama**.
    *   If `recommendation == 'gemini'` AND Gemini is available → Route to **Gemini**.
    *   If `recommendation == 'claude'` AND Claude is available → Route to **Claude**.
    *   *Fallback*: If a cloud provider is down, fallback to the next best cloud provider, then finally to **Local**.

### 2.2.2 The "Hadron" Override
**Current Implementation Note**:
In `core/prompts.py`, the function `get_prompt_for_route` currently enforces the **HADRON** persona for *all* routes.

```python
def get_prompt_for_route(route, enable_cot=True):
    # Grimdark Overhaul: Prefer Hadron for everything
    if route == "LOCAL": return HADRON_CONFIG
    if route in ("GEMINI", "CLAUDE", "OLLAMA"): return HADRON_CONFIG
    return HADRON_CONFIG
```

*   **Implication**: Every AI response, regardless of the underlying model, will adopt the persona of a Tech-Priest of the Adeptus Mechanicus.
*   **Reasoning**: Consistency of user experience. The "Machine Spirit" theme is destroyed if the AI suddenly switches to a helpful assistant tone.

---

## 2.3 The Complexity Scorer (`core/scorer.py`)

The system determines "Complexity" not by semantic understanding, but by heuristic signal detection. This is faster and cheaper than running a "Router LLM".

### 2.3.1 Scoring Weights
The final score (0.0 - 1.0) is a weighted sum of normalized factors:

| Factor | Weight | Description |
|--------|--------|-------------|
| **Token Count** | 0.30 | Longer queries usually require more compute. |
| **Code Keywords** | 0.25 | Presence of `def`, `class`, `import`, `function` implies coding. |
| **Research Markers** | 0.20 | Words like `analyze`, `compare`, `history of`. |
| **Multimodal** | 0.15 | Presence of an image force-weights towards Cloud (Gemini). |
| **Context Length** | 0.10 | Size of RAG context attached. |

### 2.3.2 Thresholds
*   **< 0.4**: **Local/Simple**. Handled by On-Device or Local Server model.
*   **> 0.4**: **Cloud/Complex**. Handled by Gemini/Claude.
*   **Code Intensity > 0.6**: **Claude Preference**. Explicitly routes to Claude 3.5 Sonnet for its superior coding capabilities.

---

## 2.4 API Endpoints (`main.py`)

### 2.4.1 `GET /health`
Returns the status of the Router and its connection to the Local Ollama instance.
*   Response: `{"status": "online", "ollama": "connected", "bridge": "online"}`

### 2.4.2 `POST /chat`
REST endpoint for non-streaming responses.
*   **Input**: `ChatRequest` (prompt, image, model_preference).
*   **Output**: `ChatResponse` (full text, route used, complexity score, reasoning).
*   **Use Case**: Debugging or simple single-turn queries.

### 2.4.3 `WS /ws` (WebSocket)
Primary transport for the mobile app.
*   **Protocol**:
    1.  Client connects.
    2.  Client sends JSON: `{"type": "text", "payload": "Hello", "streamId": "123"}`.
    3.  Server streams chunks: `{"type": "token", "content": "Hi", "streamId": "123"}`.
    4.  Server sends completion: `{"type": "complete", "content": "", "streamId": "123"}`.
*   **Error Handling**: If the WebSocket disconnects, the router logs the error but does not crash.

---

## 2.5 Mobile Bridge (`mobile_bridge.py`)

This is a legacy/auxiliary Flask service running on port **8082**.
*   **Purpose**: It specifically proxies traffic to a custom `Alpaca` or `Ollama` instance running on port **11435** ( distinct from the standard 11434).
*   **Context**: Use this when the main FastAPI router is overkill, or for specific local-only deployments where Python 3.11+ (FastAPI) isn't available but Python 3.9 (common on older Linux distros) is.
