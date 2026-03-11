const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function fetchHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
}

export async function fetchStats() {
    const res = await fetch(`${API_BASE}/stats`);
    return res.json();
}

export async function fetchLearningCurves() {
    const res = await fetch(`${API_BASE}/learning-curves`);
    return res.json();
}

export async function fetchCaptureInfo() {
    const res = await fetch(`${API_BASE}/capture-info`);
    return res.json();
}

export async function fetchCloudMetrics() {
    const res = await fetch(`${API_BASE}/cloud-metrics`);
    return res.json();
}

export async function fetchBalancingInfo() {
    const res = await fetch(`${API_BASE}/balancing-info`);
    return res.json();
}

export async function postPredict(features: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(features),
    });
    return res.json();
}

export function createSSEStream(rate: number = 20): EventSource {
    return new EventSource(`${API_BASE}/stream?rate=${rate}`);
}

export function createSimulationStream(attack: string, rate: number = 30, count: number = 200): EventSource {
    return new EventSource(`${API_BASE}/stream/simulate?attack=${attack}&rate=${rate}&count=${count}`);
}
