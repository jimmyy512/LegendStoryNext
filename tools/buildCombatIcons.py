"""Crop approved combat artwork into grounded enemy poses and readable skill icons."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ENEMY_SOURCE = ROOT / "art/characters/enemies/source"
ENEMY_PUBLIC = ROOT / "public/assets/characters/enemies"
EFFECT_SOURCE = ROOT / "art/effects/source"
ICON_PUBLIC = ROOT / "public/assets/icons/skills"


def cropped_art(path: Path, margin: int = 8) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    # Image generation occasionally leaves almost transparent stray pixels far
    # outside the figure. Find the silhouette, then retain its softer edge.
    bbox = image.getchannel("A").point(lambda alpha: 255 if alpha > 100 else 0).getbbox()
    if bbox is None:
        raise ValueError(f"No visible art: {path}")
    left, top, right, bottom = bbox
    return image.crop(
        (
            max(0, left - margin),
            max(0, top - margin),
            min(image.width, right + margin),
            min(image.height, bottom + margin),
        )
    )


def main() -> None:
    ENEMY_PUBLIC.mkdir(parents=True, exist_ok=True)
    ICON_PUBLIC.mkdir(parents=True, exist_ok=True)
    for enemy in ("disciple", "bandit", "zombie", "boss"):
        image = cropped_art(ENEMY_SOURCE / f"{enemy}-down.png")
        image.save(ENEMY_PUBLIC / f"{enemy}-down.webp", lossless=True, method=6)
        step = Image.open(ENEMY_SOURCE / f"{enemy}-step.png").convert("RGBA")
        step.save(ENEMY_PUBLIC / f"{enemy}-step.webp", lossless=True, method=6)
    for skill in ("pierce", "swordfall", "guard", "dragon"):
        image = cropped_art(EFFECT_SOURCE / f"{skill}.png", 12)
        image.thumbnail((88, 88), Image.Resampling.LANCZOS)
        tile = Image.new("RGBA", (96, 96))
        tile.alpha_composite(image, ((96 - image.width) // 2, (96 - image.height) // 2))
        tile.save(ICON_PUBLIC / f"{skill}.webp", lossless=True, method=6)


if __name__ == "__main__":
    main()
