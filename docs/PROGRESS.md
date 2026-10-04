# Progress Log

Running record of what is done, important bugs and how they were fixed, and
lessons learned about the toolchain. The plan lives in [`PLAN.md`](PLAN.md).
Update this file at the end of every milestone.

## Milestones

| #   | Milestone                                                                  | Status      |
| --- | -------------------------------------------------------------------------- | ----------- |
| 0   | Scaffold: Expo + router + TS, tooling, emulator, smoke flow                | Done        |
| 1   | Firebase: Google sign-in, create/join household, rules + tests, offline    | Done        |
| 2   | Seed data + data layer: stores/areas, tags, repositories, unit/line parser | Done        |
| 3   | Recipes                                                                    | Done        |
| 4   | Settings: stores & areas, ingredient defaults, tags                        | Done        |
| 5   | Meal plans (N-day, B/L/D)                                                  | Next        |
| 6   | Calendar: apply plans to dates                                             | Not started |
| 7   | Shopping generation + pantry check                                         | Not started |
| 8   | Checklist by store → area, share as text                                   | Not started |
| 9   | Release: EAS APK on both phones                                            | Not started |
| 10  | AI photo scan (Cloudflare Worker + Claude)                                 | Not started |

## Completed

### Milestone 0 — Scaffold (2026-10-03)

- Expo SDK 57 + expo-router + TypeScript app "Kaytlin's Recipes"
  (`com.jmangelson.kaytlinsrecipes`); template demo content removed.
- Prettier, ESLint, `tsc`, Jest + React Native Testing Library;
  `npm run validate`.
- Maestro smoke flow. Repo pushed to GitHub over a repo-scoped deploy key.

### Milestone 1 — Sign-in and shared households (2026-10-04)

- React Native Firebase (Auth + Firestore with on-device offline cache) and
  Google Sign-In; web client id read from `google-services.json` at config time.
- Create a household or join one with an 8-character invite code (no
  confusable characters, secure random). Settings tab: household, member
  count, shareable invite code, signed-in account, sign out.
- Root stack gates sign-in → household setup → tabs on session state.
- Firestore rules: members-only household data, a joiner can add only
  themselves, invite codes are get-only. 14 rules tests.
- Local Firebase emulator workflow with an emulator-only test sign-in for
  Maestro. Flows: `smoke`, `household-invite`, `returning-member`, plus the
  `tour/screenshots` capture flow.
- Screenshot review done; 3 UI issues found and fixed (see bugs below).

- 2026-10-04: Firestore rules deployed to `kaytlin-s-recipe-app`
  (`npx firebase deploy --only firestore:rules`).

- 2026-10-04: standalone test APK built (`cd android && ./gradlew
app:assembleRelease`): JS bundled, real Firebase, signed with the debug key
  (SHA-1 `5E:8F:16:…:F6:25`, verified with `apksigner`). On the emulator it
  launches without Metro and opens Google's sign-in UI with no config error.

- 2026-10-04: **verified on a physical phone** with the test APK: Google
  sign-in, household creation, app restart, and offline launch (airplane mode)
  all work. Not yet tried: a second phone joining with the invite code.

Installing the release APK on the emulator replaces the dev build;
reinstall it with `npx expo run:android` before Maestro work.

### Milestone 2 — Starter data, data layer, amount parser (2026-10-04)

- Every household gets Macey's, Costco, Sam's Club, Walmart, Smith's with
  store areas in walking order, plus tags Vegetarian, Chicken/Poultry,
  Fish/Seafood, Beef, Pork. Seeded once (`seedVersion`), with fixed ids so two
  phones seeding at once write identical docs; runs in the background and
  works offline. Existing households are seeded on next launch.
- Ingredient line parser (`parseIngredientLine`): mixed/unicode fractions,
  ranges, package sizes, size words, notes, "to taste"; US units with
  case-sensitive T/t; name matching key with simple singulars.
- Amount helpers: convert, combine (2 cups + 4 tbsp → 2 ¼ cups; 8 oz + 1 lb →
  1 ½ lb), recipe-style display fractions. 70 unit tests.
- Data functions for stores, tags, ingredients; rules validate their shape
  (19 rules tests). Settings shows tags and opens a read-only Stores & aisles
  screen. Rules deployed to the production project.
