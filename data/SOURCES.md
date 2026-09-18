# Sources for `ingredients.json` and `docs/cooking-rules.md`

Retrieved 2026-09-18. Game values are facts about the game (© Nintendo). They are recorded
here for a personal, non-commercial tool. No code from any source below was copied into this
project. The data was extracted with throwaway scripts, which are not part of the repo.

## 1. leoetlino/botw — game data dump (primary data source)

* https://github.com/leoetlino/botw, commit `f50b984f` (2021-07-09)
* **Licence: none.** The repo has no LICENSE file. It contains Nintendo's game files converted to YAML.
  We record facts from it and do not redistribute its files.
* Game version: not stated in the repo. The content matches Switch 1.5/1.6 (it includes DLC
  items and Master Mode data).
* Taken from it:
  * `Actor/ActorLink/<actor>.yml`: the list of cookable actors (tags `CookMaterial`,
    `CookEnemy`, `CookInsect`, `CookSpice`) and every `cookTags` value, plus `CookLowPrice`,
    `CureItem` and `CanUse`.
  * `Actor/GeneralParamList/*.gparamlist.yml`: `CureItem` (HitPointRecover, EffectType,
    EffectLevel, EffectiveTime), `CookSpice` (BoostHitPointRecover, BoostEffectiveTime,
    BoostSuccessRate, BoostMaxHeartLevel, BoostStaminaLevel) and `Item` (SellingPrice,
    BuyingPrice). These give `hp`, `effect`, `effectLevel`, `timeBoost`, `hpBoost`,
    `critChance`, `maxHeartBoost`, `staminaBoost`, `sellPrice`, `buyPrice` and `rawEatEffectTime`.
  * `Actor/ActorMeta/<actor>.yml`: `sortKey` (the ActorInfo-only value used by the
    inventory sort).
  * `Cooking/CookData.yml`: the `Recipes` / `SingleRecipes` lists (recipe table, HB bonuses)
    and `System` (CEI effect table BT/MR/Ma/Mi/SSA, FA/FALR/FALRMR dubious food, FCA fairy
    tonic, MEA monster extract, LRMR, SFALR, SSAET, NMMR, NMSSR). Hashes were resolved by
    CRC32 of the actor, tag and effect names.
  * `Message/Msg_EUde.product.sarc/ActorType/{Item,CapturedActor,PlayerItem,CookResult}.msyt`:
    **`nameDe`** and the German dish names. `Msg_USen` (same files): `nameEn`, and from it the `id`.

## 2. zeldaret/botw — decompilation (primary rules source)

* https://github.com/zeldaret/botw, commit `7c65472` (2026-07-30). The target is Switch v1.5.0.
* **Licence: none detected** (the GitHub licence API returned null). We only read it. The
  spec paraphrases the logic in prose and pseudo-code. No code was copied.
* Taken from it:
  * `src/Game/Cooking/cookManager.cpp`: the complete cooking algorithm. This covers recipe matching
    (multi before single, distinct-entry slot filling, spice exclusion), `cookCalcIngredientsBoost`,
    `cookCalcCritBoost` / `cookHandleCrit`, the monster-extract randomisation, `cookCalcSpiceBoost`,
    `cookAdjustItem` and `cookCalcItemPrice`.
  * `src/Game/UI/uiPauseMenuDataMgr.cpp` (`compareMaterial`, `sCookItemOrder_`): the Materials
    tab sort, which gives **`sortOrder`**.
  * sead `Random::getS32Range(a, b)` = `a + getU32(b − a)`, i.e. the range [a, b). This is used by the extract rules.

## 3. SGrondin/botwr (botwcooking.com) — cross-check only

* https://github.com/SGrondin/botwr, commit `e257b90` (2023-06-21)
* **Licence: none.** Per the user's instruction it was read only to cross-check numbers.
  **No code was copied.** The repo mixes BotW and TotK data (for example "Fix max_hearts for TOTK",
  and it has TotK items such as Oil Jar and Sticky Frog), so its numbers were compared only for BotW items.
* Used for: the expect-tests in `src/recipes/test.ml`. Eight of them are marked "Tested in game".
  A reference implementation of the decomp logic reproduces all 8 exactly, and those rows are ✔✔ in
  cooking-rules §14. Every other botwr expectation for a BotW item that was checked matches too,
  except the conflicts listed below.

## 4. ZeldaMods wiki — secondary

