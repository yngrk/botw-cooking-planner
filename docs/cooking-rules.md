# BotW cooking rules (implementable spec)

Scope: *The Legend of Zelda: Breath of the Wild* (not TotK), cooking pot.
Primary source is the game's own logic as reconstructed by the zeldaret/botw
decompilation (`src/Game/Cooking/cookManager.cpp`, v1.5.0 Switch) plus the
game's config file `Cooking/CookData.byml` and per-actor values from the game
files. See `data/SOURCES.md` for provenance and the list of open questions.

Everything below is stated in **game units**, and the steps are in the order the
game runs them. Where the order changes the result (it does in several places),
the order is part of the spec.

---

## 0. Units and field reference (`data/ingredients.json`)

| unit | meaning |
|---|---|
| HP | **quarter hearts** (4 = 1 heart). `hp` in the JSON is the raw per-item value (ActorInfo `cureItemHitPointRecover`). Cooking doubles it (§4). |
| energizing | internal "vitality" units of **1/5 wheel**; the game stores the final value ×200 (1000 = 1 wheel). |
| enduring | units of **1/5 extra wheel** (not multiplied). |
| hearty | units of **quarter hearts** of extra (yellow) hearts; rounded up to whole hearts. |
| other effects | level 1–3 (heat/cold/fireproof max 2). |
| time | seconds. |

Per-ingredient fields that the formulas use:

| field | ActorInfo key | used as |
|---|---|---|
| `hp` | `cureItemHitPointRecover` | summed × count, then ×2 (×1 for dubious food) |
| `effect` / `effectTypeInternal` | `cureItemEffectType` | effect identity (only if `effectLevel` > 0) |
| `effectLevel` | `cureItemEffectLevel` | potency points, summed × count |
| `effectBaseTime` | CEI `BT` of the effect | duration per effect-bearing item |
| `timeBoost` + `timeBoostScope` | `cookSpiceBoostEffectiveTime` | see §6 |
| `hpBoost` | `cookSpiceBoostHitPointRecover` | flat quarter hearts, **once per distinct ingredient**, not doubled (§4) |
| `critChance` | `cookSpiceBoostSuccessRate` | crit chance in % (§9) |
| `maxHeartBoost`, `staminaBoost` | `cookSpiceBoostMaxHeartLevel`, `cookSpiceBoostStaminaLevel` | always 0 in BotW data, listed so you can confirm they don't matter |
| `sellPrice`, `buyPrice`, `cookLowPrice` | `itemSellingPrice`, `itemBuyingPrice`, tag `CookLowPrice` | sell price of the dish (§12) |
| `cookTags` | actor tags `Cook*` | recipe matching (§2) — **use these, not `category`** |
| `rawEatEffectTime` | `cureItemEffectiveTime` | **not used by cooking**. It only applies when the item is eaten raw |

`category` is a display grouping only. Its values are `fruit`, `mushroom`, `vegetable`,
`meat`, `fish`, `seafood` (snails and crabs; the game tags these `CookFish`), `spice` (tag `CookSpice`
and ordinary food: rice, wheat, milk, egg, sugar, butter, salt, Goron spice, nuts, honey),
`critter` (`CookInsect`), `monster-part` (`CookEnemy`, incl. Guardian parts), `dragon-part`,
`mineral` (tag `CookOre`: gems, flint, wood → rock-hard food) and `special` (fairy, star
fragment, monster extract).

Effect keys map to internal names like this:
`hearty`=LifeMaxUp, `energizing`=GutsRecover, `enduring`=ExGutsMaxUp, `chilly`=ResistHot
(heat resistance), `spicy`=ResistCold (cold resistance), `electro`=ResistElectric,
`fireproof`=Fireproof, `mighty`=AttackUp, `tough`=DefenseUp, `sneaky`=Quietness,
`hasty`=MovingSpeed (hashed as "AllSpeed" in CookData).

---

## 1. Input normalisation

* 1–5 items. Identical items are grouped into **distinct entries with a count**
  (`[{name, count}]`, at most 5 entries). Several rules below count *distinct*
  entries and others count *total* items, so keep both counts.
* `totalCount` = sum of counts. `distinctCount` = number of entries.

## 2. Picking the result dish (recipe matching)

`CookData.Recipes` is an ordered list. **The first recipe that matches wins.**
A recipe is a list of *slots*. Each slot is a set of alternatives (actor names or
tags). A recipe matches if every slot can be filled by a **different distinct
entry** (greedy, in slot order). Extra ingredients are allowed. Two apples are one
entry and fill only one slot.

Algorithm:

```
if distinctCount > 1:
    for recipe in Recipes (in order):
        if len(recipe.slots) > distinctCount: skip
        if all slots can be filled by distinct unused entries: RESULT = recipe; goto 3
    # no multi recipe matched -> single-ingredient fallback
    nonSpice = entries without tag CookSpice
    if len(nonSpice) == 1: single = nonSpice[0] else: FAIL (dubious)
else:
    single = entries[0]           # even if it is a spice
for recipe in SingleRecipes (in order):
    if single matches (actor in list, or single has one of the tags): RESULT = recipe; goto 3
FAIL -> Dubious Food
```

The first six multi-recipes decide the dish **class**. Everything else only
picks the dish name and, for a few dishes, adds an HP bonus (`HB`):

| prio | slots | result |
|---|---|---|
| 0–2 | fairy + (ore/critter/monster …) | **Fairy Tonic** (HB −12) |
| 3 | any `CookOre` (gem, flint, wood) | **Rock-Hard Food** |
| 4 | `CookEnemy` + `CookInsect` | **Elixir** (Medicine) |
| 5 | `CookEnemy` or `CookInsect` | **Dubious Food** |
| 6… | named dishes | **Meal** |
| last | fairy alone in a mix | Fairy Tonic (only reached when nothing else matched; any food with a fairy matches an earlier food recipe first) |

So:
* A **critter or a monster part in a meal** → Dubious Food, unless both kinds are present (→ Elixir).
* **Critter + monster part + food** → Elixir. The food's HP and effect count, and a
  conflicting effect cancels (§3), which turns the elixir into Dubious Food.
* **Fairy + food** (no critter/monster/ore) → a normal meal, and the fairy adds 20×2 = 40 quarters (10 hearts).
* **Fairy + any critter, monster part or ore** → Fairy Tonic.
* **Ore/wood + anything except a fairy** → Rock-Hard Food.
* **Only spices** (tag `CookSpice`: salt, sugar, rice, wheat, butter, milk, egg, spice, nuts, honey,
  monster extract, star fragment, dragon parts) → the single-recipe fallback. Milk, egg, honey,
  acorn/chickaloo have single recipes. The others (e.g. rock salt alone, rice alone, a dragon scale
  alone, a star fragment alone) → Dubious Food. Two different spices with nothing else → Dubious
  Food unless a multi recipe matches (e.g. rice + egg = Fried Egg and Rice).