- Maestro: new `stores` flow; tour adds Settings, Stores & aisles screens.
  Screenshot review: 2 issues found and fixed (below).

Known limitation (fixed in M4): a phone with a stale offline copy could re-seed
over edited stores.

### Milestone 3 — Recipes (2026-10-04)

- Recipes tab: list sorted by name, search by name or ingredient, tag filter
  (any selected tag), counts, empty and no-match states, refresh on return.
- Recipe screen: photo, servings, tags, ingredient amounts in a column, notes;
  Edit in the header; Delete with confirmation.
- Add/edit form: name, servings, tag chips, one-ingredient-per-line box
  (paste-friendly) with a live "Read as N ingredients" preview, notes/source,
  optional photo (camera or gallery, cropped 4:3, ~600 px JPEG stored in
  Firestore). Inline validation plus a message above Save.
- Saving links each line to the household ingredient list (creating new
  ingredients once per name) in one batch; the typed line is kept for editing.
- Offline: saves wait briefly for the server, then continue with the write
  queued. Verified: saved a recipe in airplane mode; it appeared in the list
  and reached Firestore ~1 s after reconnecting.
- Rules validate recipes and photos (24 rules tests). 93 unit tests.
- Maestro: `recipes-add-edit` (incl. app restart), `recipes-filter`,
  `recipe-photo`; `scripts/e2e-setup.sh` puts a test photo in the gallery.
  Screenshot review: 6 UI issues found and fixed (below).
- Plan: scan result JSON contract defined (PLAN.md → "Scan result format").

### Milestone 4 — Shopping setup and household settings (2026-10-04)

- Stores & aisles: reorder stores, add a store, hidden stores listed
  separately. Store screen: rename, "Use on shopping lists" switch, areas in
  walking order (rename inline, move up/down, remove with confirmation, add).
- Ingredients: searchable list with each ingredient's store › area, a "No store
  yet (N)" filter, and an editor to rename and pick store and area (Save in
  the header). Renames that would collide with another ingredient's matching
  key are refused.
- Recipe tags: add, rename inline, delete with confirmation.
- Household settings: name, week start (Sunday default / Monday), plan
  breakfast and lunch on/off; summarized on the Settings tab.
- Renames save automatically after a short pause and when leaving the screen
  (`useAutosave`), so Back never loses an edit; "Saved" confirms.
- Seeding fix: new households are seeded during creation; older households are
  seeded only after the server confirms there's no seed, so stale offline
  copies can't overwrite edits.
- Maestro: `stores-edit` (incl. rename-then-Back), `ingredient-store`,
  `tags-household`; 10 flows total. Screenshot review: 7 issues fixed (below).

## Decisions

- 2026-10-04: photo scan switched from on-device ML Kit to AI (Claude via a
  free-tier Cloudflare Worker, ~2–3¢ per scan) for better accuracy. See
  PLAN.md → "AI photo scan".

## Important bugs and resolutions

