# Household Meal Planner — Implementation Plan

Android app (Expo + React Native + TypeScript) for managing household recipes,
building reusable meal plans, scheduling them on a calendar, and generating a
pantry-checked shopping list organized by store and store area.

## Product decisions (confirmed)

- **Users:** two people (both phones) in one shared household. Google sign-in.
- **Sync:** data is stored in the cloud so it survives app close / phone reset and
  is shared between phones. Live (real-time) sync is **not** required; changes
  appear the next time a screen loads. The app must work offline in the store.
- **Cost:** free hosting (Firebase Spark, Cloudflare Workers free tier). The only
  paid piece is AI photo scanning: Claude API, roughly 2–3¢ per scanned recipe.
- **Recipes:** ingredients (amount, unit, ingredient, note) are essential.
  Steps are tracked elsewhere → optional free-text **Notes / source** field.
  Optional photo.
- **Tags:** Vegetarian, Chicken/Poultry, Fish, Beef, Pork, + custom.
- **Meal slots:** Breakfast, Lunch, Dinner. Dinner is primary; B/L are optional
  (collapsed by default, can be hidden in settings).
- **Pantry:** checked fresh at each shopping trip; no running inventory.
- **Units:** US by default.
- **Stores:** Macey's, Sam's Club, Costco, Walmart, Smith's — configurable
  (add, rename, reorder, hide), each with its own ordered store areas.
- **Week start:** Sunday by default (configurable).
- **Sharing a list:** "Share as text" via the Android share sheet.

## Meal plans and calendar

1. **Meal plan (reusable template):** a named plan with **N days** ("Day 1 … Day N",
   any length). Each day has optional B/L/D slots holding one or more recipes
   (with servings). Not tied to dates.
2. **Schedule onto the calendar (optional):** "Apply plan _X_ starting _date_,
   repeat _k_ times" copies the plan's days onto real dates. Each calendar day
   remembers which plan it came from, but is an independent copy, so she can
   tweak one Tuesday without changing the plan, and editing the plan later does
   not rewrite already-scheduled days. If target dates already have meals, she
   chooses Replace / Add / Skip.
3. **Calendar view:** week/agenda view of scheduled days; edit any day directly.
4. **Shopping list source:** either
   - a **date range on the calendar**, then un-check any days or individual
     meals to use a subset; or
   - a **plan directly** (not scheduled), selecting which days to include.

## Shopping list flow

1. Pick source (date range or plan days) → app aggregates ingredients across the
   selected meals, scaled by servings.
2. **Pantry check:** each needed item shows "need X, have [ _ ]"; items fully
   covered drop off.
3. **Final checklist:** grouped by **store → store area** (walking order),
   check-off persists, manual extra items, per-list store override, unassigned
   group, share as text.

Lists are **snapshots**: editing recipes later does not change an existing list.

### Aggregation rules (pure TS, heavily unit-tested)

- Same unit → add. Same dimension → convert (volume: tsp/tbsp/cup/fl oz/pt/qt/gal;
  weight: oz/lb). Different dimensions → separate lines.
- Count-style units (each, can, jar, package, bunch, clove, pinch) add within the
  same unit.
- Pantry "have" subtracts in the same unit; ≤ 0 removes the line.
- One shared amount/unit/ingredient-line parser is used by the recipe form,
  aggregation, and matching scanned ingredients to existing ones.

## Architecture

| Concern    | Choice                                                                                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App        | Expo (dev build) + TypeScript + `expo-router`; tabs: Recipes · Plans · Calendar · Shopping · Settings                                                                                                                                                                                           |
| Backend    | Firebase Spark (free): Auth (Google) + Firestore                                                                                                                                                                                                                                                |
| Offline    | `@react-native-firebase/firestore` (on-disk cache + queued writes)                                                                                                                                                                                                                              |
| Photos     | Resized (~600px, ~60 KB JPEG) stored in Firestore (`recipePhotos/{id}`); Firebase Storage is not free                                                                                                                                                                                           |
| Photo scan | AI: phone resizes photo(s) → Cloudflare Worker (free tier) verifies the Firebase ID token, holds the Anthropic API key, applies a per-user daily limit → Claude (`claude-opus-5-5`, image input + structured JSON output) → pre-filled recipe form for review; nothing saves without her review |
| Tests      | Jest + React Native Testing Library; Firebase Local Emulator Suite for rules tests and Maestro runs (emulator-only test sign-in); Maestro in `.maestro/`                                                                                                                                        |
| Release    | EAS Build → APK installed on both phones                                                                                                                                                                                                                                                        |

### Firestore layout