* A critter alone or a monster part alone → Dubious Food.

Recipe HP bonuses (`HB`, quarter hearts, added in step 11):

| dish | HB |
|---|---|
| Fairy Tonic | −12 |
| Honey Candy (honey alone) | −8 |
| Sautéed Nuts (acorn/chickaloo alone) | −2 |
| Milk / Warme Milch (milk alone, SingleRecipe) | +2 |
| Fruitcake | +4 |
| Hot Buttered Apple | +4 |
| Honey Crepe | +4 |
| Seafood Paella | +8 |
| Wildberry Crepe | +16 |

No recipe has a time bonus (`TB`) in BotW data.

The full recipe table is in the appendix (§A).

---

## 3. Effect aggregation (`cookCalcIngredientsBoost`)

Loop over the entries. Here `c` is the entry count.

```
timeBoost  = Σ (timeBoost × c)              over entries with CookEnemy (monster parts)
lifeRaw    = Σ (hp × c)                     over entries WITHOUT CookEnemy
effCount[e]= Σ c                            over non-CookEnemy entries with effect e and effectLevel > 0
effLevel[e]= Σ (effectLevel × c)            (same entries)
```

* **More than one different effect → no effect at all.** This covers hearty with
  energizing too. Effect, potency and time are all cleared, and the HP still counts.
  A neutral ingredient (no effect) never cancels anything.
* With exactly one effect `e`:
  `vit = effLevel[e] × MR[e]` (float), and if `BT[e] > 0`:
  `time = timeBoost + 30 × totalCount + BT[e] × effCount[e]`.
  **Every** item counts in the `30 × totalCount` term (spices, monster parts, neutral food).
* Fairy Tonic: if the result is Fairy Tonic, any effect is cleared.
* Elixir without an effect (e.g. conflicting effects) → becomes **Dubious Food**.
* HP: `life = lifeRaw × 2` for any non-failed dish. Dubious/rock-hard use ×1 (§8).
* Clamp `vit` to `Ma[e]` (it is clamped again at the end).

CEI table (`CookData.System.CEI`):

| effect | BT (s) | MR | Ma (cap) | Mi | SSA (crit add) |
|---|---|---|---|---|---|
| LifeRecover (plain HP) | – | 2.0 | 120 (30 hearts) | 1 | 12 (3 hearts) |
| hearty (LifeMaxUp) | 0 | 1.0 | 108 (27 yellow hearts) | 4 | 4 (1 heart) |
| energizing (GutsRecover) | 0 | 1.4 | 15 (3 wheels) | 1 | 2 (2/5 wheel) |
| enduring (ExGutsMaxUp) | 0 | 0.5 | 20 (4 wheels) | 1 | 2 (2/5 wheel) |
| chilly (ResistHot) | 120 | 0.35 | 2 | 1 | 1 |
| spicy (ResistCold) | 120 | 0.35 | 2 | 1 | 1 |
| electro (ResistElectric) | 120 | 0.5 | 3 | 1 | 1 |
| fireproof | 120 | 0.3 | 2 | 1 | 1 |
| mighty (AttackUp) | 20 | 0.45 | 3 | 1 | 1 |
| tough (DefenseUp) | 20 | 0.45 | 3 | 1 | 1 |
| sneaky (Quietness) | 90 | 0.35 | 3 | 1 | 1 |
| hasty (AllSpeed/MovingSpeed) | 30 | 0.45 | 3 | 1 | 1 |

### Potency → level

`level = max(1, floor(sum × MR))`, capped at Ma. The game computes this in
float32 and truncates. For every sum from 0 to 199 the result is identical to exact
integer arithmetic, so implement it as `floor(sum × num / den)` with MR =
7/5, 1/2, 7/20, 9/20, 3/10, 1/1. **Do not use JS doubles on `0.35`, `0.45` or `0.3` directly.**

| effect | L1 | L2 at sum ≥ | L3 at sum ≥ |
|---|---|---|---|
| chilly / spicy (0.35, cap 2) | 1 | 6 | – |
| fireproof (0.3, cap 2) | 1 | 7 | – |
| electro (0.5) | 1 | 4 | 6 |
| mighty / tough / hasty (0.45) | 1 | 5 | 7 |
| sneaky (0.35) | 1 | 6 | 9 |

Energizing: `units = min(15, max(1, floor(sum × 7/5)))`, displayed as units/5 wheels
(game value = units × 200). Enduring: `units = min(20, max(1, floor(sum / 2)))`,
displayed as units/5 extra wheels. Hearty: `quarters = min(108, sum)`, then rounded
**up** to a multiple of 4, minimum 4.

---

## 4. HP

```
life = 2 × Σ(hp × count)            (non-CookEnemy entries; step 3)
     + 12 if crit chose "hearts"    (step 9)
     + Σ hpBoost over DISTINCT CookSpice (non-CookEnemy) entries   (step 10, not doubled)
     + recipe HB                    (step 11)
life = trunc(life); clamp to [0, 120]
if no effect and life == 0: life = 1   (a quarter heart)
```

* Cap: 120 quarters = 30 hearts. Food with no HP but an effect (e.g. 5× Mighty
  Thistle, elixirs) restores **0**.
* `hpBoost` is only non-zero for acorn (2), chickaloo nut (2) and dragon parts
  (scale 5, claw 8, fang shard 10, horn shard 15). The game adds it once per
  distinct ingredient, not per item (see SOURCES, open question 2).
* **Hearty dishes**: the final `life` is replaced by the hearty value (§5). The dish
  fully restores health and adds `quarters/4` yellow hearts. The normal HP of the
  ingredients is discarded.

## 5. Hearty / energizing / enduring

* **Hearty**: `vit = Σ effectLevel` (MR 1.0), where effectLevel is already in quarter
  hearts (Hearty Radish 12 = 3 hearts, Big Hearty Radish 20 = 5 hearts). A crit adds 4. Then
  clamp to 108, round up to a multiple of 4, minimum 4. Result: full heal + `vit/4`
  yellow hearts (max 27).
* **Energizing**: `floor(Σlvl × 1.4)`, min 1, max 15. A crit adds 2 after truncation:
  `int(vit) + 2`. It is capped at 15 again, then ×200. It restores `units/5` wheels.
* **Enduring**: `floor(Σlvl × 0.5)`, min 1 (a single Endura Shroom = 0.5 → 1), crit +2,
  cap 20. Full stamina restore plus `units/5` extra wheels. For example, 5 Endura Carrots
  = 20 × 0.5 = 10 → 2 extra wheels.
