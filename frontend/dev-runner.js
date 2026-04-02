import { spawn } from 'child_process';
import http from 'http';
import process from 'process';

const EC2_IP = '98.93.62.92';
const EC2_PORT = 8000;
const TIMEOUT_MS = 2000;

console.log(`\n🔍 Checking if EC2 backend is up at http://${EC2_IP}:${EC2_PORT}/health ...`);

const req = http.get(`http://${EC2_IP}:${EC2_PORT}/health`, (res) => {
    // Read response completely so it doesn't hang
    res.on('data', () => {});
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log(`✅ EC2 backend is LIVE! Starting Vite pointing to EC2...\n`);
            spawn('npx', ['vite'], {
                stdio: 'inherit',
                env: { ...process.env, VITE_API_URL: `http://${EC2_IP}:${EC2_PORT}` },
                shell: true
            });
        } else {
            startLocalFallback();
        }
    });
});

req.on('error', () => {
    startLocalFallback();
});

req.setTimeout(TIMEOUT_MS, () => {
    req.destroy();
    // destruction triggers error event, which will call startLocalFallback
});

let childProcesses = [];

function startLocalFallback() {
    console.log(`❌ EC2 backend is NOT reachable. Falling back to local backend...\n`);
    
    console.log(`🚀 Starting local Python Uvicorn backend...`);
    const backend = spawn('python3', ['-m', 'uvicorn', 'main:app', '--reload', '--port', '8000'], {
        cwd: '../backend',
        stdio: 'inherit',
        shell: true
    });
    childProcesses.push(backend);

    // Wait a brief moment to let uvicorn initialize port binding, then start vite
    setTimeout(() => {
        console.log(`🚀 Starting Vite (proxied to localhost:8000)...\n`);
        const vite = spawn('npx', ['vite'], {
            stdio: 'inherit',
            env: { ...process.env }, // no VITE_API_URL, relies on vite proxy config
            shell: true
        });
        childProcesses.push(vite);
    }, 1500);
}

// Cleanup gracefully on exit
const cleanup = () => {
    childProcesses.forEach(cp => cp.kill('SIGINT'));
    process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
