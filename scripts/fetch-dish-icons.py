"""Download BotW dish and elixir icons from Zelda Wiki into public/icons/dishes/ (Nintendo's artwork, see README).

Named like the ingredient icons: kebab-case English name, e.g. "Mushroom Skewer" -> mushroom-skewer.png.
Elixirs are per effect ("Hearty Elixir"); the recipe table only says "Elixir".
"""
import json, pathlib, re, time, urllib.parse, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Macintosh) botw-cooking personal icon fetch"}
API = "https://zeldawiki.wiki/w/api.php"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "icons" / "dishes"
EFFECTS = ["Hearty", "Energizing", "Enduring", "Chilly", "Spicy", "Electro", "Fireproof", "Mighty", "Tough", "Sneaky", "Hasty"]


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("'", "")).strip("-")


recipes = json.loads((ROOT / "data" / "recipes.json").read_text())
names = {r["en"] for r in recipes["recipes"] + recipes["singleRecipes"]} - {"Elixir"}
names |= {"Dubious Food"} | {f"{e} Elixir" for e in EFFECTS}

OUT.mkdir(parents=True, exist_ok=True)
names = sorted(n for n in names if not (OUT / f"{slug(n)}.png").exists())
missing = []
for i in range(0, len(names), 50):
    titles = {f"File:BotW {n} Icon.png": n for n in names[i : i + 50]}
    info = json.loads(get(API + "?" + urllib.parse.urlencode(
        {"action": "query", "redirects": 1, "titles": "|".join(titles), "prop": "imageinfo", "iiprop": "url", "format": "json"})))
    # Follow redirects back to the name we asked for.
    back = {r["to"]: r["from"] for r in info["query"].get("redirects", [])}
    for p in info["query"]["pages"].values():
        name = titles[back.get(p["title"], p["title"])]
        if "imageinfo" not in p:
            missing.append(name)
            continue
        (OUT / f"{slug(name)}.png").write_bytes(get(p["imageinfo"][0]["url"]))
        time.sleep(0.3)
print(f"{len(list(OUT.glob('*.png')))} icons in {OUT}; missing on the wiki: {missing}")
