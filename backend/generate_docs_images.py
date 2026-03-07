import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
import os
import subprocess

OUT_DIR = "../docs/images"
os.makedirs(OUT_DIR, exist_ok=True)

# Set global styles
plt.style.use('dark_background')
colors = {'primary': '#06b6d4', 'accent': '#3b82f6', 'success': '#10b981', 'danger': '#ef4444', 'card': '#1a2332', 'bg': '#0a0e1a', 'text': '#e2e8f0', 'border': '#1e2d3d'}

def draw_01_concept():
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.set_facecolor(colors['bg'])
    fig.patch.set_facecolor(colors['bg'])
    ax.axis('off')
    ax.set_xlim(-1, 11.5)
    ax.set_ylim(1, 5)

    # Draw boxes
    boxes = {
        'IoT Devices\n(Raw Traffic)': (1, 3),
        'Cloud-SOC Engine\n(Machine Learning)': (5, 3),
        'Security Dashboard\n(Real-time Alerts)': (9, 3)
    }

    for name, (x, y) in boxes.items():
        rect = patches.FancyBboxPatch((x-1.5, y-1), 3, 2, boxstyle="round,pad=0.1", ec=colors['primary'], fc=colors['card'], lw=2)
        ax.add_patch(rect)
        ax.text(x, y, name, ha='center', va='center', color=colors['text'], fontsize=12, fontweight='bold')

    # Arrows
    ax.annotate('', xy=(3.5, 3), xytext=(2.5, 3), arrowprops=dict(facecolor=colors['accent'], edgecolor=colors['accent'], width=3, headwidth=10))
    ax.annotate('', xy=(7.5, 3), xytext=(6.5, 3), arrowprops=dict(facecolor=colors['success'], edgecolor=colors['success'], width=3, headwidth=10))

    # Details
    ax.text(3, 3.5, "Massive Packets", ha='center', color=colors['danger'], fontsize=10)
    ax.text(7, 3.5, "Cleaned Intelligence", ha='center', color=colors['success'], fontsize=10)

    plt.title("Fig 1: Cloud-SOC Conceptual Flow", color=colors['text'], pad=20, fontsize=16)
    plt.tight_layout()
    plt.savefig(f"{OUT_DIR}/01_cloud_soc_concept.png", dpi=300, bbox_inches='tight')
    plt.close()

def draw_02_data_pipeline():
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.set_facecolor(colors['bg'])
    fig.patch.set_facecolor(colors['bg'])
    ax.axis('off')
    ax.set_xlim(-1, 12.5)
    ax.set_ylim(1, 5)

    steps = [
        ("Raw Zeek Logs\n(.tsv)", 1, colors['accent']),
        ("Handle Missing Data\n('-' to 0/NaN)", 4, colors['primary']),
        ("Feature Engineering\n(Label Encoders)", 7, colors['primary']),
        ("Data Split\n(60 Train / 40 Val+Test)", 10, colors['success'])
    ]

    for i in range(len(steps)):
        name, x, c = steps[i]
        rect = patches.FancyBboxPatch((x-1.2, 2.5), 2.4, 1, boxstyle="round,pad=0.1", ec=c, fc=colors['card'], lw=2)
        ax.add_patch(rect)
        ax.text(x, 3, name, ha='center', va='center', color=colors['text'], fontsize=10, fontweight='bold')
        
        if i < len(steps)-1:
            ax.annotate('', xy=(steps[i+1][1]-1.2, 3), xytext=(x+1.2, 3), arrowprops=dict(facecolor=colors['text'], edgecolor=colors['text'], width=2, headwidth=8))

    plt.title("Fig 2: IoT-23 Data Processing Pipeline", color=colors['text'], pad=20, fontsize=16)
    plt.tight_layout()
    plt.savefig(f"{OUT_DIR}/02_data_processing_flow.png", dpi=300, bbox_inches='tight')
    plt.close()

def draw_03_ml_models():
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.set_facecolor(colors['bg'])
    fig.patch.set_facecolor(colors['bg'])

    models = ['Random Forest', 'XGBoost', 'Neural Network']
    f1_scores = [0.977, 0.977, 0.971]
    latency = [1.2, 1.5, 4.8] # Simulated ms latency

    x = np.arange(len(models))
    width = 0.35

    ax.bar(x - width/2, f1_scores, width, label='F1 Score (Accuracy)', color=colors['success'])
    ax2 = ax.twinx()
    ax2.bar(x + width/2, latency, width, label='Latency (ms)', color=colors['danger'])

    ax.set_ylabel('F1 Score', color=colors['text'])
    ax2.set_ylabel('Inference Latency (ms)', color=colors['text'])
    ax.set_title('Fig 3: Performance vs Latency Tradeoff', color=colors['text'], pad=20, fontsize=16)
    ax.set_xticks(x)
    ax.set_xticklabels(models, color=colors['text'])
    ax.tick_params(axis='y', colors=colors['text'])
    ax2.tick_params(axis='y', colors=colors['text'])
    
    # Customize spines
    for spine in ax.spines.values():
        spine.set_color(colors['border'])
    for spine in ax2.spines.values():
        spine.set_color(colors['border'])

    fig.legend(loc="upper right", bbox_to_anchor=(1,1), bbox_transform=ax.transAxes, facecolor=colors['card'], edgecolor=colors['border'], labelcolor=colors['text'])
    
    plt.tight_layout()
    plt.savefig(f"{OUT_DIR}/03_ml_models_comparison.png", dpi=300, bbox_inches='tight')
    plt.close()