| Bug                                                               | Root cause                                                                                                                                                                                                                                         | Fix                                                                                                                                                              |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gradle: "SDK directory is not writable" (NDK install)             | DevPod remaps the container user's UID (1000 → 1001) at create time; only `$HOME` is re-owned, so `/opt/android-sdk` stayed owned by the old UID                                                                                                   | `.devcontainer/fix-android-sdk-owner.sh` re-owns the SDK from `postCreateCommand`                                                                                |
| Firebase emulators refused to start                               | firebase-tools requires Java 21; container had only 17                                                                                                                                                                                             | Dockerfile installs `openjdk-21-jre-headless`; `JAVA_HOME` stays 17 for Gradle, `java` on PATH is 21                                                             |
| Firestore rules let any member rewrite `memberIds` / `inviteCode` | In rules v2, `match /{document=**}` matches **zero** or more segments, so the members-only wildcard also matched the household doc itself                                                                                                          | Use `match /{collection}/{document=**}`; regression test added                                                                                                   |
| App crashed: "No Firebase App '[DEFAULT]' has been created"       | `android/` was generated in M0, before Firebase config plugins existed; `expo run:android` did not regenerate it                                                                                                                                   | `npx expo prebuild --platform android --clean`, then rebuild (documented in README)                                                                              |
| Maestro runs randomly died with "device offline / not found"      | Emulator's adb transport dropped ("connection terminated: read failed" in `/tmp/adb.$UID.log`) while Maestro was attached; seen with a 2 GB AVD booted from snapshot. Plain adb and older Maestro behaved the same, so not app or version specific | Cold boot with 4 GB RAM → zero drops across all later runs. `.devcontainer/start-emulator.sh` now does this by default (RAM and cold boot were changed together) |
| Test sign-in tap sometimes did nothing                            | Tapping "Test sign in" while the keyboard was closing; the button moved under the tap                                                                                                                                                              | Subflow waits for the button after `hideKeyboard` and uses `retryTapIfNoChange`; then waits for the sign-in screen to go away                                    |
| Code edits never reached the device                               | Metro started with `CI=1` runs with **file watching disabled** ("Metro is running in CI mode, reloads are disabled")                                                                                                                               | Start Metro without `CI=1` (redirect stdin from `/dev/null` for non-interactive use)                                                                             |
| "Share invite code" button rendered as "Share invite"             | Android under-measures a shrink-wrapped bold `Text` inside a centered `Pressable`; the last word wrapped onto a hidden second line                                                                                                                 | Button label stretches to full width with centered text                                                                                                          |
| Invite-code error hidden under the gesture bar                    | Error rendered below the Join button at the bottom of the scroll view; `Screen` didn't pad for the bottom safe area                                                                                                                                | Errors render under their input, above the button; `Screen` applies all safe-area edges                                                                          |
| Extra blank band under the Stores & aisles header                 | `Screen` padded the top safe-area inset even under a navigation header                                                                                                                                                                             | `Screen` takes `edges`; header screens skip `top`                                                                                                                |
| Tag chip text crowded its right edge                              | Padding and border were on the `Text` itself (same Android measuring issue as the button label)                                                                                                                                                    | Chip is a `View` with padding wrapping the `Text`                                                                                                                |
| household-invite flow failed after Settings grew                  | Invite code moved below the fold; `copyTextFrom` needs it on screen                                                                                                                                                                                | Flow scrolls to `invite-code` first                                                                                                                              |
| Typing landed in the wrong field (tests)                          | Taps on a field's label text didn't focus the input, and the open keyboard covered lower fields so taps hit keys                                                                                                                                   | Labels now focus their input; flows target inputs by `testID` and hide the keyboard first                                                                        |
| Red error border never showed                                     | The normal border color was applied after the error color in the style array                                                                                                                                                                       | Pick the border color once: danger when there's an error                                                                                                         |
| "Add recipe" button clipped to "Add"                              | Shrink-wrapped button beside the large title on a narrow phone                                                                                                                                                                                     | Full-width button under the title                                                                                                                                |
| Edit button off-screen on long recipes                            | Edit was at the bottom of the recipe screen                                                                                                                                                                                                        | Edit moved to the header; Delete stays at the bottom                                                                                                             |
| Validation error invisible after tapping Save                     | Save is at the bottom; the field error is at the top                                                                                                                                                                                               | Message above Save: "Check the fields marked in red above."                                                                                                      |
| "Monterey Jack" shown as "monterey jack"                          | Parser lowercased ingredient names                                                                                                                                                                                                                 | Keep her capitalization; matching already uses a case-insensitive key                                                                                            |
| Save would hang offline                                           | A Firestore write's promise resolves only when the server confirms                                                                                                                                                                                 | `commitOrQueue`: wait up to 2.5 s, then continue with the write queued                                                                                           |
| Save tap hit a toast in offline tests                             | Dev-only LogBox warning toast covered the bottom button                                                                                                                                                                                            | LogBox toasts off in emulator test mode (warnings still in Metro log)                                                                                            |
| Typed-route errors for `/recipe/${id}`                            | expo-router typed routes reject template strings                                                                                                                                                                                                   | Use `{ pathname: '/recipe/[id]', params: { id } }`                                                                                                               |
| Settings had no Ingredients button                                | A scripted edit didn't match because Prettier had reflowed the JSX; nothing checked the result                                                                                                                                                     | Fixed by hand; screenshot review and the flow caught it                                                                                                          |
| Renames lost when tapping Back                                    | Store/area/tag names saved on blur; hiding the keyboard or Back doesn't blur on Android                                                                                                                                                            | `useAutosave`: save after a pause and on unmount                                                                                                                 |
| Recipes tab showed no tags for a new household                    | Server-checked seeding finished after the tab loaded tags, and the tab never reloaded tags                                                                                                                                                         | Seed during household creation; Recipes tab reloads tags on focus                                                                                                |
| Ingredient Save hidden below long chip lists                      | Save button at the bottom                                                                                                                                                                                                                          | Save in the header (shared `HeaderButton`)                                                                                                                       |
| Area names truncated ("eat & Seafood")                            | Name input shared a row with three 44 dp buttons                                                                                                                                                                                                   | Two-line area rows: name full width, actions below                                                                                                               |
| "No store yet" looked like an error                               | Shown in danger red                                                                                                                                                                                                                                | New amber `attention` color                                                                                                                                      |
| Row dividers stopped short of the arrow buttons                   | Divider drawn by the inner row only                                                                                                                                                                                                                | `ListRow` `divider={false}`; outer row draws it                                                                                                                  |

