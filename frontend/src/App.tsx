import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import LiveThreatMonitor from './pages/LiveThreatMonitor';
import ModelPerformance from './pages/ModelPerformance';
import CloudInfrastructure from './pages/CloudInfrastructure';
import ExplainableAI from './pages/ExplainableAI';
import DataPipeline from './pages/DataPipeline';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/live" replace />} />
            <Route path="/live" element={<LiveThreatMonitor />} />
            <Route path="/models" element={<ModelPerformance />} />
            <Route path="/cloud" element={<CloudInfrastructure />} />
            <Route path="/explain" element={<ExplainableAI />} />
            <Route path="/pipeline" element={<DataPipeline />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
