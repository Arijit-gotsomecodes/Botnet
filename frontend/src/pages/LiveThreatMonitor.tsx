import { useEffect, useRef, useState, useCallback } from 'react';
import { Activity, AlertTriangle, ShieldCheck, Zap, Crosshair, Waves, Radio } from 'lucide-react';
import Plot from 'react-plotly.js';
import { createSSEStream, createSimulationStream } from '../api';

interface FlowEvent {
    flow_id: number;
    ts: string;
    src_ip: string;
    src_port: string;
    dst_ip: string;
    dst_port: string;
    proto: string;
    service: string;
    duration: string;
    label: string;
    detailed_label: string;
    confidence: number;
    conn_state: string;
}

type SimulationType = 'portscan' | 'ddos' | 'c2' | null;

export default function LiveThreatMonitor() {
    const [flows, setFlows] = useState<FlowEvent[]>([]);
    const [stats, setStats] = useState({
        total: 0, malicious: 0, benign: 0,
    });
    const [attackDist, setAttackDist] = useState<Record<string, number>>({});
    const [streaming, setStreaming] = useState(false);
    const [activeSimulation, setActiveSimulation] = useState<SimulationType>(null);
    const [rate, setRate] = useState(20);
    const esRef = useRef<EventSource | null>(null);
    const logRef = useRef<HTMLDivElement>(null);

    const handleEvent = useCallback((data: FlowEvent) => {
        setFlows((prev) => [data, ...prev].slice(0, 200));
        setStats((prev) => ({
            total: prev.total + 1,
            malicious: prev.malicious + (data.label === 'Malicious' ? 1 : 0),
            benign: prev.benign + (data.label === 'Benign' ? 1 : 0),
        }));
        setAttackDist((prev) => {
            const key = data.detailed_label || 'Unknown';
            return { ...prev, [key]: (prev[key] || 0) + 1 };
        });
    }, []);

    const stopStream = useCallback(() => {
        esRef.current?.close();
        setStreaming(false);
        setActiveSimulation(null);
    }, []);

    const startStream = useCallback(() => {
        if (esRef.current) esRef.current.close();
        const es = createSSEStream(rate);
        esRef.current = es;
        setStreaming(true);
        setActiveSimulation(null);

        es.onmessage = (e) => {
            try {
                const data: FlowEvent = JSON.parse(e.data);
                if ('event' in data) {
                    es.close();
                    setStreaming(false);
                    return;
                }
                handleEvent(data);
            } catch { }
        };

        es.onerror = () => {
            setStreaming(false);
        };
    }, [rate, handleEvent]);

    const startSimulation = useCallback((attack: SimulationType) => {
        if (!attack) return;
        if (esRef.current) esRef.current.close();

        // Reset stats for the simulation
        setFlows([]);
        setStats({ total: 0, malicious: 0, benign: 0 });
        setAttackDist({});

        const es = createSimulationStream(attack, rate, 300);
        esRef.current = es;
        setStreaming(true);
        setActiveSimulation(attack);

        es.onmessage = (e) => {
            try {
                const data: FlowEvent = JSON.parse(e.data);
                if ('event' in data) {
                    es.close();
                    setStreaming(false);
                    setActiveSimulation(null);
                    return;
                }
                handleEvent(data);
            } catch { }
        };

        es.onerror = () => {
            setStreaming(false);
            setActiveSimulation(null);
        };
    }, [rate, handleEvent]);

    useEffect(() => {
        return () => esRef.current?.close();
    }, []);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = 0;
        }
    }, [flows]);

    // Pie chart data
    const pieLabels = Object.keys(attackDist).filter(k => k !== 'Unknown').slice(0, 8);
    const pieValues = pieLabels.map(k => attackDist[k]);
    const pieColors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

    const simButtons: { key: SimulationType; label: string; icon: typeof Crosshair; desc: string }[] = [
        { key: 'portscan', label: 'Port Scan', icon: Crosshair, desc: 'Horizontal scan across ports' },
        { key: 'ddos', label: 'DDoS', icon: Waves, desc: 'Distributed denial of service' },
        { key: 'c2', label: 'C&C', icon: Radio, desc: 'Command & Control beacons' },
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-soc-text tracking-tight flex items-center gap-3">
                        <Activity className="w-6 h-6 text-soc-primary" />
                        Live Threat Monitor
                        <span className="badge badge-success animate-pulse-slow">LIVE</span>
                    </h1>
                    <p className="text-sm text-soc-dim mt-1">Cloud Machine Learning Project • IoT-23 Network Traffic Stream</p>
                </div>
                <div className="flex items-center gap-3">
                    <label className="text-xs text-soc-dim">
                        Rate:
                        <select
                            value={rate}
                            onChange={(e) => setRate(Number(e.target.value))}
                            className="ml-2 bg-soc-card border border-soc-border rounded px-2 py-1 text-soc-text text-xs"
                            disabled={streaming}
                        >
                            {[10, 20, 30, 50].map(r => (
                                <option key={r} value={r}>{r} flows/sec</option>
                            ))}
                        </select>
                    </label>
                    <button
                        onClick={streaming ? stopStream : startStream}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${streaming
                            ? 'bg-soc-danger/20 text-soc-danger border border-soc-danger/30 hover:bg-soc-danger/30'
                            : 'bg-soc-primary/20 text-soc-primary border border-soc-primary/30 hover:bg-soc-primary/30'
                            }`}
                    >
                        {streaming ? '⏹ Stop' : '▶ Start Streaming'}
                    </button>
                </div>
            </div>

            {/* Attack Simulation Buttons */}
            <div className="card">
                <div className="card-header">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Simulate Attack Scenario
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                    {simButtons.map(({ key, label, icon: Icon, desc }) => (
                        <button
                            key={key}
                            onClick={() => startSimulation(key)}
                            disabled={streaming && activeSimulation !== key}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-all duration-200 ${activeSimulation === key
                                    ? 'bg-soc-danger/20 border-soc-danger/50 text-soc-danger'
                                    : 'bg-soc-surface border-soc-border text-soc-text hover:bg-soc-hover hover:border-soc-primary/40'
                                } ${streaming && activeSimulation !== key ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${activeSimulation === key ? 'bg-soc-danger/30' : 'bg-soc-card'
                                }`}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div>
                                <div className="text-sm font-semibold">{label}</div>
                                <div className="text-[0.65rem] text-soc-dim">{desc}</div>
                            </div>
                            {activeSimulation === key && (
                                <span className="ml-auto badge badge-danger animate-pulse-slow text-[0.6rem]">ACTIVE</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-soc-primary" />
                        <span className="text-xs text-soc-dim uppercase tracking-wide">Total Flows</span>
                    </div>
                    <div className="stat-value text-soc-primary">{stats.total.toLocaleString()}</div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-soc-danger" />
                        <span className="text-xs text-soc-dim uppercase tracking-wide">Malicious</span>
                    </div>
                    <div className="stat-value text-soc-danger">{stats.malicious.toLocaleString()}</div>
                    <div className="stat-label">{stats.total > 0 ? ((stats.malicious / stats.total) * 100).toFixed(1) : 0}% of total</div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="w-4 h-4 text-soc-success" />
                        <span className="text-xs text-soc-dim uppercase tracking-wide">Benign</span>
                    </div>
                    <div className="stat-value text-soc-success">{stats.benign.toLocaleString()}</div>
                    <div className="stat-label">{stats.total > 0 ? ((stats.benign / stats.total) * 100).toFixed(1) : 0}% of total</div>
                </div>
                <div className="card">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-soc-warning" />
                        <span className="text-xs text-soc-dim uppercase tracking-wide">Stream Status</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <div className={`pulse-dot ${streaming ? 'bg-soc-success' : 'bg-soc-dim'}`} />
                        <span className={`text-sm font-semibold ${streaming ? 'text-soc-success' : 'text-soc-dim'}`}>
                            {streaming
                                ? activeSimulation
                                    ? `SIM: ${activeSimulation.toUpperCase()}`
                                    : 'LIVE'
                                : 'STOPPED'}
                        </span>
                    </div>
                    <div className="stat-label">{rate} flows/sec</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Live Log */}
                <div className="col-span-2 card !p-0 overflow-hidden">
                    <div className="card-header !mb-0 px-4 py-3 border-b border-soc-border">
                        <Activity className="w-3.5 h-3.5" />
                        Live Flow Log
                        <span className="ml-auto text-[0.625rem] text-soc-dim">{flows.length} events buffered</span>
                    </div>
                    <div ref={logRef} className="h-[400px] overflow-y-auto font-mono text-xs">
                        {flows.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-soc-dim">
                                Click "Start Streaming" or simulate an attack to begin monitoring
                            </div>
                        ) : (
                            flows.map((f, i) => (
                                <div
                                    key={`${f.flow_id}-${i}`}
                                    className={`px-4 py-1.5 border-b border-soc-border/30 animate-slide-in flex items-center gap-3 ${f.label === 'Malicious' ? 'bg-soc-glow-red' : ''
                                        }`}
                                >
                                    <span className="text-soc-dim w-12 text-right shrink-0">#{f.flow_id}</span>
                                    <span className={`badge shrink-0 ${f.label === 'Malicious' ? 'badge-danger' : 'badge-success'}`}>
                                        {f.label}
                                    </span>
                                    <span className="text-soc-muted shrink-0 w-28">{f.src_ip}</span>
                                    <span className="text-soc-dim">→</span>
                                    <span className="text-soc-muted shrink-0 w-28">{f.dst_ip}</span>
                                    <span className="badge badge-info shrink-0">{f.proto}</span>
                                    <span className="text-soc-dim truncate">{f.detailed_label}</span>
                                    <span className="ml-auto text-soc-primary shrink-0">
                                        {(f.confidence * 100).toFixed(0)}%
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Attack Distribution Pie */}
                <div className="card">
                    <div className="card-header">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Attack Distribution
                    </div>
                    {pieLabels.length > 0 ? (
                        <Plot
                            data={[{
                                type: 'pie',
                                labels: pieLabels,
                                values: pieValues,
                                hole: 0.5,
                                marker: { colors: pieColors },
                                textinfo: 'label+percent',
                                textposition: 'outside',
                                textfont: { size: 10, color: '#a1a1aa', family: 'Inter, sans-serif' },
                                hoverinfo: 'label+value+percent',
                            }]}
                            layout={{
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                margin: { t: 10, b: 10, l: 10, r: 10 },
                                showlegend: false,
                                height: 320,
                                font: { color: '#a1a1aa' },
                            }}
                            config={{ displayModeBar: false, responsive: true }}
                            style={{ width: '100%' }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-64 text-soc-dim text-sm">
                            Start streaming to see distribution
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