## Lessons learned

- **Read the installed package's types before using an API.** Expo SDK 57,
  RNFB 26 (modular API), google-signin 16 and expo-router NativeTabs all
  differ from older docs; checking `node_modules/**/*.d.ts` avoided guesswork.
- **Native changes need a clean prebuild.** Adding config plugins or native
  modules → `npx expo prebuild --platform android --clean` → `npx expo run:android`.
- **Metro must run in watch mode** for Fast Refresh and for Maestro to test
  current code. Never start it with `CI=1`.
- **Emulator:** use `.devcontainer/start-emulator.sh` (4 GB, cold boot, no
  duplicates). When Maestro reports a lost device, read `/tmp/adb.$UID.log`
  before retrying. `adb shell input keyevent 82` opens the RN dev menu and
  blocks UI checks.
- **Maestro:** `tapOn` does not scroll — use `scrollUntilVisible` for content
  below the fold. A synthetic `pressKey: Enter` does not trigger RN
  `onSubmitEditing`; tap the button instead. `takeScreenshot` paths land under
  `--test-output-dir`.
- **Shell in the agent environment:** `pkill -f pattern` can match its own
  shell — use the `[x]yz` bracket trick. Background long-lived processes with
  `run_in_background` or `setsid`, not a bare `&`.
- **Firebase CLI login** in the container is two steps because `!` commands
  can't take input: `! npx firebase login --no-localhost`, open the link,
  then `! npx firebase login <code>`. The token lives in the container home
  and is lost if the container is recreated.
- **Rules changes** go live only via `npx firebase deploy --only
firestore:rules`, after `npm run test:rules` passes.
- **Firebase emulators** accept any Google credential, so Maestro uses an
  emulator-only email sign-in; real Google sign-in needs a manual check on a
  phone (needs the debug SHA-1 registered, which it is).
- **Google Sign-In deprecation:** the original `GoogleSignin` API logs a
  "gsi-migration" warning (legacy Google Sign-In for Android is deprecated in
  favor of Credential Manager). It works today; revisit before release (M9).
- **Rules: any matching rule grants access.** To validate a collection's
  shape, exclude it from the members-only catch-all, or the catch-all
  silently allows malformed writes.
- **Don't put padding/borders on `Text`** on Android; wrap it in a `View`.
- **Maestro forms:** tap inputs by `id` (label text matches the label, not the
  input); `hideKeyboard` before tapping fields lower on the screen; in a
  multiline input `pressKey: Enter` inserts a newline. Wait for elements near
  the top of a screen, not buttons that may be below the fold.
- **Android photo picker in Maestro:** `tapOn: 'Photo taken on.*'`, then the
  crop screen's `id: crop_image_menu_crop`.
- **Offline checks:** `adb shell cmd connectivity airplane-mode enable|disable`.
  Query the Firestore emulator directly with `Authorization: Bearer owner`.
  The dev build loses Metro in airplane mode; fill forms online first.
- **Check scripted edits landed.** A replace that silently matches nothing
  leaves the old code; grep for the new text after editing.
- **Save on change, not on blur**, for inline edits on Android.
- **Maestro:** `scrollUntilVisible` stops at the first visible match, and tab
  labels count ("Settings"); scroll to an element unique to the screen.
- **Test renderer quirk:** RNTL could not observe a save made in an unmount
  cleanup; that behavior is verified on the device instead.
- **Screenshot review catches real bugs** that tests miss (clipped labels,
  hidden errors). It is now a required step for every milestone.
