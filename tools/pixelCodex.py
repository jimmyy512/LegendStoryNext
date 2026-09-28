"""用 Codex CLI 的圖像生成平行產部件表。

每個工作一個資料夾（預設 art/characters/pixelHeroine/source/codex/<名稱>，工作可用 "folder" 指定上層），放 prompt.txt 與參考圖，產出 out.png。

    python tools/pixelCodex.py tools/pixelCodexJobs.json [名稱 ...]

jobs = [{"name": ..., "prompt": ..., "refs": [路徑, ...], "folder"?: 相對 repo 的上層}, ...]。只給名稱時只重跑那幾個。
-i 會吃掉後面所有參數，所以提示詞一定走 stdin。
Codex 自己存 out.png 時會抓 ~/.codex/generated_images 裡「全域最新」的圖，平行跑會拿到別的工作的圖，
所以跑完一律改由紀錄裡的 session id 找自己那個子資料夾的最新圖覆蓋 out.png。
"""

import json
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'art/characters/pixelHeroine/source/codex'
GENERATED = Path.home() / '.codex/generated_images'


def own_image(folder: Path) -> Path | None:
    """這次 Codex 工作自己產生的最後一張圖。"""
    found = re.search(r'session id: (\S+)', (folder / 'codex.log').read_text(encoding='utf-8', errors='replace'))
    images = sorted((GENERATED / found[1]).glob('*.png'), key=lambda f: f.stat().st_mtime) if found else []
    return images[-1] if images else None


def run(job: dict) -> tuple[str, int, bool]:
    folder = (ROOT / job['folder'] if 'folder' in job else OUT) / job['name']
    folder.mkdir(parents=True, exist_ok=True)
    args = []
    for k, ref in enumerate(job.get('refs', []), 1):
        dst = folder / f'ref{k}{Path(ref).suffix}'
        shutil.copy(ROOT / ref, dst)
        args += ['-i', dst.name]
    prompt = job['prompt'].rstrip() + '\nSave the final image as out.png in the current directory.\n'
    (folder / 'prompt.txt').write_text(prompt, encoding='utf-8')
    (folder / 'out.png').unlink(missing_ok=True)
    with open(folder / 'codex.log', 'w', encoding='utf-8') as log, open(folder / 'prompt.txt', 'rb') as stdin:
        rc = subprocess.call(
            ['codex', 'exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-C', str(folder), *args, '-'],
            stdin=stdin, stdout=log, stderr=subprocess.STDOUT, cwd=folder,
        )
    image = own_image(folder)
    if image:
        shutil.copy(image, folder / 'out.png')
    else:
        (folder / 'out.png').unlink(missing_ok=True)
    return job['name'], rc, image is not None


if __name__ == '__main__':
    jobs = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    only = set(sys.argv[2:])
    jobs = [job for job in jobs if not only or job['name'] in only]
    with ThreadPoolExecutor(6) as pool:
        for name, rc, ok in pool.map(run, jobs):
            print(name, 'rc', rc, 'OK' if ok else 'MISSING', flush=True)