* None of the three has a duration (BT = 0), so they ignore time and time crits.

## 6. Duration

Only for effects with BT > 0 (chilly, spicy, electro, fireproof, mighty, tough,
sneaky, hasty):

```
time = 30 × totalCount
     + BT[e] × (number of items carrying effect e)
     + Σ timeBoost × count          over monster parts (CookEnemy): horn-class 40, fang-class 80, guts-class 160
     + 300 if crit chose "time"
     + Σ timeBoost                  over DISTINCT spice entries (CookSpice, not CookEnemy): once, regardless of count
time = clamp(time, 0, 1800)          (30:00 max)
```

In practice, per item, **if the dish has a timed effect**:

| item kind | first copy | each additional copy |
|---|---|---|
| effect ingredient | 30 + BT (150 heat/cold/electro/fire, 50 mighty/tough, 120 sneaky, 60 hasty) | same |
| monster part | 30 + 40 / 80 / 160 | same |
| spice (`timeBoostScope: once-per-distinct`) | 30 + timeBoost | 30 |
| any other item (incl. neutral food, critter without the effect) | 30 | 30 |

Spice timeBoost values: rock salt 30, rice 30, wheat 30, milk 50, sugar 50,
butter 50, egg 60, Goron spice 60, acorn 20, chickaloo nut 10, star fragment 60,
dragon scale 60 / claw 180 / fang shard 600 / horn shard 1800. Honey and monster extract have 0.

## 7. Elixirs

* Need at least one critter (`CookInsect`) **and** one monster part (`CookEnemy`)
  (recipe prio 4). The fairy is not a critter.
* Monster parts contribute no HP and no effect. They add `timeBoost × count`
  seconds and their `critChance`.
* Food ingredients may be added. Their HP (×2) counts, and their effect must be the
  same as the critters' or be absent. Otherwise the effects cancel → Dubious Food.
* Critters with HP: Hearty Lizard 16, Tireless Frog 8 (raw quarters, ×2 in the dish).
* An elixir whose total effect is empty → Dubious Food.

## 8. Dubious Food / Rock-Hard Food

* **Dubious Food**: `life = max(4, Σ(hp × count))`. The HP is **not doubled**, minimum
  1 heart. No effect, no crit, no spice or recipe bonuses. Sell price 2.
* **Rock-Hard Food**: `life = 1` (a quarter heart). No effect. Sell price 2.

## 9. Critical cook ("boost")

Runs after step 3 and only for non-failed dishes. It does **not** run when Monster
Extract is present (§10).

Chance (when the random boost is enabled, i.e. normal pot cooking):

```
threshold = max(critChance over entries) + NMSSR[distinctCount-1]   ; NMSSR = [5,10,15,20,25]
crit if rand(0..99) < threshold
```

* `distinctCount` is the number of **distinct** ingredients (per the decomp, see SOURCES).
* critChance: dragon parts and star fragment 100 (guaranteed). Cane sugar and monster guts-class 30.
  Egg, butter, Goron spice and fang-class parts 10. Everything else 0.
* **Blood moon**: a crit is guaranteed while the blood moon is active (roughly 23:30–00:15 on a
  Blood Moon night), per ZeldaMods research.

Bonus chosen on a crit. Checks use the values at this point, before spice and recipe bonuses:

| dish | bonus |
|---|---|
| no effect | +12 HP (3 hearts) |
| hearty | +4 hearty (1 yellow heart) |
| energizing / enduring | if vit already ≥ Ma → +12 HP; else if HP ≥ 120 → +2 vit; else 50/50 between +12 HP and +2 vit |
| timed effects | `vitMaxed = max(1,int(vit)) ≥ Ma`, `hpMaxed = life ≥ 120`. Neither maxed: 1/3 each of +12 HP, +1 level, +300 s. Only the level maxed: 50/50 +300 s / +12 HP. Only HP maxed: 50/50 +300 s / +1 level. Both maxed: +300 s |

"+vit" means `vit = int(vit) + SSA` (vit between 0 and 1 is first raised to 1). The cap
is applied later in step 12.

For an optimiser: with a guaranteed crit (dragon part / star fragment / blood moon) and a
timed effect, the bonus is random unless two of the three options are already
maxed. Present the possible outcomes, or treat them as an expected value.

## 10. Monster Extract

If any entry is Monster Extract (`Item_Material_08`), the normal crit is replaced by
this randomisation (the extract itself has 0 HP, no effect and no time):

```
min = 2 if (life <= 0 or effect == hearty) else 0
max = 2 if effect == None else 4
r   = randint in [min, max)        ; with min == max the result is min
r=0: life += 12       r=1: life = 1 (quarter heart)
r=2: if effect: vit = int(vit) + SSA[effect]
r=3: if effect: vit = Mi[effect]  (1; hearty 4)
if time >= 1: time = one of {60, 600, 1800} uniformly
```

The named dishes (Monster Curry/Rice Balls/Cake/Soup/Stew) need the specific
recipes in §A. Any other combination with extract makes the normal dish with this randomisation.

## 11. Spice step and recipe step (after the crit)

* For each **distinct** entry that has tag `CookSpice` and not `CookEnemy`:
  `life += hpBoost` and `time += timeBoost`. This happens even if the dish has no timed
  effect. The time is then meaningless and should not be displayed.
* `life += recipe.HB`.

## 12. Final adjustment (`cookAdjustItem`)

```
life = trunc(life); life = clamp(life, 0, 120)
if effect == None: if life == 0: life = 1
else:
  if 0 < vit < 1: vit = 1
  v = min(trunc(vit), Ma[effect])
  if energizing: v *= 200
  if hearty: v = roundUpTo4(v); v = max(v, 4); life = v
time = clamp(time, 0, 1800)
```

Sell price (`cookCalcItemPrice`, optional):

```
if Fairy Tonic or Dubious/Rock-Hard: price = 2
n = Σ counts of items that have a sell price (or CookLowPrice)
sell = Σ (CookLowPrice ? 1 : sellPrice) × count
cap  = Σ (CookLowPrice ? 1 : buyPrice) × count
price = trunc(NMMR[n-1] × sell)          ; NMMR = [1.5, 1.8, 2.1, 2.4, 2.8] (float32)
if price % 10: price += 10 - price % 10  ; round UP to a multiple of 10
price = max(min(price, cap), 2)
```

(CookLowPrice items are the dragon parts and star fragment. Check: 5 Endura Carrots → 30×5×2.8 = 420 rupees, which matches published values.)

---