* https://zeldamods.org/wiki/Cooking and related pages. Wiki content; its licence was not
  checked, and nothing was copied.
* Used for: blood moon → guaranteed crit. That caller is not in the decomp's matched code yet.
* Conflict: the stub describes `NMMR` as level thresholds. The decomp uses `NMMR` only in
  the **sell-price** multiplier (by total ingredient count). Spec follows the decomp.

---

## Conflicts between sources (resolution: data/decomp wins)

| # | topic | botwr / wiki | data + decomp (used) |
|---|---|---|---|
| C1 | Spice `hpBoost` / `timeBoost` (acorn, chickaloo, rice, salt, egg, …) | per item (e.g. acorn ×2 + apple = 12 quarters) | **once per distinct ingredient** (`cookCalcSpiceBoost` loops over distinct entries): 10 quarters |
| C2 | Star fragment duration | no time bonus (chillshroom + star = 180 s) | star fragment has `BoostEffectiveTime` 60, so +60 s → 240 s |
| C3 | Fairy Tonic with effect ingredients | untested cases keep hearty (hearty lizard + fairy = hearty 4) | effects cancelled for Fairy Tonic → 60 quarters, no effect. botwr's in-game-tested case (fairy + guts ×2 + silent shroom + firefly = 32 HP, no effect) agrees with the decomp |
| C4 | Energizing cap | uncapped (staminoka ×3 + stamella = 18 units) | CEI Ma = 15 units (3 wheels) |
| C5 | Tough (DefenseUp) level thresholds | L3 at 9 | MR 0.45 as for mighty → L2 at 5, L3 at 7 |
| C6 | Enduring cap | +10 units | CEI Ma = 20 (4 extra wheels). The runtime stamina cap may clip this further (see U4) |
| C7 | `NMMR` | level thresholds (ZeldaMods) | sell-price multiplier |

## Uncertain / unverified values (open)

| # | what | status |
|---|---|---|
| U1 | **`sortOrder`** | Derived from the decomp comparator plus ActorMeta `sortKey`. Not checked against a real inventory. Least certain parts: the star fragment, monster extract and all dragon parts sort into the **spice** group (they carry `CookSpice`); the HP tiebreak uses the Master-Mode-adjusted HP rule (`CureItem`+`CanUse` only); and wood (Obj_FireWoodBundle) sorts last. Needs one look at a full Materials tab. |
| U2 | Blood moon guaranteed crit | ZeldaMods only. The caller that sets `always_boost` / `enable_random_boost` is not decompiled, so the exact time window and any other always-crit cases are unverified. |
| U3 | Crit chance uses the number of **distinct** ingredients for NMSSR | Reads that way in the decomp, but `cook()` / `cookHandleCrit` are still marked NON_MATCHING. |
| U4 | Enduring effect at Ma 20 | The game may clip extra stamina to the player's max (3 wheels total). Not verified how 4 extra wheels behave. |
| U5 | Hearty cap 108 (27 yellow hearts) in practice | Taken from CEI. The runtime heart limit is not checked. |
| U6 | Game version of the data dump | Unknown (Switch 1.5 or 1.6). Wii U values are assumed identical but that was not checked. The German names come from the Switch EUde messages. |
| U7 | Excluded actors | `Item_Enemy_Put_57` (placed-object duplicate of a monster part) and `Item_Mushroom_D` (unused Rushroom duplicate) were left out. Roasted/frozen items (`Item_Roast_*`, `Item_Chilled_*`) carry no `Cook*` tag at all, so the data confirms they are not cookable; they are excluded. The two duplicates above are the only judgement call. |
| U8 | Unresolved recipe tag hash `0x00bed71d` | Appears only as an alternative next to `#CookPlant`. No BotW actor carries it, so it has no effect on results. |
| U9 | `rare` flag | Not a game field. It is our own judgement: dragon parts, fairy and star fragment. Adjust freely. |
| U10 | Monster extract with a guaranteed crit (dragon part / star) | The decomp takes the extract path *instead of* the crit. Not verified in-game. |
| U11 | Rounding of `NMMR` × sell price | float32 multiply then truncation. Verified on one published value (5 Endura Carrots = 420). Edge cases are not verified. |

No numeric field in `ingredients.json` was invented. Fields are `null` only where the game data has no
value (`effectBaseTime` for items without an effect, `timeBoostScope` when `timeBoost` is 0,
`rawEatEffectTime` when the item has no CureItem effect time). `sellPrice`/`buyPrice` are present for all 149.
