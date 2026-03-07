import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../api';
import {
    Shield, Activity, BarChart3, Cloud, Brain, Database,
} from 'lucide-react';
import { useEffect, useState } from 'react';

const links = [
    { to: '/live', label: 'Live Threats', icon: Activity },
    { to: '/models', label: 'Model Performance', icon: BarChart3 },
    { to: '/cloud', label: 'Cloud Infra', icon: Cloud },
    { to: '/explain', label: 'Explainable AI', icon: Brain },
    { to: '/pipeline', label: 'Data Pipeline', icon: Database },
];

export default function Layout() {
    const { data: health } = useQuery({
        queryKey: ['health'],
        queryFn: fetchHealth,
        refetchInterval: 10_000,
    });
    const [clock, setClock] = useState(new Date());

    useEffect(() => {
        const t = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    const connected = !!health?.status;

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 bg-soc-surface border-r border-soc-border flex flex-col">
                {/* Logo */}
                <div className="p-5 border-b border-soc-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-soc-primary to-soc-accent flex items-center justify-center shadow-lg">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-soc-text tracking-wide">Cloud-SOC</h1>
                            <p className="text-[0.625rem] text-soc-dim uppercase tracking-widest">IoT Security</p>
                        </div>
                    </div>
                </div>

                {/* Nav links */}
                <nav className="flex-1 p-3 space-y-1">
                    {links.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                                    ? 'bg-soc-primary/15 text-soc-primary-light border border-soc-primary/30 shadow-sm'
                                    : 'text-soc-muted hover:bg-soc-hover hover:text-soc-text border border-transparent'
                                }`
                            }
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* Status */}
                <div className="p-4 border-t border-soc-border">
                    <div className="flex items-center gap-2 text-xs">
                        <div className={`pulse-dot ${connected ? 'bg-soc-success' : 'bg-soc-danger'}`} />
                        <span className={connected ? 'text-soc-success' : 'text-soc-danger'}>
                            {connected ? 'API Connected' : 'Disconnected'}
                        </span>
                    </div>
                    {health?.models_ready && (
                        <div className="flex items-center gap-2 text-xs mt-2">
                            <div className="pulse-dot bg-soc-primary" />
                            <span className="text-soc-primary">Models Loaded</span>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-14 flex-shrink-0 border-b border-soc-border bg-soc-surface/80 backdrop-blur-sm flex items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                        <h2 className="text-sm font-semibold text-soc-text">
                            IoT Security Operations Center
                        </h2>
                        <span className="badge badge-info">NCI Cloud ML</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-soc-dim">
                        <span>IoT-23 Dataset • dev_scale</span>
                        <span className="font-mono text-soc-muted">
                            {clock.toLocaleTimeString()}
                        </span>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-6 bg-soc-bg">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
