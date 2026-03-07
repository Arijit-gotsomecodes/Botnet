"""
sampling_parser.py — Parse DATA/sampling_report.txt into structured dicts
for the dashboard's DataPipeline page.
"""

import re
from pathlib import Path

REPORT_PATH = Path(__file__).resolve().parent.parent / "DATA" / "sampling_report.txt"


def _read_report() -> str:
    return REPORT_PATH.read_text(encoding="utf-8")


# ── Per-capture table (section 8) ────────────────────────────────────────────

def parse_capture_table() -> list[dict]:
    """
    Return a list of dicts, one per capture:
    {capture_id, source_total, final_train, final_val, final_test, final_all,
     dev_train, dev_val, dev_test, dev_all}
    """
    text = _read_report()
    rows = []
    pattern = re.compile(
        r"^- (.+?) \| ([\d,]+) \| "
        r"([\d,]+)/([\d,]+)/([\d,]+)/([\d,]+) \| "
        r"([\d,]+)/([\d,]+)/([\d,]+)/([\d,]+)",
        re.MULTILINE,
    )
    for m in pattern.finditer(text):
        def n(s): return int(s.replace(",", ""))
        rows.append({
            "capture_id": m.group(1).strip(),
            "source_total": n(m.group(2)),
            "final_train": n(m.group(3)),
            "final_val": n(m.group(4)),
            "final_test": n(m.group(5)),
            "final_all": n(m.group(6)),
            "dev_train": n(m.group(7)),
            "dev_val": n(m.group(8)),
            "dev_test": n(m.group(9)),
            "dev_all": n(m.group(10)),
        })
    return rows


# ── Reproducibility settings (section 4) ─────────────────────────────────────

def parse_reproducibility() -> dict:
    text = _read_report()
    settings = {}
    kv_pattern = re.compile(r"^(\w[\w_]+)\s*=\s*(.+)$", re.MULTILINE)
    in_section = False
    for line in text.splitlines():
        if "4) Reproducibility" in line:
            in_section = True
            continue
        if in_section and line.startswith("5)"):
            break
        if in_section:
            m = kv_pattern.match(line.strip())
            if m:
                key, val = m.group(1), m.group(2).strip()
                settings[key] = val
    return settings


# ── Summary stats (section 6) ────────────────────────────────────────────────

def parse_summary_stats() -> dict:
    """Parse section 6 for final_scale and dev_scale totals."""
    text = _read_report()
    result = {}
    scale_pattern = re.compile(
        r"(final_scale|dev_scale) \(total rows = ([\d,]+)\)"
    )
    split_pattern = re.compile(
        r"- (train|val|test): rows=([\d,]+) \(([\d.]+)%\), "
        r"benign=([\d,]+) \(([\d.]+)%\), "
        r"malicious=([\d,]+) \(([\d.]+)%\)"
    )
    current_scale = None
    for line in text.splitlines():
        sm = scale_pattern.search(line)
        if sm:
            current_scale = sm.group(1)
            result[current_scale] = {
                "total_rows": int(sm.group(2).replace(",", "")),
                "splits": {},
            }
            continue
        if current_scale:
            spm = split_pattern.search(line)
            if spm:
                result[current_scale]["splits"][spm.group(1)] = {
                    "rows": int(spm.group(2).replace(",", "")),
                    "pct": float(spm.group(3)),
                    "benign": int(spm.group(4).replace(",", "")),
                    "benign_pct": float(spm.group(5)),
                    "malicious": int(spm.group(6).replace(",", "")),
                    "malicious_pct": float(spm.group(7)),
                }
    return result


# ── Steps & soft-balancing explanation (sections 3, 7) ────────────────────────

def parse_pipeline_steps() -> list[dict]:
    """Return the ETL step list from section 3."""
    text = _read_report()
    steps = []
    step_re = re.compile(r"^Step (\d+): (.+)$", re.MULTILINE)
    intent_re = re.compile(r"^Intent: (.+)$", re.MULTILINE)

    lines = text.splitlines()
    i = 0
    while i < len(lines):
        sm = step_re.match(lines[i].strip())
        if sm:
            step_num = int(sm.group(1))
            step_desc = sm.group(2).strip()
            intent = ""
            if i + 1 < len(lines):
                im = intent_re.match(lines[i + 1].strip())
                if im:
                    intent = im.group(1).strip()
            steps.append({
                "step": step_num,
                "description": step_desc,
                "intent": intent,
            })
        i += 1
    return steps


def parse_soft_balancing() -> dict:
    """Return soft-balancing explanation from section 7."""
    text = _read_report()
    section_start = text.find("7) Beginner-Friendly")
    section_end = text.find("8) Per-Capture")
    if section_start == -1:
        return {}
    section = text[section_start:section_end].strip()
    return {
        "title": "Soft Balancing Explanation",
        "content": section,
        "train_benign_target": "35%",
        "applied_to": "TRAIN split only",
    }


# ── Source totals ─────────────────────────────────────────────────────────────

def parse_source_totals() -> dict:
    text = _read_report()
    m = re.search(
        r"Source totals: total=([\d,]+), benign=([\d,]+), malicious=([\d,]+)",
        text,
    )
    if not m:
        return {}
    return {
        "total": int(m.group(1).replace(",", "")),
        "benign": int(m.group(2).replace(",", "")),
        "malicious": int(m.group(3).replace(",", "")),
    }