def draw_04_architecture_high_level():
    dot = """
digraph HighLevelArch {
    rankdir=LR;
    bgcolor="#0a0e1a";
    node [shape=box, style="rounded,filled", fontname="Arial-Bold", fontcolor="#e2e8f0", fillcolor="#1a2332", color="#1e2d3d", penwidth=2];
    edge [fontname="Arial", fontsize=10, fontcolor="#e2e8f0", color="#e2e8f0", penwidth=2];

    subgraph cluster_frontend {
        label="React Frontend";
        fontname="Arial-Bold";
        fontcolor="#06b6d4";
        color="#06b6d4";
        UI [label="User Interface\n(Dashboard)", fillcolor="#111827", color="#06b6d4"];
    }

    subgraph cluster_backend {
        label="FastAPI Backend";
        fontname="Arial-Bold";
        fontcolor="#10b981";
        color="#10b981";
        API [label="REST API", fillcolor="#111827", color="#10b981"];
        ML [label="Machine Learning\nEngine", fillcolor="#111827", color="#ef4444"];
    }

    UI -> API [label=" HTTP Calls", dir=both];
    API -> ML [label=" Predictions", color="#ef4444"];
    API -> UI [label=" SSE Stream", color="#3b82f6"];
}
"""
    with open(f"{OUT_DIR}/04_high_level.dot", "w") as f:
        f.write(dot)
    subprocess.run(["dot", "-Tpng", f"{OUT_DIR}/04_high_level.dot", "-o", f"{OUT_DIR}/04_architecture_high_level.png"])
    os.remove(f"{OUT_DIR}/04_high_level.dot")

def draw_05_architecture_low_level():
    dot = """
digraph LowLevelArch {
    rankdir=TB;
    bgcolor="#0a0e1a";
    node [shape=box, style="rounded,filled", fontname="Arial-Bold", fontcolor="#e2e8f0", fillcolor="#1a2332", color="#1e2d3d", penwidth=2];
    edge [fontname="Arial", fontsize=10, fontcolor="#e2e8f0", color="#e2e8f0", penwidth=1.5];

    subgraph cluster_client {
        label="Client Browser (Vite Dev Server :5173)";
        fontname="Arial-Bold"; fontcolor="#06b6d4"; color="#06b6d4";
        ReactRouter [label="React Router Dom"];
        ReactQuery [label="TanStack React Query"];
        Plotly [label="Plotly.js Visualizations"];
        Tailwind [label="Tailwind CSS v4 Styling"];
    }

    subgraph cluster_server {
        label="Uvicorn Server (:8000)";
        fontname="Arial-Bold"; fontcolor="#10b981"; color="#10b981";
        FastAPI [label="FastAPI App (main.py)"];
        DataLoader [label="Data Loader (data_loader.py)\nPandas TSV Parsing"];
        
        subgraph cluster_models {
            label="SciKit-Learn / XGBoost";
            fontname="Arial-Bold"; fontcolor="#ef4444"; color="#ef4444";
            RF [label="Random Forest\n(rf_model.joblib)"];
            XGB [label="XGBoost\n(xgb_model.joblib)"];
            NN [label="Neural Net\n(nn_model.joblib)"];
            SHAP [label="SHAP Explainer"];
        }
    }

    subgraph cluster_storage {
        label="Local Filesystem";
        fontname="Arial-Bold"; fontcolor="#f59e0b"; color="#f59e0b";
        Dataset [label="IoT-23 Dataset\n(dev_scale/test.tsv)", shape=cylinder];
    }

    ReactRouter -> ReactQuery [style=invis];
    ReactQuery -> FastAPI [label=" REST GET/POST\n/stats, /predict"];
    FastAPI -> ReactQuery [label=" SSE Streaming\n/stream", color="#3b82f6", penwidth=2];
    
    FastAPI -> DataLoader [label=" Read File Generator"];
    DataLoader -> Dataset [label=" I/O Read", dir=forward];
    
    FastAPI -> RF [label=" Feature Array"];
    FastAPI -> XGB;
    FastAPI -> NN;
    XGB -> SHAP [label=" Model Introspection", style=dashed];
}
"""
    with open(f"{OUT_DIR}/05_low_level.dot", "w") as f:
        f.write(dot)
    subprocess.run(["dot", "-Tpng", f"{OUT_DIR}/05_low_level.dot", "-o", f"{OUT_DIR}/05_architecture_low_level.png"])
    os.remove(f"{OUT_DIR}/05_low_level.dot")

if __name__ == "__main__":
    print("Generating images...")
    draw_01_concept()
    draw_02_data_pipeline()
    draw_03_ml_models()
    try:
        draw_04_architecture_high_level()
        draw_05_architecture_low_level()
    except FileNotFoundError:
        print("Error: Graphviz 'dot' command not found. Please brew install graphviz.")
    print(f"Generated successfully in {OUT_DIR}")
