import { useQuery } from '@tanstack/react-query';
import { Cloud, Gauge, Server, DollarSign, Cpu, Zap } from 'lucide-react';
import { fetchCloudMetrics } from '../api';
import Plot from 'react-plotly.js';

function GaugeSVG({ value, max, label, unit, color }: { value: number; max: number; label: string; unit: string; color: string }) {
    const pct = Math.min(value / max, 1);
    const circumference = 2 * Math.PI * 54;
    const strokeDasharray = `${pct * circumference * 0.75} ${circumference}`;
    const rotation = 135;

    return (
        <div className="flex flex-col items-center">
            <svg width="140" height="110" viewBox="0 0 140 110">
                <circle
                    cx="70" cy="70" r="54"
                    fill="none"
                    stroke="#1e2d3d"
                    strokeWidth="10"
                    strokeDasharray={`${0.75 * circumference} ${circumference}`}
                    transform={`rotate(${rotation} 70 70)`}
                    strokeLinecap="round"
                />
                <circle
                    cx="70" cy="70" r="54"
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeDasharray={strokeDasharray}
                    transform={`rotate(${rotation} 70 70)`}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                    style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
                />
                <text x="70" y="65" textAnchor="middle" fill="#e2e8f0" className="text-xl font-bold" fontSize="22" fontWeight="700">
                    {typeof value === 'number' ? value.toFixed(value < 10 ? 1 : 0) : value}
                </text>
                <text x="70" y="85" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="500">
                    {unit}
                </text>
            </svg>
            <span className="text-xs text-soc-dim mt-1 uppercase tracking-wide">{label}</span>
        </div>
    );
}

