"""Export the twelve authored inventory illustrations from the source atlas."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IDS = ('herb', 'tonic', 'elixir', 'sword', 'wraps', 'robe', 'armor', 'jade', 'letter', 'flower', 'wine', 'journal')

atlas = Image.open(ROOT / 'art/items/source/inventory-atlas.png').convert('RGBA')
output = ROOT / 'public/assets/icons/items'
output.mkdir(parents=True, exist_ok=True)
for index, name in enumerate(IDS):
    col, row = index % 4, index // 4
    icon = atlas.crop((round(col * atlas.width / 4), round(row * atlas.height / 3), round((col + 1) * atlas.width / 4), round((row + 1) * atlas.height / 3)))
    icon = icon.resize((112, 100), Image.Resampling.LANCZOS)
    icon.save(output / f'{name}.webp', quality=94, method=6)

props = Image.open(ROOT / 'art/items/source/world-props.png').convert('RGBA')
for name, left, right in [('herb', 0, 360), ('tonic', 370, 770), ('elixir', 780, 1215), ('chest', 1220, 1655), ('wine', 1660, 2048)]:
    icon = props.crop((round(left * props.width / 2048), 0, round(right * props.width / 2048), props.height))
    box = icon.getchannel('A').point(lambda a: 255 if a > 100 else 0).getbbox()
    if not box:
        raise ValueError(f'Missing prop: {name}')
    icon = icon.crop(box)
    icon.thumbnail((104, 96), Image.Resampling.NEAREST)
    tile = Image.new('RGBA', (112, 100))
    tile.alpha_composite(icon, ((112-icon.width)//2, (100-icon.height)//2))
    tile.save(output / f'{name}.webp', lossless=True, method=6)

portrait = Image.open(ROOT / 'art/characters/enemies/source/bandit-portrait.png').convert('RGBA')
box = portrait.getchannel('A').point(lambda a: 255 if a > 100 else 0).getbbox()
portrait = portrait.crop(box)
portrait.thumbnail((360, 420), Image.Resampling.NEAREST)
portrait.save(ROOT / 'public/assets/characters/enemies/bandit-portrait.webp', lossless=True, method=6)
