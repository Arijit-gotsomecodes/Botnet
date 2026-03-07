import { useQuery } from '@tanstack/react-query';
import { Database, GitBranch, ArrowRight, Settings, FileText } from 'lucide-react';
import Plot from 'react-plotly.js';
import { fetchCaptureInfo, fetchStats } from '../api';

export default function DataPipeline() {
    const { data: captureData } = useQuery({
        queryKey: ['capture-info'],
        queryFn: fetchCaptureInfo,
    });

    const { data: statsData } = useQuery({
        queryKey: ['stats'],
        queryFn: fetchStats,
    });

    if (!captureData) {
        return (
            <div className="flex items-center justify-center h-64 text-soc-dim">
                <div className="animate-spin w-8 h-8 border-2 border-soc-primary border-t-transparent rounded-full" />
                <span className="ml-3">Loading pipeline data…</span>
            </div>
        );
    }

    const { captures, reproducibility, summary_stats, pipeline_steps, soft_balancing, source_totals } = captureData;

    // Class distribution from stats
    const detailedDist = statsData?.detailed_label_distribution || {};
    const distLabels = Object.keys(detailedDist);
    const distValues = Object.values(detailedDist) as number[];
    const distColors = distLabels.map(l =>
        l === 'Unknown' || l === '-' ? '#64748b' : '#06b6d4'
    );

    // Dev scale split distribution
    const devStats = summary_stats?.dev_scale?.splits || {};

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-soc-text flex items-center gap-2">
                    <Database className="w-5 h-5 text-soc-success" />
                    Data Pipeline & Sampling Audit
                </h1>
                <p className="text-sm text-soc-dim mt-1">IoT-23 dataset processing pipeline with complete audit trail</p>
            </div>

            {/* Source Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card">
                    <div className="stat-label mb-2">Source Dataset</div>
                    <div className="stat-value text-soc-primary">{source_totals?.total?.toLocaleString()}</div>
                    <div className="stat-label">Total rows across 23 captures</div>
                </div>
                <div className="card">
                    <div className="stat-label mb-2">Dev Scale (Sampled)</div>
                    <div className="stat-value text-soc-accent">{summary_stats?.dev_scale?.total_rows?.toLocaleString()}</div>
                    <div className="stat-label">Used for dashboard</div>
                </div>
                <div className="card">
                    <div className="stat-label mb-2">Compression Ratio</div>
                    <div className="stat-value text-soc-warning">
                        {source_totals?.total && summary_stats?.dev_scale?.total_rows
                            ? `${((summary_stats.dev_scale.total_rows / source_totals.total) * 100).toFixed(2)}%`
                            : '—'}
                    </div>
                    <div className="stat-label">of original data retained</div>
                </div>
            </div>

            {/* ETL Pipeline Flow */}
            <div className="card">
                <div className="card-header">
                    <GitBranch className="w-3.5 h-3.5" />
                    ETL Pipeline Steps
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {(pipeline_steps || []).map((step: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className="bg-soc-surface border border-soc-border rounded-lg px-3 py-2 min-w-0">
                                <div className="text-[0.625rem] text-soc-primary font-bold uppercase">Step {step.step}</div>
                                <div className="text-xs text-soc-text mt-0.5 leading-tight">{step.description.slice(0, 50)}</div>
                                {step.intent && (
                                    <div className="text-[0.625rem] text-soc-dim mt-0.5 italic truncate">{step.intent.slice(0, 60)}</div>
                                )}
                            </div>
                            {i < (pipeline_steps || []).length - 1 && (
                                <ArrowRight className="w-3 h-3 text-soc-dim shrink-0" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Class Distribution */}
                <div className="card">
                    <div className="card-header">
                        <FileText className="w-3.5 h-3.5" />
                        Detailed Label Distribution (Test Set Sample)
                    </div>
                    <Plot
                        data={[{
                            type: 'bar',
                            x: distLabels.map(l => l.length > 20 ? l.slice(0, 18) + '…' : l),
                            y: distValues,
                            marker: {
                                color: distColors,
                                line: { width: 0 },
                            },
                            text: distValues.map(v => v.toLocaleString()),
                            textposition: 'outside' as const,
                            textfont: { size: 9, color: '#94a3b8' },
                        }]}
                        layout={{
                            paper_bgcolor: 'transparent',
                            plot_bgcolor: 'transparent',
                            margin: { t: 10, b: 80, l: 60, r: 10 },
                            height: 300,
                            font: { color: '#94a3b8', size: 10 },
                            xaxis: { gridcolor: '#1e2d3d', tickangle: -35 },
                            yaxis: { gridcolor: '#1e2d3d', title: { text: 'Count', font: { size: 11 } } },
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Train/Val/Test Split */}
                <div className="card">
                    <div className="card-header">
                        <GitBranch className="w-3.5 h-3.5" />
                        Dev Scale Split Composition
                    </div>
                    {Object.keys(devStats).length > 0 ? (
                        <Plot
                            data={[
                                {
                                    type: 'bar',
                                    name: 'Benign',
                                    x: Object.keys(devStats),
                                    y: Object.values(devStats).map((s: any) => s.benign),
                                    marker: { color: '#10b981' },
                                },
                                {
                                    type: 'bar',
                                    name: 'Malicious',
                                    x: Object.keys(devStats),
                                    y: Object.values(devStats).map((s: any) => s.malicious),
                                    marker: { color: '#ef4444' },
                                },
                            ]}
                            layout={{
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                margin: { t: 10, b: 40, l: 70, r: 10 },
                                height: 300,
                                font: { color: '#94a3b8', size: 11 },
                                barmode: 'stack' as const,
                                xaxis: { gridcolor: '#1e2d3d' },
                                yaxis: { gridcolor: '#1e2d3d', title: { text: 'Rows', font: { size: 11 } } },
                                legend: { bgcolor: 'transparent', font: { size: 10 } },
                            }}
                            config={{ displayModeBar: false, responsive: true }}
                            style={{ width: '100%' }}
                        />
                    ) : (
                        <div className="text-soc-dim text-sm">No split data available</div>
                    )}
                </div>
            </div>

            {/* Soft Balancing & Reproducibility */}
            <div className="grid grid-cols-2 gap-6">
                <div className="card">
                    <div className="card-header">
                        <Settings className="w-3.5 h-3.5" />
                        Soft Balancing
                    </div>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-soc-dim">Applied to</span>
                            <span className="text-soc-text font-medium">{soft_balancing?.applied_to}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-soc-dim">Benign target share</span>
                            <span className="text-soc-warning font-bold">{soft_balancing?.train_benign_target}</span>
                        </div>
                        <div className="mt-3 p-3 bg-soc-surface rounded-lg text-xs text-soc-muted leading-relaxed">
                            Soft balancing gently increases the benign share in training data to help models learn the minority class boundary,
                            without destroying majority-class diversity. Val/test remain at natural distribution for realistic evaluation.
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <Settings className="w-3.5 h-3.5" />
                        Reproducibility Settings
                    </div>
                    <div className="space-y-2">
                        {Object.entries(reproducibility || {}).map(([key, val]) => (
                            <div key={key} className="flex justify-between text-sm">
                                <span className="text-soc-dim font-mono text-xs">{key}</span>
                                <span className="text-soc-primary font-mono text-xs">{val as string}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Per-Capture Sampling Table */}
            <div className="card !p-0 overflow-hidden">
                <div className="card-header px-4 py-3 border-b border-soc-border !mb-0">
                    <Database className="w-3.5 h-3.5" />
                    Per-Capture Sampling Results (23 Captures)
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                    <table className="soc-table">
                        <thead>
                            <tr>
                                <th>Capture ID</th>
                                <th className="text-right">Source Total</th>
                                <th className="text-right">Dev Train</th>
                                <th className="text-right">Dev Val</th>
                                <th className="text-right">Dev Test</th>
                                <th className="text-right">Dev Total</th>
                                <th className="text-right">Sample %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(captures || []).map((c: any) => (
                                <tr key={c.capture_id}>
                                    <td className="font-mono text-xs">{c.capture_id}</td>
                                    <td className="text-right font-mono">{c.source_total.toLocaleString()}</td>
                                    <td className="text-right font-mono text-soc-primary">{c.dev_train.toLocaleString()}</td>
                                    <td className="text-right font-mono text-soc-accent">{c.dev_val.toLocaleString()}</td>
                                    <td className="text-right font-mono text-soc-warning">{c.dev_test.toLocaleString()}</td>
                                    <td className="text-right font-mono font-semibold">{c.dev_all.toLocaleString()}</td>
                                    <td className="text-right font-mono text-soc-dim">
                                        {((c.dev_all / c.source_total) * 100).toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