```
users/{uid}                  householdId
invites/{code}               householdId, createdBy, createdAt   (get-only; 8-char code)
households/{hid}             name, memberIds[], inviteCode, settings{weekStart, showBreakfastLunch}
  stores/{id}                name, order, hidden, sections[{id, name, order}]
  ingredients/{id}           name, nameLower, defaultUnit, storeId, sectionId
  tags/{id}                  name
  recipes/{id}               name, servings, tagIds[], notes, hasPhoto,
                             ingredients[{ingredientId, name, qty, unit, note}]
  recipePhotos/{recipeId}    jpegBase64
  mealPlans/{id}             name, dayCount, days[{index, label?, meals{B[], L[], D[]}}]
                               meal = {recipeId, servings}
  calendarDays/{yyyy-mm-dd}  meals{B[], L[], D[]}, sourcePlanId?, sourceDayIndex?
  shoppingLists/{id}         name, source{type: dates|plan, ...}, status: draft|final,
                             createdAt, items[{ingredientId?, name, needed, have, buy,
                             unit, storeId, sectionId, checked, isManual}]
```

`google-services.json` and other Firebase config stay out of git.

## Milestones

Each follows the feature loop in `CLAUDE.md`.

| #   | Milestone                                                                                                 | Done when                                                       |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 0   | Scaffold: git, Expo TS + expo-router, lint/format/typecheck/Jest, emulator, dev build, smoke Maestro flow | App launches; smoke flow passes                                 |
| 1   | Firebase: Google sign-in, create/join household (invite code), security rules + tests, offline cache      | Two accounts share a household; rules tests pass                |
| 2   | Seed data + data layer: stores/areas, tags, repositories; shared unit/line parser                         | Unit tests pass; data survives restart                          |
| 3   | Recipes: list, search, tag filter, detail, add/edit (accepts prefilled draft), optional photo             | Maestro recipe flows pass                                       |
| 4   | Settings: stores & areas, ingredient defaults, tags, B/L toggle, week start                               | Maestro store-setup flow passes                                 |
| 5   | Meal plans: N-day plans, B/L/D slots, duplicate                                                           | Maestro plan flow passes                                        |
| 6   | Calendar: apply plan to dates with repeat, conflict handling, edit days                                   | Maestro schedule flow passes                                    |
| 7   | Shopping generation: source selection (dates/subset or plan days), aggregation, pantry check              | Aggregation tests + Maestro flow pass                           |
| 8   | Checklist: grouped by store → area, offline check-off, manual items, share as text                        | Airplane-mode check-off, then sync verified                     |
| 9   | Release: EAS APK on both phones, in-store trial                                                           | Both phones in daily use                                        |
| 10  | AI photo scan: Worker + Claude → prefilled form (multi-page, handwritten cards)                           | Accuracy check on ~10 of her real recipe photos + manual review |

## Manual-review items (emulator cannot validate)

- Real two-phone sync and Google sign-in on physical devices.
- Poor in-store connectivity.
- Real camera photos (glare, curved cookbook pages).

## AI photo scan (Milestone 10)

Decided 2026-10-04: use a vision model instead of on-device OCR, for better
results on cookbook pages, two-column layouts, and handwritten cards.

- **Flow:** Add Recipe → "Scan from photo" → camera or gallery
  (`expo-image-picker`), one or more pages → resize on the phone
  (`expo-image-manipulator`, ~1500 px long edge, JPEG) → POST to the Worker →
  the form opens pre-filled; ingredient names are matched to her existing
  ingredients (so store/area come along); unclear lines are highlighted with
  the original printed text.
- **Backend:** a Cloudflare Worker (free tier, no card) because Firebase
  Functions need the paid Blaze plan. The Anthropic API key lives only in the
  Worker's secrets, never in the APK. The Worker accepts only requests with a
  valid Firebase ID token for this project and limits scans per user per day.
- **Model call:** official Anthropic TypeScript SDK, `claude-opus-5-5`,
  image content blocks, structured outputs (`output_config.format` JSON
  schema): `{ title, servings, ingredients: [{ quantity, unit, name, note,
raw_text }], notes, warnings }`. Check `stop_reason` before using the result.
- **Cost:** about 2–3¢ per scan; set a monthly spend limit in the Anthropic
  console.
- **Testing:** unit tests map saved model responses to form drafts; an
  accuracy set of ~10 of her real photos (printed, cookbook page,
  handwritten); Maestro uses a canned-response dev mode so routine runs don't
  call the paid API; real-camera check on her phone.
- **Needs from you at M10:** an Anthropic API account/key and a free
  Cloudflare account.