## 13. Special ingredients summary

| item | behaviour |
|---|---|
| Fairy | Raw HP 20. In a meal, +40 quarters (10 hearts), no effect. With a critter, monster part or ore → Fairy Tonic: `2×ΣHP − 12`, **all effects removed**. A Fairy alone = 28 quarters (7 hearts). |
| Star Fragment | CookSpice. 0 HP, no effect. +60 s once, guaranteed crit. Alone → Dubious Food. |
| Dragon scale / claw / fang shard / horn shard | CookSpice. +5/8/10/15 quarter hearts and +60/180/600/1800 s, once per distinct part. Guaranteed crit. Alone → Dubious Food. |
| Monster Extract | CookSpice. Replaces the crit with randomisation (§10). |
| Salt, sugar, butter, Goron spice, rice, wheat, milk, egg, nuts | CookSpice. HP (×2) as normal, plus timeBoost once and hpBoost once (nuts only). They don't count as the "single ingredient" (§2). |
| Courser Bee Honey | CookSpice with energizing level 2 and HP 8. Alone → Honey Candy (HB −8). |
| Monster parts | No HP, no effect. Time bonus per item, crit chance. Only valid in elixirs (with a critter) or a Fairy Tonic. |
| Ores, gems, flint, wood | → Rock-Hard Food (unless a Fairy is present → Fairy Tonic). |

---

## 14. Worked examples (unit tests)

Produced with a reference implementation that follows the decomp line by line
(scratch code, not shipped). Rows marked ✔ match an expectation in
SGrondin/botwr's test suite. ✔✔ means botwr marks that case "Tested in game".
Crits are forced where noted. `life` is in quarter hearts, `time` in seconds, and `vit` is
level / energizing×200 / enduring units / hearty quarters.

| # | ingredients (ids) | crit | result | effect | vit | life | time | check |
|---|---|---|---|---|---|---|---|---|
| 1 | apple | – | Simmered Fruit | – | – | 4 | – | |
| 2 | apple ×5 | – | Simmered Fruit | – | – | 20 | – | |
| 3 | raw-gourmet-meat ×5 | – | Meat Skewer | – | – | 120 (cap) | – | |
| 4 | hearty-durian ×5 | – | Simmered Fruit | hearty | 80 | 80 | – | |
| 5 | big-hearty-radish ×5 | – | Fried Wild Greens | hearty | 100 (25 ♥) | 100 | – | |
| 6 | big-hearty-radish | – | Fried Wild Greens | hearty | 20 | 20 | – | ✔ |
| 7 | hearty-truffle ×3 | – | Mushroom Skewer | hearty | 12 | 12 | – | |
| 8 | stamella-shroom ×3 | – | Mushroom Skewer | energizing | 800 (4/5) | 12 | – | ✔ |
| 9 | staminoka-bass ×3, stamella-shroom | – | Fish and Mushroom Skewer | energizing | 3000 (cap 15) | 28 | – | ✔ HP. botwr doesn't cap at 15 (18) |
| 10 | endura-shroom | – | Mushroom Skewer | enduring | 1 | 8 | – | ✔ |
| 11 | endura-carrot ×5 | – | Fried Wild Greens | enduring | 10 (2 wheels) | 80 | – | |
| 12 | spicy-pepper | – | Sautéed Peppers | spicy | 1 | 4 | 150 | |
| 13 | spicy-pepper ×5 | – | Sautéed Peppers | spicy | 1 | 20 | 750 | |
| 14 | sunshroom ×3 | – | Mushroom Skewer | spicy | 2 | 12 | 450 | |
| 15 | voltfruit, electric-safflina ×2 | – | Steamed Fruit | electro | 1 | 4 | 450 | ✔ |
| 16 | zapshroom ×3 | – | Mushroom Skewer | electro | 3 | 12 | 450 | |
| 17 | mighty-thistle ×5 | – | Fried Wild Greens | mighty | 2 | 0 | 250 | |
| 18 | mighty-porgy ×3 | – | Fish Skewer | mighty | 3 | 24 | 150 | |
| 19 | armored-porgy ×5 | – | Fish Skewer | tough | 3 | 40 | 250 | |
| 20 | silent-princess ×3 | – | Fried Wild Greens | sneaky | 3 | 24 | 360 | |
| 21 | rushroom ×2, swift-carrot | – | Steamed Mushrooms | hasty | 1 | 12 | 180 | ✔✔ |
| 22 | bird-egg, blue-nightshade | – | Omelet | sneaky | 1 | 8 | 210 | ✔✔ |
| 23 | goron-spice, voltfin-trout ×2, bird-egg ×2 | – | Fish Skewer | electro | 3 | 32 | 510 | ✔ |
| 24 | hydromelon ×2, chillshroom ×3 | – | Fruit and Mushroom Mix | chilly | 2 | 20 | 750 | ✔✔ |
| 25 | chillshroom, spicy-pepper | – | Fruit and Mushroom Mix | – (cancel) | – | 8 | – | |
| 26 | endura-shroom ×2, big-hearty-radish | – | Steamed Mushrooms | – (cancel) | – | 48 | – | ✔ |
| 27 | moblin-fang, bladed-rhino-beetle ×3 | – | Elixir | mighty | 1 | 0 | 260 | ✔ |
| 28 | fireproof-lizard, smotherwing-butterfly ×3, bokoblin-guts | – | Elixir | fireproof | 2 | 0 | 790 | |
| 29 | hearty-lizard, bokoblin-horn, apple | – | Elixir | hearty | 16 | 16 | – | |
| 30 | hearty-lizard, bokoblin-horn, spicy-pepper | – | Dubious Food | – | – | 18 | – | |
| 31 | voltfruit, electric-safflina ×2, thunderwing-butterfly | – | Dubious Food | – | – | 4 | – | ✔ |
| 32 | apple, bokoblin-horn | – | Dubious Food | – | – | 4 | – | |
| 33 | raw-meat, hightail-lizard | – | Dubious Food | – | – | 4 | – | |
| 34 | bokoblin-horn / hightail-lizard / rock-salt / hylian-rice (alone) | – | Dubious Food | – | – | 4 | – | |
| 35 | apple, flint | – | Rock-Hard Food | – | – | 1 | – | |
| 36 | fairy | – | Fairy Tonic | – | – | 28 | – | ✔ |
| 37 | fairy ×2 | – | Fairy Tonic | – | – | 68 | – | ✔ |
| 38 | hearty-lizard, fairy | – | Fairy Tonic | – (removed) | – | 60 | – | botwr expects hearty 4 (not in-game tested); see SOURCES |
| 39 | fairy, moblin-guts ×2, sunset-firefly | – | Fairy Tonic | – | – | 28 | – | ✔✔ |
| 40 | fairy, sneaky-river-snail, silent-princess ×3 | – | Steamed Fish | sneaky | 3 | 72 | 510 | ✔✔ |
| 41 | courser-bee-honey | – | Honey Candy | energizing | 400 | 8 | – | |
| 42 | fresh-milk | – | Milk | – | – | 6 | – | |
| 43 | acorn ×2, apple | – | Simmered Fruit | – | – | 10 | – | botwr would give 12 (per-item nut bonus) |
| 44 | wildberry, tabantha-wheat, fresh-milk, bird-egg, cane-sugar | – | Wildberry Crepe | – | – | 40 | – | |
| 45 | raw-gourmet-meat, star-fragment | hearts | Meat Skewer | – | – | 36 | – | ✔ |
| 46 | hearty-radish, star-fragment | vit | Fried Wild Greens | hearty | 16 | 16 | – | ✔ |
| 47 | chillshroom, star-fragment | vit | Mushroom Skewer | chilly | 2 | 4 | 240 | botwr: 180 (no +60 star time) |
| 48 | chillshroom, star-fragment | time | Mushroom Skewer | chilly | 1 | 4 | 540 | |
| 49 | chillshroom, star-fragment | hearts | Mushroom Skewer | chilly | 1 | 16 | 240 | |
| 50 | stamella-shroom, dinraals-scale | vit | Mushroom Skewer | energizing | 600 | 9 | – | |
| 51 | stamella-shroom, dinraals-scale | hearts | Mushroom Skewer | energizing | 200 | 21 | – | |
| 52 | spicy-pepper, shard-of-dinraals-horn | time | Simmered Fruit | spicy | 1 | 19 | 1800 (cap) | |
| 53 | mighty-porgy ×3, raw-gourmet-meat ×2 | time | Gourmet Meat and Seafood Fry | mighty | 3 | 72 | 510 | level is maxed, so the crit is time or hearts only |
| 54 | apple ×2 | hearts | Simmered Fruit | – | – | 20 | – | |

