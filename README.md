# Muscle Explorer

Rotate a 3D body, tap a muscle, browse exercises that train it (with an animated demo on hover), build a multi-day plan, then see a heatmap of which muscles the plan works and track your sets week by week.

It's a frontend-only app (Vite + React + three.js). Everything is saved in the browser's `localStorage`; there's no backend or account. The same build runs in the browser, as a Windows desktop app (Electron) and as an Android app (Capacitor).

How the code works is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requirements

- [Node.js](https://nodejs.org/) 20.19+ or 22.12+, with npm
- For the Android app: [Android Studio](https://developer.android.com/studio) (brings the SDK, Java and the emulator)
- For the desktop installers: Windows (the build targets Windows only)

## Setup

```bash
git clone https://github.com/jsonwong3/gym-planner.git
cd gym-planner
npm install
```

### Exercise GIFs

The animated exercise demos aren't in this repo: they belong to [Gym visual](https://gymvisual.com/) and come from the [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset). The app works without them; hovering an exercise just shows no preview. To add them:

1. Download the dataset: <https://github.com/hasaneyldrm/exercises-dataset/archive/refs/heads/main.zip> (about 150 MB unzipped).
2. Unzip it into the project root, so you have `exercises-dataset-main/data/exercises.json` next to `package.json`.
3. Copy the GIFs the app uses into `public/exercise-gifs/`:

   ```bash
   npm run gifs
   ```

Run `npm run gifs` again whenever the exercise list changes. Both `exercises-dataset-main/` and `public/exercise-gifs/` are git-ignored; keep it that way (see [Credits and licences](#credits-and-licences)).

## Run in the browser

```bash
npm run dev            # http://localhost:5173
```

To try it on a phone on the same Wi-Fi, run `npm run dev -- --host` and open the `Network:` address it prints.

## Build

```bash
npm run build          # type-check, then build to dist/
npm run preview        # serve dist/ locally to check the build
```

`npm run build` is also the project's only correctness check (there are no tests); run it after any change.

## Desktop app (Windows, Electron)

```bash
npm run desktop:dev    # Electron window on the dev server, with hot reload
npm run desktop        # build, then run the built app in Electron
npm run desktop:dist   # build installers into release/
```

`desktop:dist` produces `Muscle Explorer Setup x.y.z.exe` (installer) and a portable `.exe`. Run `npm run gifs` first if you want the GIFs in them.

- The installers aren't code-signed, so Windows SmartScreen warns on first run: **More info** -> **Run anyway**.
- There's no app icon yet. Add `build/icon.ico` (256x256) and electron-builder picks it up.
- If Electron starts as plain Node ("bad option" or "does not provide an export named BrowserWindow"), your shell has `ELECTRON_RUN_AS_NODE` set (VS Code's terminal can do this). Unset it and try again.

## Android app (Capacitor)

```bash
npm run android:sync   # build, then copy dist/ into the Android project (after every web change)
npm run android:open   # open android/ in Android Studio to run, debug or build an APK/AAB
npm run android        # build, sync and run on a connected phone or a running emulator
```

Setting up an emulator: Android Studio -> **Device Manager** -> create a device (e.g. a Pixel with a recent x86_64 image) and set **Graphics** to **Hardware** (the 3D model needs WebGL). On Windows, virtualisation must be enabled in the BIOS, plus Windows Hypervisor Platform (or the Android Emulator hypervisor driver from the SDK Manager).

Quick check without Capacitor: `npm run dev -- --host`, then open `http://10.0.2.2:5173` in the emulator's Chrome (10.0.2.2 is your PC).

## Changing the exercise list

The app's exercises are `src/data/muscle_list.csv`: one row per exercise, with the muscle it targets and each muscle's share of the work. Edit it directly; the format is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#exercises-muscle_listcsv). A bad row (unknown muscle, duplicate id, shares not adding up to 1) stops the app loading with an error naming the row, so run `npm run build` or `npm run dev` after editing.

- Keep each exercise's `exercise_id`. Saved plans refer to exercises by id, and the id is also the GIF's file name.
- After adding exercises, run `npm run gifs` to copy their GIFs.

The list was generated from the dataset by the scripts in `scripts/`. To regenerate it (for example after adding exercises to `scripts/data/exercises.csv`), with the dataset downloaded:

```bash
node scripts/map-exercises.mjs                # writes scripts/data/muscle_list.csv
# check it, then copy it over src/data/muscle_list.csv
npm run gifs
```

`node scripts/exercises-json-to-csv.mjs` writes every dataset exercise to `scripts/data/exercises-all.csv`, to pick new ones from.

## Credits and licences

- **Exercise GIFs:** © Gym visual — <https://gymvisual.com/>. Redistributed by the exercises-dataset with Gym visual's permission at 180×180 only; the app shows this credit under every GIF. That permission doesn't extend to you: don't commit the GIFs or ship builds containing them publicly without your own licence from Gym visual (see the dataset's `NOTICE.md` and [Gym visual's terms](https://gymvisual.com/content/3-terms-and-conditions-of-use)).
- **Exercise data:** [exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset) (MIT); muscle parts and weights mapped for this app.
