"""Export approved first-chapter exploration paintings at the game's map size."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/backgrounds/exploration/source"
OUTPUT = ROOT / "public/assets/backgrounds/exploration"
SIZE = (1152, 720)


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name in ("forest", "temple", "mountain", "cave"):
        image = Image.open(SOURCE / f"{name}-stylized.png").convert("RGB")
        if abs(image.width / image.height - SIZE[0] / SIZE[1]) > 0.01:
            raise ValueError(f"Unexpected map aspect ratio: {name}")
        image = image.resize(SIZE, Image.Resampling.NEAREST)
        image.save(OUTPUT / f"{name}.webp", quality=90, method=6)
        battle = Image.open(ROOT / f"art/backgrounds/battle/source/{name}-stylized.png").convert("RGB")
        battle.save(ROOT / f"public/assets/backgrounds/battle/{name}.webp", quality=90, method=6)


if __name__ == "__main__":
    main()