function ServiceBadge({ name, status, detail }: { name: string; status: string; detail: string }) {
    const ok = status === 'healthy';
    return (
        <div className={`flex items-center justify-between px-4 py-3 rounded-lg border ${ok ? 'border-soc-success/20 bg-soc-success/5' : 'border-soc-danger/20 bg-soc-danger/5'
            }`}>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${ok ? 'bg-soc-success' : 'bg-soc-danger'}`} />
                <span className="text-sm font-medium text-soc-text">{name}</span>
            </div>
            <span className="text-xs text-soc-muted">{detail}</span>
        </div>
    );
}

export default function CloudInfrastructure() {
    const { data } = useQuery({
        queryKey: ['cloud-metrics'],
        queryFn: fetchCloudMetrics,
        refetchInterval: 5_000,
    });

    if (!data) {
        return (
            <div className="flex items-center justify-center h-64 text-soc-dim">
                <div className="animate-spin w-8 h-8 border-2 border-soc-primary border-t-transparent rounded-full" />
                <span className="ml-3">Loading cloud metrics…</span>
            </div>
        );
    }

    const { latency, throughput, auto_scaling: as_, cost_estimate, services } = data;

    // Auto-scaling bar chart
    const instanceCount = as_.current_instances;
    const instanceBars = Array.from({ length: as_.max_instances }, (_, i) => ({
        active: i < instanceCount,
        index: i + 1,
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-xl font-bold text-soc-text flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-soc-accent" />
                    Cloud Infrastructure Monitor
                </h1>
                <p className="text-sm text-soc-dim mt-1">Simulated AWS CloudWatch metrics for IoT-SOC deployment</p>
            </div>

            {/* Latency Gauges */}
            <div className="card">
                <div className="card-header">
                    <Gauge className="w-3.5 h-3.5" />
                    Inference Latency
                </div>
                <div className="flex justify-around">
                    <GaugeSVG value={latency.p50_ms} max={150} label="P50" unit="ms" color="#10b981" />
                    <GaugeSVG value={latency.p95_ms} max={150} label="P95" unit="ms" color="#f59e0b" />
                    <GaugeSVG value={latency.p99_ms} max={300} label="P99" unit="ms" color="#ef4444" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
                {/* Throughput + Scaling */}
                <div className="space-y-4">
                    <div className="card">
                        <div className="card-header">
                            <Zap className="w-3.5 h-3.5" />
                            Throughput
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="stat-value text-soc-primary">{throughput.requests_per_second.toLocaleString()}</div>
                                <div className="stat-label">Requests / second</div>
                            </div>
                            <div>
                                <div className="stat-value text-soc-accent">{throughput.events_processed_per_minute.toLocaleString()}</div>
                                <div className="stat-label">Events / minute</div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <Server className="w-3.5 h-3.5" />
                            Auto-Scaling ({instanceCount}/{as_.max_instances} instances)
                        </div>
                        <div className="flex items-end gap-2 h-24 mb-3">
                            {instanceBars.map((b) => (
                                <div
                                    key={b.index}
                                    className={`flex-1 rounded-t transition-all duration-500 ${b.active
                                        ? 'bg-gradient-to-t from-soc-primary to-soc-primary-light'
                                        : 'bg-soc-border/30'
                                        }`}
                                    style={{ height: b.active ? `${60 + Math.random() * 40}%` : '20%' }}
                                />
                            ))}
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-soc-dim">CPU: <span className="text-soc-warning font-semibold">{as_.cpu_utilization_pct}%</span></span>
                            <span className="text-soc-dim">Memory: <span className="text-soc-info font-semibold">{as_.memory_utilization_pct}%</span></span>
                        </div>
                    </div>
                </div>

                {/* Cost Estimator */}
                <div className="space-y-4">
                    <div className="card">
                        <div className="card-header">
                            <DollarSign className="w-3.5 h-3.5" />
                            Daily Cost Breakdown (USD)
                        </div>
                        <Plot
                            data={[{
                                type: 'bar',
                                x: Object.keys(cost_estimate.daily).map(k => k.replace(/_/g, ' ')),
                                y: Object.values(cost_estimate.daily) as number[],
                                marker: {
                                    color: ['#06b6d4', '#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444'],
                                    line: { width: 0 },
                                },
                                text: (Object.values(cost_estimate.daily) as number[]).map(v => `$${v}`),
                                textposition: 'outside' as const,
                                textfont: { color: '#94a3b8', size: 10 },
                                hoverinfo: 'x+y' as const,
                            }]}
                            layout={{
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                margin: { t: 10, b: 80, l: 40, r: 10 },
                                height: 250,
                                font: { color: '#94a3b8', size: 10 },
                                xaxis: { gridcolor: '#1e2d3d', tickangle: -30 },
                                yaxis: { gridcolor: '#1e2d3d', title: { text: 'USD', font: { size: 11 } } },
                            }}
                            config={{ displayModeBar: false, responsive: true }}
                            style={{ width: '100%' }}
                        />
                        <div className="flex justify-between items-center mt-2 pt-3 border-t border-soc-border">
                            <span className="text-sm text-soc-dim">Monthly Projected</span>
                            <span className="text-xl font-bold text-soc-warning">${cost_estimate.monthly_projected}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* AWS Services Status */}
            <div className="card">
                <div className="card-header">
                    <Cpu className="w-3.5 h-3.5" />
                    AWS Service Health
                </div>
                <div className="grid grid-cols-3 gap-3">
                    <ServiceBadge name="API Gateway" status={services.api_gateway.status} detail={`${services.api_gateway.latency_ms}ms`} />
                    <ServiceBadge name="Lambda" status={services.lambda.status} detail={`Cold: ${services.lambda.cold_start_ms}ms`} />
                    <ServiceBadge name="SageMaker" status={services.sagemaker.status} detail={`${services.sagemaker.endpoint_latency_ms}ms`} />
                    <ServiceBadge name="S3" status={services.s3.status} detail={`${services.s3.objects_count} objects`} />
                    <ServiceBadge name="CloudWatch" status={services.cloudwatch.status} detail={`${services.cloudwatch.alarms_active} alarms`} />
                    <ServiceBadge name="Auto Scaling" status="healthy" detail={`${instanceCount} instances`} />
                </div>
            </div>
        </div>
    );
}
