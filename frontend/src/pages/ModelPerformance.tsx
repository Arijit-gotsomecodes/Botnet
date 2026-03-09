import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, Award } from 'lucide-react';
import Plot from 'react-plotly.js';
import { fetchLearningCurves } from '../api';

const MODEL_COLORS: Record<string, string> = {
    'Random Forest': '#06b6d4',
    'XGBoost': '#3b82f6',
    'Neural Network': '#8b5cf6',
};

export default function ModelPerformance() {
    const { data, isLoading } = useQuery({
        queryKey: ['learning-curves'],
        queryFn: fetchLearningCurves,
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-soc-dim">
                <div className="animate-spin w-8 h-8 border-2 border-soc-primary border-t-transparent rounded-full" />
                <span className="ml-3">Loading model data…</span>
            </div>
        );
    }

    const lc = data?.learning_curves || {};
    const fm = data?.final_metrics || {};
    const cm = data?.confusion_matrices || {};
    const roc = data?.roc_data || {};

    // Learning curve traces
    const lcTraces = Object.entries(lc).flatMap(([name, curves]: [string, any]) => [
        {
            x: curves.fractions.map((f: number) => `${(f * 100).toFixed(0)}%`),
            y: curves.val_f1,
            name: `${name} (Val)`,
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            line: { color: MODEL_COLORS[name], width: 2.5 },
            marker: { size: 7 },
        },
        {
            x: curves.fractions.map((f: number) => `${(f * 100).toFixed(0)}%`),
            y: curves.train_f1,
            name: `${name} (Train)`,
            type: 'scatter' as const,
            mode: 'lines' as const,
            line: { color: MODEL_COLORS[name], width: 1.5, dash: 'dash' as const },
        },
    ]);

    // ROC traces
    const rocTraces = Object.entries(roc).map(([name, d]: [string, any]) => ({
        x: d.fpr,
        y: d.tpr,
        name: `${name} (AUC=${d.auc})`,
        type: 'scatter' as const,
        mode: 'lines' as const,
        line: { color: MODEL_COLORS[name], width: 2 },
        fill: 'tozeroy' as const,
        fillcolor: `${MODEL_COLORS[name]}10`,
    }));

    // Best model
    const bestModel = Object.entries(fm).reduce((best, [name, m]: [string, any]) =>
        !best || m.f1 > best[1].f1 ? [name, m] : best, null as any);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-soc-text flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-soc-accent" />
                    Model Performance Evaluation
                </h1>
                <p className="text-sm text-soc-dim mt-1">
                    Comparing Random Forest, XGBoost, and Neural Network on IoT-23 dataset (50K training samples)
                </p>
            </div>

            {/* Best Model Card */}
            {bestModel && (
                <div className="card !border-soc-primary/30 bg-soc-card">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-soc-primary/20 flex items-center justify-center">
                            <Award className="w-6 h-6 text-soc-primary" />
                        </div>
                        <div>
                            <p className="text-xs text-soc-dim uppercase tracking-wide">Best Performing Model</p>
                            <p className="text-lg font-bold text-soc-primary">{bestModel[0]}</p>
                        </div>
                        <div className="ml-auto grid grid-cols-4 gap-6">
                            {['f1', 'precision', 'recall', 'accuracy'].map(key => (
                                <div key={key} className="text-center">
                                    <div className="text-lg font-bold text-soc-text">
                                        {(bestModel[1][key] * 100).toFixed(1)}%
                                    </div>
                                    <div className="text-[0.625rem] text-soc-dim uppercase">{key}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-6">
                {/* Learning Curves */}
                <div className="card">
                    <div className="card-header">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Learning Curves (F1-Score vs Training Size)
                    </div>
                    <Plot
                        data={lcTraces}
                        layout={{
                            paper_bgcolor: 'transparent',
                            plot_bgcolor: 'transparent',
                            margin: { t: 20, b: 50, l: 60, r: 20 },
                            height: 350,
                            font: { color: '#94a3b8', size: 11 },
                            xaxis: {
                                title: { text: 'Training Data', font: { size: 12 } },
                                gridcolor: '#1e2d3d',
                                tickfont: { size: 10 },
                            },
                            yaxis: {
                                title: { text: 'F1-Score', font: { size: 12 } },
                                gridcolor: '#1e2d3d',
                                range: [0.85, 1.0],
                                tickfont: { size: 10 },
                            },
                            legend: {
                                bgcolor: 'transparent',
                                font: { size: 10 },
                                x: 0.01, y: 0.01,
                                xanchor: 'left',
                                yanchor: 'bottom',
                            },
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>

                {/* ROC Curves */}
                <div className="card">
                    <div className="card-header">
                        <BarChart3 className="w-3.5 h-3.5" />
                        ROC Curves
                    </div>
                    <Plot
                        data={[
                            ...rocTraces,
                            {
                                x: [0, 1],
                                y: [0, 1],
                                name: 'Random (AUC=0.50)',
                                type: 'scatter' as const,
                                mode: 'lines' as const,
                                line: { color: '#64748b', width: 1, dash: 'dash' as const },
                            },
                        ]}
                        layout={{
                            paper_bgcolor: 'transparent',
                            plot_bgcolor: 'transparent',
                            margin: { t: 20, b: 50, l: 60, r: 20 },
                            height: 350,
                            font: { color: '#94a3b8', size: 11 },
                            xaxis: {
                                title: { text: 'False Positive Rate', font: { size: 12 } },
                                gridcolor: '#1e2d3d',
                                range: [0, 1],
                            },
                            yaxis: {
                                title: { text: 'True Positive Rate', font: { size: 12 } },
                                gridcolor: '#1e2d3d',
                                range: [0, 1],
                            },
                            legend: {
                                bgcolor: 'transparent',
                                font: { size: 10 },
                            },
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {/* Confusion Matrices */}
            <div className="grid grid-cols-3 gap-4">
                {Object.entries(cm).map(([name, matrix]: [string, any]) => (
                    <div key={name} className="card">
                        <div className="card-header justify-center">Confusion Matrix — {name}</div>
                        <Plot
                            data={[{
                                z: matrix,
                                x: ['Benign', 'Malicious'],
                                y: ['Benign', 'Malicious'],
                                type: 'heatmap',
                                colorscale: [
                                    [0, '#111827'],
                                    [0.5, '#1e3a5f'],
                                    [1, MODEL_COLORS[name] || '#06b6d4'],
                                ] as any,
                                showscale: false,
                                text: matrix.map((row: number[]) => row.map((v: number) => v.toLocaleString())),
                                texttemplate: '%{text}',
                                textfont: { color: '#e2e8f0', size: 14 },
                                hoverinfo: 'z' as const,
                            }]}
                            layout={{
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                margin: { t: 10, b: 40, l: 60, r: 10 },
                                height: 250,
                                font: { color: '#94a3b8', size: 11 },
                                xaxis: { title: { text: 'Predicted', font: { size: 11 } } },
                                yaxis: { title: { text: 'Actual', font: { size: 11 } }, autorange: 'reversed' as const },
                            }}
                            config={{ displayModeBar: false, responsive: true }}
                            style={{ width: '100%' }}
                        />
                    </div>
                ))}
            </div>

            {/* Metrics Table */}
            <div className="card !p-0 overflow-hidden">
                <div className="card-header px-4 py-3 border-b border-soc-border !mb-0">
                    Final Model Comparison
                </div>
                <div className="overflow-x-auto">
                    <table className="soc-table">
                        <thead>
                            <tr>
                                <th>Model</th>
                                <th>F1-Score</th>
                                <th>Precision</th>
                                <th>Recall</th>
                                <th>Accuracy</th>
                                <th>Train Time</th>
                                <th>Inference Time</th>
                                <th>Test Samples</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(fm).map(([name, m]: [string, any]) => (
                                <tr key={name}>
                                    <td className="font-semibold">
                                        <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: MODEL_COLORS[name] }} />
                                        {name}
                                    </td>
                                    <td className="font-mono text-soc-primary">{(m.f1 * 100).toFixed(2)}%</td>
                                    <td className="font-mono">{(m.precision * 100).toFixed(2)}%</td>
                                    <td className="font-mono">{(m.recall * 100).toFixed(2)}%</td>
                                    <td className="font-mono">{(m.accuracy * 100).toFixed(2)}%</td>
                                    <td className="font-mono text-soc-muted">{m.train_time_sec}s</td>
                                    <td className="font-mono text-soc-muted">{m.inference_time_sec}s</td>
                                    <td className="font-mono text-soc-dim">{m.test_samples?.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
