"""本地像素素材產生器：ComfyUI + FLUX.2 klein 參考圖編輯。

用現有部件表當參考圖，產生同風格的新部件表（武器、髮型、衣褲靴），
再去背、切格，交給 tools/pixelHeroineParts.py 縮成 1:1 像素。

    python tools/pixelgen/pixelgen.py generate --preset outfit-robe --count 4
    python tools/pixelgen/pixelgen.py generate --prompt "..." --out art/.../gen/foo
    python tools/pixelgen/pixelgen.py slice art/.../gen/foo-0.png --grid 4x4

ComfyUI 與短影音流程共用同一張 4090。送出前會等佇列清空一段時間，
不會插隊，也不會在影片流程執行中搶顯存。輸出走 PreviewImage（暫存），
不寫進短影音的輸出資料夾。只用標準庫、Pillow 與 numpy。
"""

import argparse
import json
import random
import sys
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
COMFY = 'http://127.0.0.1:8188'
KEY = (255, 0, 255)  # 去背用洋紅底

STYLE = (
    'Production pixel-art cutout sheet for a 2D skeletal animation game. '
    'Match the reference image exactly: same hard-edged 16-bit pixel art, chunky square pixels, '
    'thick dark outline, limited palette, no antialiasing, no gradients, three-quarter view facing right. '
    'Every part is fully isolated in its own cell of an even grid with generous padding. '
    'Solid flat pure magenta #FF00FF background everywhere, no shadows, no text, no labels, no borders.'
)
PRESETS = json.loads((HERE / 'presets.json').read_text(encoding='utf-8'))


def request(path: str, data: bytes | None = None, headers: dict | None = None):
    req = urllib.request.Request(f'{COMFY}{path}', data=data, headers=headers or {})
    with urllib.request.urlopen(req, timeout=60) as res:
        body = res.read()
    return json.loads(body) if body[:1] in b'{[' else body


def wait_idle(quiet: float, poll: float = 10) -> None:
    """佇列持續空著 quiet 秒才回來，避免夾在影片流程的兩個鏡頭之間。"""
    since = None
    while True:
        try:
            queue = request('/queue')
            busy = len(queue['queue_running']) + len(queue['queue_pending'])
        except OSError:
            busy = 1  # ComfyUI 重啟中，視同忙碌
        if busy:
            if since is not None:
                print('ComfyUI 又有工作，繼續等待')
            since = None
        elif since is None:
            since = time.time()
        elif time.time() - since >= quiet:
            return
        time.sleep(poll)


