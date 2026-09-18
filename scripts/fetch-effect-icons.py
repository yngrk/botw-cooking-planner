"""Download BotW effect icons from Zelda Wiki into public/icons/effects/ (Nintendo's artwork, see README).

Saved as <effect key>.png, matching EffectKey in src/types.ts. Hearts/hearty use our own SVG hearts.
"""
import json, pathlib, time, urllib.parse, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Macintosh) botw-cooking personal icon fetch"}
API = "https://zeldawiki.wiki/w/api.php"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "icons" / "effects"
FILES = {
    "energizing": "Stamina Restoration",
    "enduring": "Extra Stamina Wheel",
    "spicy": "Cold Resistance",  # spicy food protects from cold
    "chilly": "Heat Resistance",
    "fireproof": "Flame Guard",
    "electro": "Shock Resistance",
    "mighty": "Mighty",
    "tough": "Tough",
    "sneaky": "Sneaky",
    "hasty": "Hasty",
}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


titles = {f"File:BotW {name} Icon.png": key for key, name in FILES.items()}
info = json.loads(get(API + "?" + urllib.parse.urlencode(
    {"action": "query", "titles": "|".join(titles), "prop": "imageinfo", "iiprop": "url", "format": "json"})))
OUT.mkdir(parents=True, exist_ok=True)
for p in info["query"]["pages"].values():
    (OUT / f"{titles[p['title']]}.png").write_bytes(get(p["imageinfo"][0]["url"]))
    time.sleep(0.3)
print(sorted(f.name for f in OUT.glob("*.png")))
