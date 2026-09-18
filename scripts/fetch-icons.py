"""Download BotW material icons from Zelda Wiki into public/icons/ (Nintendo's artwork, see README).

Files are named by kebab-case English name, e.g. "Dinraal's Scale" -> dinraals-scale.png.
"""
import json, re, time, urllib.parse, urllib.request, pathlib

UA = {"User-Agent": "Mozilla/5.0 (Macintosh) botw-cooking personal icon fetch"}
API = "https://zeldawiki.wiki/w/api.php"
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "icons"
SKIP = {"Half-Heart", "Heart", "Quarter Heart", "Rupee Menu"}


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("'", "")).strip("-")


def api(params):
    return json.loads(get(API + "?" + urllib.parse.urlencode({**params, "format": "json"})))


page = api({"action": "query", "titles": "Materials_in_Breath_of_the_Wild", "prop": "images", "imlimit": 500})
titles = [i["title"] for p in page["query"]["pages"].values() for i in p.get("images", [])]
titles = [t for t in titles if re.fullmatch(r"File:BotW (.+) Icon\.png", t) and re.fullmatch(r"File:BotW (.+) Icon\.png", t)[1] not in SKIP]

OUT.mkdir(parents=True, exist_ok=True)
done = 0
for i in range(0, len(titles), 50):
    info = api({"action": "query", "titles": "|".join(titles[i : i + 50]), "prop": "imageinfo", "iiprop": "url"})
    for p in info["query"]["pages"].values():
        name = re.fullmatch(r"File:BotW (.+) Icon\.png", p["title"])[1]
        target = OUT / f"{slug(name)}.png"
        if target.exists():
            continue
        target.write_bytes(get(p["imageinfo"][0]["url"]))
        done += 1
        time.sleep(0.3)
print(f"{done} new icons, {len(list(OUT.glob('*.png')))} total in {OUT}")
