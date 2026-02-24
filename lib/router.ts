/**
 * Von Agent Smart Router
 * Routes queries based on battery, complexity, and mode
 */
import { AppSettings } from './storage';

export type RouteTarget = 'LOCAL' | 'PC' | 'CLOUD';

export interface RouteDecision {
    target: RouteTarget;
    reason: string;
}

export interface SystemStatus {
    battery: number;
    localOnline: boolean;
    pcOnline: boolean;
    pcCpuLoad?: number;
}

/**
 * Determine route for a query
 */
export function routeQuery(
    prompt: string,
    settings: AppSettings,
    status: SystemStatus
): RouteDecision {
    const { routeMode, batteryThreshold, charThreshold } = settings;
    const promptLength = prompt.length;

    // Manual mode overrides
    if (routeMode === 'local') {
        if (!status.localOnline) {
            return { target: 'PC', reason: 'Local offline, fallback to PC' };
        }
        return { target: 'LOCAL', reason: 'Manual: Local mode' };
    }

    if (routeMode === 'pc') {
        if (!status.pcOnline) {
            return { target: 'LOCAL', reason: 'PC offline, fallback to Local' };
        }
        return { target: 'PC', reason: 'Manual: PC mode' };
    }

    if (routeMode === 'cloud') {
        return { target: 'CLOUD', reason: 'Manual: Cloud mode' };
    }

    // Auto mode
    const batteryOk = status.battery > batteryThreshold;
    const promptSimple = promptLength < charThreshold;

    // Try local first if conditions are good
    if (batteryOk && promptSimple && status.localOnline) {
        return { target: 'LOCAL', reason: `Battery ${status.battery}% > ${batteryThreshold}%, prompt simple` };
    }

    // Route to PC
    if (status.pcOnline) {
        // Check PC load - fallback to cloud if overloaded
        if (status.pcCpuLoad && status.pcCpuLoad > 80) {
            return { target: 'CLOUD', reason: 'PC CPU > 80%, routing to cloud' };
        }
        return { target: 'PC', reason: 'Complex query, routing to PC' };
    }

    // Fallback chain
    if (status.localOnline) {
        return { target: 'LOCAL', reason: 'PC offline, using local' };
    }

    return { target: 'CLOUD', reason: 'No local services, using cloud' };
}

/**
 * Get route badge color
 */
export function getRouteColor(target: RouteTarget): string {
    switch (target) {
        case 'LOCAL': return '#39ff14';
        case 'PC': return '#00f0ff';
        case 'CLOUD': return '#ff00aa';
    }
}