def upload(path: Path) -> str:
    boundary = uuid.uuid4().hex
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="subfolder"\r\n\r\nlegendstory\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{path.name}"\r\n'
        'Content-Type: image/png\r\n\r\n'
    ).encode() + path.read_bytes() + f'\r\n--{boundary}--\r\n'.encode()
    result = request(
        '/upload/image', body, {'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    return f"{result['subfolder']}/{result['name']}"


def reference_png(path: Path) -> Path:
    """透明部件表鋪上洋紅底再上傳，讓模型看到與輸出一致的底色。"""
    image = Image.open(path).convert('RGBA')
    flat = Image.new('RGBA', image.size, KEY + (255,))
    flat.alpha_composite(image)
    out = HERE / 'cache' / f'{path.stem}-keyed.png'
    out.parent.mkdir(exist_ok=True)
    flat.convert('RGB').save(out)
    return out


def workflow(prompt: str, refs: list[str], seed: int, size: int, steps: int, cfg: float) -> dict:
    graph = json.loads((HERE / 'flux2_klein_edit.api.json').read_text(encoding='utf-8'))
    graph['pos']['inputs']['text'] = f'{STYLE}\n{prompt}'
    graph['noise']['inputs']['noise_seed'] = seed
    graph['latent']['inputs'].update(width=size, height=size)
    graph['sched']['inputs'].update(width=size, height=size, steps=steps)
    graph['guider']['inputs']['cfg'] = cfg
    # 每張參考圖各接一次 ReferenceLatent，正負條件都要帶。
    pos, neg = ['pos', 0], ['neg', 0]
    for i, name in enumerate(refs):
        graph[f'load{i}'] = {'class_type': 'LoadImage', 'inputs': {'image': name}}
        graph[f'scale{i}'] = {
            'class_type': 'ImageScaleToTotalPixels',
            'inputs': {
                'image': [f'load{i}', 0],
                'upscale_method': 'nearest-exact',
                'megapixels': 1.0,
                'resolution_steps': 16,
            },
        }
        graph[f'enc{i}'] = {
            'class_type': 'VAEEncode',
            'inputs': {'pixels': [f'scale{i}', 0], 'vae': ['vae', 0]},
        }
        graph[f'rp{i}'] = {
            'class_type': 'ReferenceLatent',
            'inputs': {'conditioning': pos, 'latent': [f'enc{i}', 0]},
        }
        graph[f'rn{i}'] = {
            'class_type': 'ReferenceLatent',
            'inputs': {'conditioning': neg, 'latent': [f'enc{i}', 0]},
        }
        pos, neg = [f'rp{i}', 0], [f'rn{i}', 0]
    graph['guider']['inputs'].update(positive=pos, negative=neg)
    return graph


def run(graph: dict) -> Image.Image:
    client = uuid.uuid4().hex
    prompt_id = request(
        '/prompt',
        json.dumps({'prompt': graph, 'client_id': client}).encode(),
        {'Content-Type': 'application/json'},
    )['prompt_id']
    while True:
        history = request(f'/history/{prompt_id}')
        if prompt_id in history:
            entry = history[prompt_id]
            if entry.get('status', {}).get('status_str') == 'error':
                raise RuntimeError(json.dumps(entry['status'], ensure_ascii=False)[:800])
            image = entry['outputs']['preview']['images'][0]
            query = urllib.parse.urlencode(image)
            data = request(f'/view?{query}')
            from io import BytesIO

            return Image.open(BytesIO(data)).convert('RGB')
        time.sleep(3)


def key_out(image: Image.Image, tolerance: int = 90) -> Image.Image:
    """洋紅底轉透明，邊緣帶洋紅色偏的像素也一併去掉。"""
    rgb = np.asarray(image.convert('RGB'), dtype=np.int32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    distance = np.abs(r - 255) + g + np.abs(b - 255)
    magenta_cast = (r > 150) & (b > 150) & (g < 110)
    alpha = np.where((distance < tolerance) | magenta_cast, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), 'RGBA')


def slice_grid(path: Path, grid: str, names: list[str] | None) -> list[Path]:
    cols, rows = (int(v) for v in grid.lower().split('x'))
    image = key_out(Image.open(path))
    w, h = image.width / cols, image.height / rows
    outputs = []
    for index in range(cols * rows):
        x, y = index % cols, index // cols
        cell = image.crop((round(x * w), round(y * h), round((x + 1) * w), round((y + 1) * h)))
        box = cell.getchannel('A').getbbox()
        if not box:
            continue
        name = names[index] if names and index < len(names) else f'cell{index}'
        out = path.with_name(f'{path.stem}-{name}.png')
        cell.crop(box).save(out)
        outputs.append(out)
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    gen = sub.add_parser('generate', help='送 ComfyUI 產生部件表')
    gen.add_argument('--preset', choices=sorted(PRESETS))
    gen.add_argument('--prompt', help='自訂內容描述，會接在風格描述後面')
    gen.add_argument('--ref', action='append', help='參考圖，可重複；預設為原部件表')
    gen.add_argument('--out', help='輸出路徑前綴（不含副檔名）')
    gen.add_argument('--count', type=int, default=1)
    gen.add_argument('--seed', type=int)
    gen.add_argument('--size', type=int, default=1024)
    gen.add_argument('--steps', type=int, default=28)
    gen.add_argument('--cfg', type=float, default=4.0)
    gen.add_argument('--quiet', type=float, default=90, help='佇列需空閒多少秒才送出')
    cut = sub.add_parser('slice', help='去背並依格線切出部件')
    cut.add_argument('image', type=Path)
    cut.add_argument('--grid', default='4x4')
    cut.add_argument('--names', help='逗號分隔的部件名稱，依列優先順序')
    args = parser.parse_args()

    if args.command == 'slice':
        names = args.names.split(',') if args.names else None
        for out in slice_grid(args.image, args.grid, names):
            print(out)
        return

    preset = PRESETS.get(args.preset or '', {})
    prompt = args.prompt or preset.get('prompt')
    if not prompt:
        sys.exit('需要 --preset 或 --prompt')
    refs = [Path(r) for r in (args.ref or preset.get('refs') or ['art/characters/pixelHeroine/source/parts-v1.png'])]
    out = Path(args.out or f"art/characters/pixelHeroine/source/gen/{args.preset or 'custom'}")
    out = out if out.is_absolute() else ROOT / out
    out.parent.mkdir(parents=True, exist_ok=True)
    seed = args.seed if args.seed is not None else random.randrange(2**31)
    print(f'等待 ComfyUI 閒置 {args.quiet:.0f} 秒…', flush=True)
    wait_idle(args.quiet)
    names = [upload(reference_png(r if r.is_absolute() else ROOT / r)) for r in refs]
    for i in range(args.count):
        if i:
            wait_idle(args.quiet)
        started = time.time()
        image = run(workflow(prompt, names, seed + i, args.size, args.steps, args.cfg))
        target = out.with_name(f'{out.name}-{i}.png')
        image.save(target)
        meta = {'prompt': prompt, 'refs': [str(r) for r in refs], 'seed': seed + i, 'steps': args.steps, 'cfg': args.cfg}
        target.with_suffix('.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
        print(f'{target}  ({time.time() - started:.0f} 秒)', flush=True)


if __name__ == '__main__':
    main()
