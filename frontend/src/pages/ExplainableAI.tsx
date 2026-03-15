import { useState } from 'react';
import { Brain, Send, ArrowRight } from 'lucide-react';
import Plot from 'react-plotly.js';
import { postPredict } from '../api';

const DEFAULT_FEATURES = {
    duration: 0.5,
    orig_bytes: 200,
    resp_bytes: 1500,
    orig_pkts: 5,
    resp_pkts: 4,
    orig_ip_bytes: 340,
    resp_ip_bytes: 1660,
    missed_bytes: 0,
    proto: 'tcp',
    conn_state: 'SF',
    service: 'http',
};

const PRESET_FLOWS = [
    { name: '🟢 Benign HTTP', features: { duration: 1.2, orig_bytes: 350, resp_bytes: 5200, orig_pkts: 8, resp_pkts: 12, orig_ip_bytes: 670, resp_ip_bytes: 5680, missed_bytes: 0, proto: 'tcp', conn_state: 'SF', service: 'http' } },
    { name: '🔴 Port Scan', features: { duration: 0.000005, orig_bytes: 0, resp_bytes: 0, orig_pkts: 1, resp_pkts: 0, orig_ip_bytes: 60, resp_ip_bytes: 0, missed_bytes: 0, proto: 'tcp', conn_state: 'S0', service: '-' } },
    { name: '🔴 DDoS Attack', features: { duration: 0.000002, orig_bytes: 0, resp_bytes: 0, orig_pkts: 2, resp_pkts: 0, orig_ip_bytes: 80, resp_ip_bytes: 0, missed_bytes: 0, proto: 'tcp', conn_state: 'S0', service: '-' } },
    { name: '🟢 DNS Query', features: { duration: 0.05, orig_bytes: 37, resp_bytes: 179, orig_pkts: 1, resp_pkts: 1, orig_ip_bytes: 65, resp_ip_bytes: 207, missed_bytes: 0, proto: 'udp', conn_state: 'SF', service: 'dns' } },
];

