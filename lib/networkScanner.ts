/**
 * NeuroSync Network Scanner
 * Scans the local subnet for devices running the NeuroSync bridge (port 8082)
 * or Ollama (port 11434/11435).
 */

const BRIDGE_PORT = 8082;
const OLLAMA_PORTS = [11434, 11435];
const SCAN_TIMEOUT = 1500; // ms per probe

export interface DiscoveredDevice {
    ip: string;
    bridgeAvailable: boolean;
    ollamaAvailable: boolean;
    ollamaPort?: number;
    hostname?: string;
    responseTime: number; // ms
}

/**
 * Probe a single IP:port to check if it responds.
 * Returns true if the endpoint responds within the timeout.
 */
async function probe(ip: string, port: number, timeout: number = SCAN_TIMEOUT): Promise<{ ok: boolean; ms: number }> {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const resp = await fetch(`http://${ip}:${port}/health`, {
            method: 'GET',
            signal: controller.signal,
        });
        clearTimeout(timer);
        return { ok: resp.ok || resp.status < 500, ms: Date.now() - start };
    } catch {
        clearTimeout(timer);

        // For Ollama, try /api/tags instead of /health
        if (port !== BRIDGE_PORT) {
            try {
                const controller2 = new AbortController();
                const timer2 = setTimeout(() => controller2.abort(), timeout);
                const resp = await fetch(`http://${ip}:${port}/api/tags`, {
                    method: 'GET',
                    signal: controller2.signal,
                });
                clearTimeout(timer2);
                return { ok: resp.ok, ms: Date.now() - start };
            } catch {
                return { ok: false, ms: Date.now() - start };
            }
        }

        return { ok: false, ms: Date.now() - start };
    }
}

/**
 * Attempt to determine the local subnet from common private ranges.
 * Returns an array of base IPs to scan (e.g. "192.168.1").
 */
function getCommonSubnets(): string[] {
    return [
        '192.168.1',
        '192.168.0',
        '10.0.0',
        '100.64.0', // Tailscale CGNAT range
    ];
}

/**
 * Scan a specific subnet for NeuroSync-compatible devices.
 * Probes IPs 1-254 in batches of 20 for performance.
 */
export async function scanSubnet(
    subnet: string,
    onProgress?: (scanned: number, total: number) => void,
    onDeviceFound?: (device: DiscoveredDevice) => void,
): Promise<DiscoveredDevice[]> {
    const devices: DiscoveredDevice[] = [];
    const total = 254;
    let scanned = 0;

    // Scan in batches of 25 for balanced speed/load
    const batchSize = 25;

    for (let start = 1; start <= 254; start += batchSize) {
        const batch: Promise<void>[] = [];

        for (let i = start; i < Math.min(start + batchSize, 255); i++) {
            const ip = `${subnet}.${i}`;

            batch.push(
                (async () => {
                    const bridgeResult = await probe(ip, BRIDGE_PORT);
                    let ollamaResult = { ok: false, ms: 0 };
                    let ollamaPort: number | undefined;

                    // Check Ollama ports
                    for (const port of OLLAMA_PORTS) {
                        const result = await probe(ip, port);
                        if (result.ok) {
                            ollamaResult = result;
                            ollamaPort = port;
                            break;
                        }
                    }

                    if (bridgeResult.ok || ollamaResult.ok) {
                        const device: DiscoveredDevice = {
                            ip,
                            bridgeAvailable: bridgeResult.ok,
                            ollamaAvailable: ollamaResult.ok,
                            ollamaPort,
                            responseTime: Math.min(
                                bridgeResult.ok ? bridgeResult.ms : 9999,
                                ollamaResult.ok ? ollamaResult.ms : 9999
                            ),
                        };
                        devices.push(device);
                        onDeviceFound?.(device);
                    }

                    scanned++;
                    onProgress?.(scanned, total);
                })()
            );
        }

        await Promise.all(batch);
    }

    // Sort by response time (fastest first)
    return devices.sort((a, b) => a.responseTime - b.responseTime);
}

/**
 * Quick scan: Only probe common gateway IPs and the first 20 addresses.
 * Much faster than a full subnet scan.
 */
export async function quickScan(
    onDeviceFound?: (device: DiscoveredDevice) => void,
): Promise<DiscoveredDevice[]> {
    const devices: DiscoveredDevice[] = [];
    const subnets = getCommonSubnets();

    // Probe common IPs: .1 (gateway), .2-.20, .50, .100, .200, .254
    const commonSuffixes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 50, 100, 150, 200, 254];

    const allProbes: Promise<void>[] = [];

    for (const subnet of subnets) {
        for (const suffix of commonSuffixes) {
            const ip = `${subnet}.${suffix}`;
            allProbes.push(
                (async () => {
                    const bridgeResult = await probe(ip, BRIDGE_PORT, 1000);
                    let ollamaResult = { ok: false, ms: 0 };
                    let ollamaPort: number | undefined;

                    for (const port of OLLAMA_PORTS) {
                        const result = await probe(ip, port, 1000);
                        if (result.ok) {
                            ollamaResult = result;
                            ollamaPort = port;
                            break;
                        }
                    }

                    if (bridgeResult.ok || ollamaResult.ok) {
                        const device: DiscoveredDevice = {
                            ip,
                            bridgeAvailable: bridgeResult.ok,
                            ollamaAvailable: ollamaResult.ok,
                            ollamaPort,
                            responseTime: Math.min(
                                bridgeResult.ok ? bridgeResult.ms : 9999,
                                ollamaResult.ok ? ollamaResult.ms : 9999
                            ),
                        };
                        devices.push(device);
                        onDeviceFound?.(device);
                    }
                })()
            );
        }
    }

    await Promise.all(allProbes);
    return devices.sort((a, b) => a.responseTime - b.responseTime);
}