Crit probabilities for tests: #1 has 5 % (1 distinct), #23 has 10 + 15 = 25 % (3 distinct), #28 has 30 + 15 = 45 %.

---

## A. Full recipe table (`CookData.byml`, in match order)

Ids refer to `ingredients.json`. `#Tag` is an actor tag. `/` separates
alternatives within one slot, and `+` separates slots, each filled by a different
distinct ingredient. The unresolved hash `0x00bed71d` appears only as an alternative next to
`#CookPlant`. No BotW ingredient carries it, so it can be ignored.


### Recipes

| # | Result (EN / DE) | internal | HB | required slots (each slot needs its own distinct ingredient) |
|---|---|---|---|---|
| 0 | Fairy Tonic / Feenwasser | Item_Cook_C_16 | -12 | [fairy] + [#CookOre] + [#CookInsect] + [#CookEnemy] |
| 1 | Fairy Tonic / Feenwasser | Item_Cook_C_16 | -12 | [fairy] + [#CookInsect] + [#CookEnemy] |
| 2 | Fairy Tonic / Feenwasser | Item_Cook_C_16 | -12 | [fairy] + [#CookOre / #CookEnemy / #CookInsect] |
| 3 | Rock-Hard Food / Harter Brocken | Item_Cook_O_02 |  | [#CookOre] |
| 4 | Elixir / Medizin | Item_Cook_C_17 |  | [#CookEnemy] + [#CookInsect] |
| 5 | Dubious Food / Dubiose Matsche | Item_Cook_O_01 |  | [#CookEnemy / #CookInsect] |
| 6 | Fruitcake / Obsttorte | Item_Cook_N_02 | 4 | [apple / wildberry] + [wildberry / voltfruit / hydromelon / mighty-bananas / hearty-durian / palm-fruit / apple] + [tabantha-wheat] + [cane-sugar] |
| 7 | Seafood Paella / Paella | Item_Cook_N_01 | 8 | [mighty-porgy / armored-porgy] + [hearty-blueshell-snail] + [hylian-rice] + [goat-butter] + [rock-salt] |
| 8 | Monster Curry / Monstercurry | Item_Cook_L_05 |  | [hylian-rice] + [goron-spice] + [monster-extract] |
| 9 | Monster Rice Balls / Monster-Reisbällchen | Item_Cook_L_04 |  | [hylian-rice] + [rock-salt] + [monster-extract] |
| 10 | Monster Cake / Monsterkuchen | Item_Cook_L_03 |  | [tabantha-wheat] + [cane-sugar] + [monster-extract] + [goat-butter] |
| 11 | Monster Soup / Monstersuppe | Item_Cook_L_02 |  | [tabantha-wheat] + [goat-butter] + [fresh-milk] + [monster-extract] |
| 12 | Monster Stew / Monstereintopf | Item_Cook_L_01 |  | [monster-extract] + [#CookMeat] + [#CookFish] |
| 13 | Creamy Heart Soup / Herzchensuppe | Item_Cook_F_04 |  | [hearty-radish / big-hearty-radish] + [voltfruit] + [hydromelon] + [fresh-milk] |
| 14 | Clam Chowder / Muschelsuppe | Item_Cook_K_04 |  | [hearty-blueshell-snail] + [tabantha-wheat] + [fresh-milk] + [goat-butter] |
| 15 | Pumpkin Stew / Kürbiseintopf | Item_Cook_K_03 |  | [fortified-pumpkin] + [tabantha-wheat] + [fresh-milk] + [goat-butter] |
| 16 | Gourmet Meat Stew / Luxuseintopf | Item_Cook_K_05 |  | [raw-gourmet-meat / raw-whole-bird] + [tabantha-wheat] + [fresh-milk] + [goat-butter] |
| 17 | Prime Meat Stew / Edeleintopf | Item_Cook_K_02 |  | [raw-prime-meat / raw-bird-thigh] + [tabantha-wheat] + [fresh-milk] + [goat-butter] |
| 18 | Meat Stew / Fleischeintopf | Item_Cook_K_01 |  | [raw-meat / raw-bird-drumstick] + [tabantha-wheat] + [fresh-milk] + [goat-butter] |
| 19 | Gourmet Meat Curry / Luxuswildcurry | Item_Cook_J_09 |  | [raw-gourmet-meat] + [hylian-rice] + [goron-spice] |
| 20 | Gourmet Poultry Curry / Luxusgeflügelcurry | Item_Cook_J_08 |  | [raw-whole-bird] + [hylian-rice] + [goron-spice] |
| 21 | Prime Meat Curry / Edelwildcurry | Item_Cook_J_07 |  | [raw-prime-meat] + [hylian-rice] + [goron-spice] |
| 22 | Prime Poultry Curry / Edelgeflügelcurry | Item_Cook_J_05 |  | [raw-bird-thigh] + [hylian-rice] + [goron-spice] |
| 23 | Meat Curry / Wildcurry | Item_Cook_J_06 |  | [raw-meat] + [hylian-rice] + [goron-spice] |
| 24 | Poultry Curry / Geflügelcurry | Item_Cook_J_04 |  | [raw-bird-drumstick] + [hylian-rice] + [goron-spice] |
| 25 | Seafood Curry / Fischcurry | Item_Cook_J_03 |  | [hearty-blueshell-snail / mighty-porgy / armored-porgy] + [hylian-rice] + [goron-spice] |
| 26 | Vegetable Curry / Gemüsecurry | Item_Cook_J_02 |  | [fortified-pumpkin / swift-carrot / endura-carrot] + [hylian-rice] + [goron-spice] |
| 27 | Pumpkin Pie / Kürbiskuchen | Item_Cook_I_06 |  | [fortified-pumpkin] + [tabantha-wheat] + [cane-sugar] + [goat-butter] |
| 28 | Carrot Cake / Karottenkuchen | Item_Cook_I_05 |  | [swift-carrot / endura-carrot] + [tabantha-wheat] + [cane-sugar] + [goat-butter] |
| 29 | Wildberry Crepe / Wildbeeren-Crêpe | Item_Cook_I_11 | 16 | [tabantha-wheat] + [fresh-milk] + [bird-egg] + [cane-sugar] + [wildberry] |
| 30 | Honey Crepe / Honig-Crêpe | Item_Cook_I_17 | 4 | [tabantha-wheat] + [fresh-milk] + [bird-egg] + [cane-sugar] + [courser-bee-honey] |
| 31 | Plain Crepe / Crêpe | Item_Cook_I_10 |  | [tabantha-wheat] + [fresh-milk] + [bird-egg] + [cane-sugar] |
| 32 | Apple Pie / Apfelkuchen | Item_Cook_I_02 |  | [apple] + [tabantha-wheat] + [goat-butter] + [cane-sugar] |
| 33 | Nutcake / Nusskuchen | Item_Cook_I_12 |  | [tabantha-wheat] + [goat-butter] + [cane-sugar] + [chickaloo-tree-nut / acorn] |
| 34 | Egg Tart / Eiertorte | Item_Cook_I_03 |  | [bird-egg] + [tabantha-wheat] + [goat-butter] + [cane-sugar] |
| 35 | Egg Pudding / Eierpudding | Item_Cook_I_14 |  | [bird-egg] + [fresh-milk] + [cane-sugar] |
| 36 | Fried Bananas / Bratbanane | Item_Cook_I_13 |  | [mighty-bananas] + [tabantha-wheat] + [cane-sugar] |
| 37 | Fruit Pie / Obstkuchen | Item_Cook_I_01 |  | [tabantha-wheat] + [goat-butter] + [cane-sugar] + [#CookFruit] |
| 38 | Meat Pie / Fleischpastete | Item_Cook_I_04 |  | [tabantha-wheat] + [goat-butter] + [rock-salt] + [#CookMeat] |
| 39 | Fish Pie / Fischpastete | Item_Cook_I_15 |  | [tabantha-wheat] + [goat-butter] + [rock-salt] + [#CookFish] |
| 40 | Salmon Meunière / Knusperlachs | Item_Cook_H_03 |  | [hearty-salmon] + [goat-butter] + [tabantha-wheat] |
| 41 | Salmon Risotto / Lachsrisotto | Item_Cook_G_14 |  | [hearty-salmon] + [hylian-rice] + [rock-salt] + [goat-butter] |
| 42 | Crab Risotto / Krabbenrisotto | Item_Cook_G_17 |  | [razorclaw-crab / ironshell-crab / bright-eyed-crab] + [hylian-rice] + [rock-salt] + [goat-butter] |
| 43 | Vegetable Risotto / Gemüserisotto | Item_Cook_G_13 |  | [fortified-pumpkin / swift-carrot / endura-carrot] + [hylian-rice] + [rock-salt] + [goat-butter] |
| 44 | Mushroom Risotto / Pilzrisotto | Item_Cook_G_12 |  | [hylian-rice] + [rock-salt] + [goat-butter] + [#CookMushroom] |
| 45 | Cream of Mushroom Soup / Pilzcremesuppe | Item_Cook_K_06 |  | [rock-salt] + [fresh-milk] + [#CookMushroom] + [#<unresolved 0x00bed71d> / #CookPlant] |
| 46 | Veggie Cream Soup / Gemüsecremesuppe | Item_Cook_F_03 |  | [fortified-pumpkin / swift-carrot / endura-carrot] + [rock-salt] + [fresh-milk] |
| 47 | Creamy Meat Soup / Fleischsuppe | Item_Cook_F_01 |  | [rock-salt] + [fresh-milk] + [#CookMeat] + [#<unresolved 0x00bed71d> / #CookPlant] |
| 48 | Creamy Seafood Soup / Fischsuppe | Item_Cook_F_02 |  | [rock-salt] + [fresh-milk] + [#CookFish] + [#<unresolved 0x00bed71d> / #CookPlant] |
| 49 | Cream of Vegetable Soup / Gemüsesuppe | Item_Cook_K_07 |  | [rock-salt] + [fresh-milk] + [#<unresolved 0x00bed71d> / #CookPlant] |
| 50 | Carrot Stew / Karotteneintopf | Item_Cook_K_08 |  | [swift-carrot / endura-carrot] + [goat-butter] + [fresh-milk] + [tabantha-wheat] |
| 51 | Mushroom Omelet / Pilzomelett | Item_Cook_N_04 |  | [bird-egg] + [rock-salt] + [goat-butter] + [#CookMushroom] |
| 52 | Crab Omelet with Rice / Krabbenreis | Item_Cook_G_16 |  | [razorclaw-crab / ironshell-crab / bright-eyed-crab] + [bird-egg] + [hylian-rice] + [rock-salt] |
| 53 | Gourmet Poultry Pilaf / Luxusgeflügel-Pilaw | Item_Cook_E_03 |  | [raw-whole-bird] + [bird-egg] + [hylian-rice] + [goat-butter] |
| 54 | Prime Poultry Pilaf / Edelgeflügel-Pilaw | Item_Cook_E_02 |  | [raw-bird-thigh] + [bird-egg] + [hylian-rice] + [goat-butter] |
| 55 | Poultry Pilaf / Geflügel-Pilaw | Item_Cook_E_01 |  | [raw-bird-drumstick] + [bird-egg] + [hylian-rice] + [goat-butter] |
| 56 | Vegetable Omelet / Gemüseomelett | Item_Cook_N_03 |  | [bird-egg] + [goat-butter] + [rock-salt] + [#<unresolved 0x00bed71d> / #CookPlant] |
| 57 | Porgy Meunière / Knusperschnapper | Item_Cook_H_02 |  | [mighty-porgy / armored-porgy] + [goat-butter] + [tabantha-wheat] |
| 58 | Seafood Meunière / Knusperfisch | Item_Cook_H_01 |  | [goat-butter] + [tabantha-wheat] + [#CookFish] |
| 59 | Seafood Fried Rice / Meeresfrüchtereis | Item_Cook_G_10 |  | [hearty-blueshell-snail / mighty-porgy / armored-porgy] + [hylian-rice] + [rock-salt] |
| 60 | Curry Pilaf / Curry-Pilaw | Item_Cook_G_11 |  | [goron-spice] + [hylian-rice] + [goat-butter] |
| 61 | Gourmet Meat and Rice Bowl / Luxuswild-Reis | Item_Cook_G_09 |  | [raw-gourmet-meat] + [hylian-rice] + [rock-salt] |
| 62 | Prime Meat and Rice Bowl / Edelwild-Reis | Item_Cook_G_06 |  | [raw-prime-meat] + [hylian-rice] + [rock-salt] |
| 63 | Meat and Rice Bowl / Wild-Reis | Item_Cook_G_05 |  | [raw-meat] + [hylian-rice] + [rock-salt] |
| 64 | Fried Egg and Rice / Spiegelei mit Reis | Item_Cook_E_04 |  | [hylian-rice] + [bird-egg] |
| 65 | Meaty Rice Balls / Fleisch-Reisbällchen | Item_Cook_G_15 |  | [hylian-rice] + [#CookMeat] |
| 66 | Seafood Rice Balls / Fischreisbällchen | Item_Cook_G_02 |  | [hylian-rice] + [#CookFish] |
| 67 | Mushroom Rice Balls / Pilz-Reisbällchen | Item_Cook_G_04 |  | [hylian-rice] + [#CookMushroom] |
| 68 | Veggie Rice Balls / Kräuter-Reisbällchen | Item_Cook_G_03 |  | [hylian-rice] + [#CookPlant / #<unresolved 0x00bed71d>] |
| 69 | Hot Buttered Apple / Butterapfel | Item_Cook_I_07 | 4 | [apple] + [goat-butter] |
| 70 | Meat-Stuffed Pumpkin / Fleischkürbis | Item_Cook_B_20 |  | [fortified-pumpkin] + [#CookMeat] |
| 71 | Glazed Meat / Festtagsgulasch | Item_Cook_A_12 |  | [courser-bee-honey] + [#CookMeat] |
| 72 | Glazed Seafood / Festtagsfisch | Item_Cook_A_13 |  | [courser-bee-honey] + [#CookFish] |
| 73 | Glazed Mushrooms / Festtagspilze | Item_Cook_A_11 |  | [courser-bee-honey] + [#CookMushroom] |
| 74 | Glazed Veggies / Festtagsgemüse | Item_Cook_A_14 |  | [courser-bee-honey] + [#CookPlant / #<unresolved 0x00bed71d>] |
| 75 | Curry Rice / Curryreis | Item_Cook_J_01 |  | [hylian-rice] + [goron-spice] |
| 76 | Honeyed Apple / Honigapfel | Item_Cook_I_08 |  | [apple] + [courser-bee-honey] |
| 77 | Honeyed Fruits / Honigobst | Item_Cook_I_09 |  | [courser-bee-honey] + [#CookFruit] |
| 78 | Gourmet Spiced Meat Skewer / Luxuswild-Schaschlik | Item_Cook_P_05 |  | [raw-gourmet-meat] + [goron-spice] |
| 79 | Prime Spiced Meat Skewer / Edelwild-Schaschlik | Item_Cook_P_04 |  | [raw-prime-meat] + [goron-spice] |
| 80 | Spiced Meat Skewer / Wild-Schaschlik | Item_Cook_P_03 |  | [raw-meat] + [goron-spice] |
| 81 | Fragrant Mushroom Sauté / Duftpilzpfanne | Item_Cook_P_01 |  | [goron-spice] + [#CookMushroom] |
| 82 | Herb Sauté / Kräuterpfanne | Item_Cook_P_02 |  | [goron-spice] + [#CookPlant / #<unresolved 0x00bed71d>] |
| 83 | Salt-Grilled Gourmet Meat / Luxusschmorbraten | Item_Cook_D_06 |  | [raw-gourmet-meat / raw-whole-bird] + [rock-salt] |
| 84 | Salt-Grilled Prime Meat / Edelschmorbraten | Item_Cook_D_05 |  | [raw-bird-thigh / raw-prime-meat] + [rock-salt] |
| 85 | Salt-Grilled Meat / Schmorbraten | Item_Cook_D_04 |  | [raw-meat / raw-bird-drumstick] + [rock-salt] |
| 86 | Crab Stir-Fry / Krabbenpfanne | Item_Cook_D_10 |  | [razorclaw-crab / ironshell-crab / bright-eyed-crab] + [goron-spice] |
| 87 | Salt-Grilled Crab / Schmorkrabbe | Item_Cook_D_09 |  | [razorclaw-crab / ironshell-crab / bright-eyed-crab] + [rock-salt] |
| 88 | Salt-Grilled Fish / Schmorfisch | Item_Cook_D_03 |  | [rock-salt] + [#CookFish] |
| 89 | Wheat Bread / Weizenbrot | Item_Cook_M_01 |  | [tabantha-wheat] + [rock-salt] |
| 90 | Salt-Grilled Greens / Schmorgemüse | Item_Cook_D_02 |  | [rock-salt] + [#<unresolved 0x00bed71d> / #CookPlant] |
| 91 | Salt-Grilled Mushrooms / Schmorpilze | Item_Cook_D_01 |  | [rock-salt] + [#CookMushroom] |
| 92 | Copious Meat Skewers / Riesenfleischspieße | Item_Cook_B_16 |  | [#CookMeat] + [#CookMeat] + [#CookMeat] + [#CookMeat] |
| 93 | Copious Fried Wild Greens / Wildgemüse-Schmaus | Item_Cook_B_11 |  | [#<unresolved 0x00bed71d> / #CookPlant] + [#<unresolved 0x00bed71d> / #CookPlant] + [#<unresolved 0x00bed71d> / #CookPlant] + [#<unresolved 0x00bed71d> / #CookPlant] |
| 94 | Copious Simmered Fruit / Kochobst-Schmaus | Item_Cook_B_12 |  | [#CookFruit] + [#CookFruit] + [#CookFruit] + [#CookFruit] |
| 95 | Copious Mushroom Skewers / Pilzspießteller | Item_Cook_B_13 |  | [#CookMushroom] + [#CookMushroom] + [#CookMushroom] + [#CookMushroom] |
| 96 | Copious Seafood Skewers / Riesenfischspieße | Item_Cook_B_15 |  | [#CookFish] + [#CookFish] + [#CookFish] + [#CookFish] |
| 97 | Meat Skewer / Fleischspieß | Item_Cook_B_06 |  | [#CookMeat] + [#CookMeat] |
| 98 | Simmered Fruit / Kochobst | Item_Cook_B_02 |  | [#CookFruit] + [#CookFruit] |
| 99 | Mushroom Skewer / Pilzspieß | Item_Cook_A_01 |  | [#CookMushroom] + [#CookMushroom] |
| 100 | Fried Wild Greens / Wildgemüse | Item_Cook_B_01 |  | [#<unresolved 0x00bed71d> / #CookPlant] + [#<unresolved 0x00bed71d> / #CookPlant] |
| 101 | Gourmet Meat and Seafood Fry / Luxusgrillteller | Item_Cook_B_19 |  | [raw-gourmet-meat / raw-whole-bird] + [#CookFish] |
| 102 | Prime Meat and Seafood Fry / Edelgrillteller | Item_Cook_B_18 |  | [raw-prime-meat / raw-bird-thigh] + [#CookFish] |
| 103 | Meat and Seafood Fry / Grillteller | Item_Cook_B_17 |  | [#CookMeat] + [#CookFish] |
| 104 | Pepper Steak / Chili-Fleisch | Item_Cook_D_07 |  | [spicy-pepper] + [#CookMeat] |
| 105 | Pepper Seafood / Chili-Fisch | Item_Cook_D_08 |  | [spicy-pepper] + [#CookFish] |
| 106 | Seafood Skewer / Meeresfrüchtespieß | Item_Cook_B_23 |  | [hearty-blueshell-snail / sneaky-river-snail / razorclaw-crab / ironshell-crab / bright-eyed-crab] + [#CookFish] |
| 107 | Fish Skewer / Fischspieß | Item_Cook_B_05 |  | [#CookFish] + [#CookFish] |
| 108 | Steamed Meat / Dampffleisch | Item_Cook_A_05 |  | [#CookPlant / #<unresolved 0x00bed71d>] + [#CookMeat] |
| 109 | Steamed Fish / Dampffisch | Item_Cook_A_04 |  | [#CookPlant / #<unresolved 0x00bed71d>] + [#CookFish] |
| 110 | Steamed Mushrooms / Dampfpilze | Item_Cook_A_02 |  | [#CookPlant / #<unresolved 0x00bed71d>] + [#CookMushroom] |
| 111 | Steamed Fruit / Dampfobst | Item_Cook_A_03 |  | [#CookPlant / #<unresolved 0x00bed71d>] + [#CookFruit] |
| 112 | Fish and Mushroom Skewer / Fischspieß mit Pilzen | Item_Cook_A_08 |  | [#CookMushroom] + [#CookFish] |
| 113 | Meat and Mushroom Skewer / Fleischspieß mit Pilzen | Item_Cook_A_09 |  | [#CookMushroom] + [#CookMeat] |
| 114 | Fruit and Mushroom Mix / Obst mit Pilzen | Item_Cook_A_07 |  | [#CookMushroom] + [#CookFruit] |
| 115 | Meat Skewer / Fleischspieß | Item_Cook_B_06 |  | [#CookMeat] |
| 116 | Seafood Skewer / Meeresfrüchtespieß | Item_Cook_B_23 |  | [hearty-blueshell-snail / sneaky-river-snail / razorclaw-crab / ironshell-crab / bright-eyed-crab] |
| 117 | Fish Skewer / Fischspieß | Item_Cook_B_05 |  | [#CookFish] |
| 118 | Omelet / Omelett | Item_Cook_A_10 |  | [bird-egg] |
| 119 | Milk / Warme Milch | Item_Cook_K_09 |  | [fresh-milk] |
| 120 | Mushroom Skewer / Pilzspieß | Item_Cook_A_01 |  | [#CookMushroom] |
| 121 | Fried Wild Greens / Wildgemüse | Item_Cook_B_01 |  | [#CookPlant] |
| 122 | Simmered Fruit / Kochobst | Item_Cook_B_02 |  | [#CookFruit] |
| 123 | Sautéed Nuts / Röstnüsse | Item_Cook_B_22 |  | [acorn] + [chickaloo-tree-nut] |
| 124 | Fairy Tonic / Feenwasser | Item_Cook_C_16 | -12 | [fairy] |

### SingleRecipes

| # | Result (EN / DE) | internal | HB | required slots (each slot needs its own distinct ingredient) |
|---|---|---|---|---|
| 0 | Fairy Tonic / Feenwasser | Item_Cook_C_16 | -12 | one of: fairy |
| 1 | Rock-Hard Food / Harter Brocken | Item_Cook_O_02 |  | has tag: #CookOre |
| 2 | Sautéed Peppers / Bratchilis | Item_Cook_B_21 |  | one of: spicy-pepper |
| 3 | Omelet / Omelett | Item_Cook_A_10 |  | one of: bird-egg |
| 4 | Meat Skewer / Fleischspieß | Item_Cook_B_06 |  | has tag: #CookMeat |
| 5 | Seafood Skewer / Meeresfrüchtespieß | Item_Cook_B_23 |  | one of: hearty-blueshell-snail, sneaky-river-snail, razorclaw-crab, ironshell-crab, bright-eyed-crab |
| 6 | Fish Skewer / Fischspieß | Item_Cook_B_05 |  | has tag: #CookFish |
| 7 | Mushroom Skewer / Pilzspieß | Item_Cook_A_01 |  | has tag: #CookMushroom |
| 8 | Honey Candy / Honigbonbon | Item_Cook_I_16 | -8 | one of: courser-bee-honey |
| 9 | Sautéed Nuts / Röstnüsse | Item_Cook_B_22 | -2 | one of: acorn, chickaloo-tree-nut |
| 10 | Milk / Warme Milch | Item_Cook_K_09 | 2 | one of: fresh-milk |
| 11 | Fried Wild Greens / Wildgemüse | Item_Cook_B_01 |  | has tag: #CookPlant |
| 12 | Simmered Fruit / Kochobst | Item_Cook_B_02 |  | has tag: #CookFruit |