export default function ExplainableAI() {
    const [features, setFeatures] = useState(DEFAULT_FEATURES);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handlePredict = async () => {
        setLoading(true);
        try {
            const res = await postPredict(features);
            setResult(res);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const loadPreset = (preset: typeof PRESET_FLOWS[0]) => {
        setFeatures(preset.features);
        setResult(null);
    };

    const updateFeature = (key: string, value: string) => {
        const numKeys = ['duration', 'orig_bytes', 'resp_bytes', 'orig_pkts', 'resp_pkts', 'orig_ip_bytes', 'resp_ip_bytes', 'missed_bytes'];
        setFeatures(prev => ({
            ...prev,
            [key]: numKeys.includes(key) ? parseFloat(value) || 0 : value,
        }));
    };

    // SHAP waterfall data
    const shapData = result?.shap_explanation || [];
    const sortedShap = [...shapData].sort((a: any, b: any) => Math.abs(b.contribution) - Math.abs(a.contribution));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-soc-text flex items-center gap-2">
                    <Brain className="w-5 h-5 text-soc-info" />
                    Explainable AI (XAI) Panel
                </h1>
                <p className="text-sm text-soc-dim mt-1 max-w-3xl">
                    Machine Learning models are usually "Black Boxes" — they give an answer, but don't tell you <em>why</em>.
                    This panel uses <strong>SHAP (SHapley Additive exPlanations)</strong> to open the box. By submitting a network flow below,
                    you can see exactly which features (like packet size or duration) caused the AI to decide if the traffic was Malicious or Benign.
                </p>
            </div>

            {/* Presets */}
            <div className="flex gap-2 flex-wrap">
                {PRESET_FLOWS.map((preset) => (
                    <button
                        key={preset.name}
                        onClick={() => loadPreset(preset)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-soc-card border border-soc-border hover:border-soc-primary/40 hover:bg-soc-hover transition-colors"
                    >
                        {preset.name}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Input Form */}
                <div className="card">
                    <div className="card-header">
                        <Send className="w-3.5 h-3.5" />
                        Flow Features
                    </div>
                    <div className="space-y-3">
                        {Object.entries(features).map(([key, value]) => (
                            <div key={key}>
                                <label className="text-[0.6875rem] text-soc-dim uppercase tracking-wide">{key}</label>
                                <input
                                    type={typeof value === 'number' ? 'number' : 'text'}
                                    value={value}
                                    onChange={(e) => updateFeature(key, e.target.value)}
                                    className="w-full mt-1 px-3 py-2 bg-soc-surface border border-soc-border rounded-lg text-sm text-soc-text focus:outline-none focus:border-soc-primary/50 transition-colors"
                                    step={typeof value === 'number' ? 'any' : undefined}
                                />
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={handlePredict}
                        disabled={loading}
                        className="w-full mt-4 px-4 py-2.5 rounded-lg bg-soc-primary text-white font-semibold text-sm hover:bg-soc-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                        ) : (
                            <>
                                <Brain className="w-4 h-4" />
                                Analyze Flow
                            </>
                        )}
                    </button>
                </div>

                {/* Results */}
                <div className="col-span-2 space-y-4">
                    {result?.error ? (
                        <div className="card border-soc-danger/30 bg-soc-danger/5">
                            <p className="text-soc-danger">{result.error}</p>
                        </div>
                    ) : result ? (
                        <>
                            {/* Model Predictions */}
                            <div className="grid grid-cols-3 gap-4">
                                {Object.entries(result.predictions || {}).map(([name, pred]: [string, any]) => (
                                    <div key={name} className={`card !border-t-2 ${pred.prediction === 'Malicious' ? '!border-t-soc-danger' : '!border-t-soc-success'
                                        }`}>
                                        <p className="text-xs text-soc-dim uppercase tracking-wide mb-2">{name}</p>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`badge ${pred.prediction === 'Malicious' ? 'badge-danger' : 'badge-success'}`}>
                                                {pred.prediction}
                                            </span>
                                            <span className="text-lg font-bold text-soc-text">{(pred.confidence * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="w-full bg-soc-border/30 rounded-full h-2 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${pred.prediction === 'Malicious' ? 'bg-soc-danger' : 'bg-soc-success'
                                                    }`}
                                                style={{ width: `${pred.confidence * 100}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between mt-2 text-[0.625rem] text-soc-dim">
                                            <span>Benign: {(pred.probability_benign * 100).toFixed(1)}%</span>
                                            <span>Malicious: {(pred.probability_malicious * 100).toFixed(1)}%</span>
                                        </div>
                                        <p className="text-[0.625rem] text-soc-dim mt-1">Latency: {pred.latency_ms}ms</p>
                                    </div>
                                ))}
                            </div>

                            {/* Feature Importance Waterfall */}
                            {sortedShap.length > 0 && (
                                <div className="card">
                                    <div className="card-header border-b border-soc-border/50 pb-2 mb-3">
                                        <div>
                                            <h3 className="text-soc-text font-semibold">How did the AI reach this decision?</h3>
                                            <p className="text-xs text-soc-dim mt-1 font-normal leading-relaxed">
                                                This chart shows the absolute "pull" of each feature on the final score.
                                                <span className="text-soc-danger ml-1 font-medium">Red bars</span> mean that specific feature looked suspicious and pushed the AI to vote "Malicious".
                                                <span className="text-soc-success ml-1 font-medium">Green bars</span> mean the feature looked normal and pushed the AI to vote "Benign".
                                                The larger the bar, the more important it was!
                                            </p>
                                        </div>
                                    </div>
                                    <Plot
                                        data={[{
                                            type: 'bar',
                                            y: sortedShap.map((s: any) => `${s.feature} = ${s.value}`),
                                            x: sortedShap.map((s: any) => s.contribution),
                                            orientation: 'h' as const,
                                            marker: {
                                                color: sortedShap.map((s: any) =>
                                                    s.contribution > 0 ? '#ef4444' : '#10b981'
                                                ),
                                            },
                                            text: sortedShap.map((s: any) => s.contribution > 0 ? '→ Malicious' : '→ Benign'),
                                            textposition: 'outside' as const,
                                            textfont: { size: 9, color: '#94a3b8' },
                                            hoverinfo: 'x+y' as const,
                                        }]}
                                        layout={{
                                            paper_bgcolor: 'transparent',
                                            plot_bgcolor: 'transparent',
                                            margin: { t: 10, b: 30, l: 170, r: 80 },
                                            height: 350,
                                            font: { color: '#94a3b8', size: 11 },
                                            xaxis: {
                                                title: { text: 'Contribution', font: { size: 11 } },
                                                gridcolor: '#1e2d3d',
                                                zeroline: true,
                                                zerolinecolor: '#64748b',
                                            },
                                            yaxis: { gridcolor: '#1e2d3d', autorange: 'reversed' as const },
                                        }}
                                        config={{ displayModeBar: false, responsive: true }}
                                        style={{ width: '100%' }}
                                    />
                                </div>
                            )}

                            {/* Decision Explanation */}
                            <div className="card">
                                <div className="card-header">Decision Path</div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    {sortedShap.slice(0, 5).map((s: any, i: number) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className={`px-2 py-1 rounded text-xs font-mono ${s.contribution > 0 ? 'bg-soc-danger/10 text-soc-danger' : 'bg-soc-success/10 text-soc-success'
                                                }`}>
                                                {s.feature}={s.value}
                                            </div>
                                            {i < 4 && <ArrowRight className="w-3 h-3 text-soc-dim" />}
                                        </div>
                                    ))}
                                    <ArrowRight className="w-4 h-4 text-soc-primary" />
                                    <span className={`badge text-sm ${Object.values(result.predictions || {})[0] &&
                                        (Object.values(result.predictions)[0] as any).prediction === 'Malicious'
                                        ? 'badge-danger' : 'badge-success'
                                        }`}>
                                        {Object.values(result.predictions || {})[0] &&
                                            (Object.values(result.predictions)[0] as any).prediction}
                                    </span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="card flex items-center justify-center h-64 text-soc-dim">
                            <div className="text-center">
                                <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>Select a preset or configure features, then click "Analyze Flow"</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
