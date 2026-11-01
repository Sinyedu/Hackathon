"""Read-only service/process sampling. Run using backend/.venv Python from this folder."""
import json
import time
from pathlib import Path

import psutil

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = Path(__file__).resolve().parents[1] / 'docs/audit/evidence'
OUTPUT.mkdir(parents=True, exist_ok=True)
own = []
for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'memory_info']):
    try:
        cmd = ' '.join(proc.info['cmdline'] or [])
        if (str(ROOT).lower() in cmd.lower() and proc.info['name'].lower() in ('python.exe', 'electron.exe', 'node.exe')):
            own.append(proc)
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        pass
samples = []
for _ in range(3):
    for proc in own:
        try:
            cpu = proc.cpu_times()
            samples.append({'pid': proc.pid, 'name': proc.name(), 'ts': time.time(),
                            'rssBytes': proc.memory_info().rss, 'cpuSeconds': cpu.user + cpu.system})
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    time.sleep(5)
cpu = []
for pid in {s['pid'] for s in samples}:
    rows = [s for s in samples if s['pid'] == pid]
    first, last = rows[0], rows[-1]
    elapsed = last['ts'] - first['ts']
    if elapsed:
        cpu.append({'pid': pid, 'name': first['name'], 'oneCorePercent':
                    100 * (last['cpuSeconds'] - first['cpuSeconds']) / elapsed,
                    'lastRssMiB': last['rssBytes'] / 1024**2})
bundle = [{'file': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size}
          for p in (ROOT / 'frontend/dist').rglob('*') if p.is_file()]
report = {'date': time.strftime('%Y-%m-%dT%H:%M:%S'), 'sampleWindowSeconds': 10,
          'processCpu': cpu, 'samples': samples, 'bundle': bundle,
          'note': 'Workspace command-line match only; all Electron subprocesses are in electron.json. Not a wake-armed or 10-minute leak test.'}
(OUTPUT / 'baseline.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report, indent=2))
