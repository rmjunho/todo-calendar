# iOS 26 Design System

Native iOS UI components following Apple's Human Interface Guidelines, built around **SF Pro** typography, **Liquid Glass** materials, and the iOS **system color** palette. This system recreates the component specs supplied as source and packages them as reusable React primitives, full-screen UI kits, and foundation tokens.

---

## Sources

Built from ten iOS 26 component spec PDFs supplied in `uploads/`:

`Action Sheet`, `Alert`, `Button - Content Area`, `Button - Liquid Glass - Symbol`, `Button - Liquid Glass - Text`, `Color Picker - iPad`, `Control Center`, `Home Screen`, `Picker Button`, `Toggle - Switch`.

The PDFs are vector Figma exports; text and layout were extracted programmatically (full-resolution raster rendering timed out on the heavy SF Symbol vectors). Values follow Apple's published HIG. There is **no brand logo** in the sources — Apple's logo/wordmark is not reproduced; where a mark would appear, plain type or the product name is used.

> **This design system reproduces standard platform UI controls per Apple's public HIG for prototyping. Apple's proprietary assets — the SF Pro font files, SF Symbols glyphs, and real app icons — are NOT redistributed here; see Typography and Iconography for the substitutions in place.**

---

## Components

Reusable React primitives (`components/`). The public API namespace is auto-generated (`window.<Namespace>` — run the compiler to get the exact name).

- **Button** (`buttons/`) — iOS button covering the source specs: `prominent` (Content-Area), `tinted`, `gray`, `plain`, and `glass` (Liquid Glass); `iconOnly` + `circle` yields the symbol button.
- **PickerButton** (`buttons/`) — pop-up menu button with the up/down chevron affordance.
- **Switch** (`controls/`) — the Toggle / Switch (51×31pt).
- **Alert** (`overlays/`) — centered alert dialog with optional text fields.
- **ActionSheet** (`overlays/`) — bottom-anchored grouped actions with a detached Cancel.
- **ColorPicker** (`pickers/`) — the iPadOS color picker (Grid / Spectrum / Sliders + opacity).
- **Icon** (`foundation/`) — SF-Symbols-style glyph set. *Intentional addition* — the source relies on SF Symbols, which cannot be shipped; `Icon` supplies original stand-in glyphs so components and kits render without Apple's proprietary library.

Each component directory holds `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md`, and a `@dsCard` HTML showcase.

---

## Content Fundamentals

How iOS writes UI copy — mirror this in any interface built with the system.

- **Voice:** clear, calm, human, and brief. Apple writes *to* the user in the second person ("Allow **App** to use your location?"), and refers to the system in the first person only for assistant surfaces.
- **Casing:** **Title Case** for buttons, titles, and labels ("Not Now", "Save to Files", "Turn On Wi-Fi"). Sentence case for body messages.
- **Alert titles** are a short phrase, not a question when avoidable; the spec guidance is literally *"A Short Title Is Best."* **Messages** are *"a short, complete sentence."*
- **Buttons are verbs:** "Delete", "Allow", "Save", "Duplicate". Cancel is always "Cancel". Dismissive default is "Not Now" (never "No").
- **Numbers & units:** temperatures use the degree glyph ("72°", "H:88° L:64°"); time is "9:41 AM" (9:41 is Apple's canonical demo time). Tabular figures for anything that updates live.
- **No emoji** in system chrome. No exclamation marks. No marketing tone inside controls.
- **Destructive actions** are named explicitly ("Delete Photo") and colored systemRed — never hidden behind vague verbs.

---

## Visual Foundations

- **Color.** The iOS system palette (`tokens/colors.css`): systemBlue `#007AFF` is the default tint. Semantic layers — `--label` (4 levels of opacity-over-content), `--bg`/`--bg-secondary`/`--bg-tertiary`, translucent `--fill` (4 levels), and `--separator` hairlines. Every value ships in both **Light and Dark** appearances via the `[data-theme="dark"]` scope (add the attribute — or the `.ios-dark` class — to any container to switch it).
- **Type.** SF Pro. Full Dynamic Type scale (Large sizes): Large Title 34 → Caption 2 11, each with its documented line-height and tracking (`tokens/typography.css`). Display family ≥ 20pt, Text family < 20pt. Headline is 17 semibold; Body is 17 regular.
- **Spacing.** Strict **8-point grid** (`--space-*`); screen margin 16pt; **44×44pt minimum touch target** on every control.
- **Corners.** Continuous ("squircle") rounding: 6 → 26px scale plus `--radius-capsule` (999px) for pills, switches, and glass buttons. Alerts use 26px; sheets/pickers 20px; buttons are capsules by default.
- **Liquid Glass** (iOS 26's material language). Translucent layers that blur and saturate the content behind them (`backdrop-filter: blur() saturate(180%)`), carry a bright inset specular edge (`--glass-highlight` + hairline `--glass-border`), and float on a soft ambient shadow. Two grades: **regular** (tinted, readable) and **clear** (near-transparent, relies on blur). System materials range ultra-thin → thick. See `tokens/effects.css` and the `.ios-glass` utility.
- **Backgrounds.** Content sits on photographic wallpapers or plain system backgrounds — glass and materials are meaningless without something behind them, so showcases use gradient/photo backdrops.
- **Elevation.** A soft, low-contrast ambient shadow scale (`--shadow-1/2/3`, `--shadow-glass`). No hard or colored drop shadows.
- **Motion.** Quick and physical. Standard easing `cubic-bezier(.4,0,.2,1)`; a gentle spring `cubic-bezier(.34,1.56,.64,1)` for the switch knob and alert entrance. Durations 150 / 250 / 350ms. Sheets slide up; alerts scale-in from slightly large; Control Center cross-fades.
- **Interaction states.** Press = scale to `0.96` (buttons) and a translucent fill flash (list rows / sheet buttons). Hover (pointer only) brightens filled controls ~8% or lifts glass fill opacity. Toggles animate fill color + knob slide. No underlines; links use the tint color.
- **Transparency & blur** appear on floating chrome only — Control Center, docks, menus, sheets, the search pill, tab bars — never on primary content cards.

---

## Iconography

- **System:** Apple **SF Symbols 7** — a proprietary, licensed glyph library that **cannot be redistributed**. This system therefore ships an **`Icon` component** with original, hand-tuned SVG stand-ins drawn to the SF Symbols aesthetic (rounded joins, optical centering, filled/hairline mix), addressed by their real symbol names (`play.fill`, `checkmark`, `chevron.right`, `wifi`, `moon.fill`, …). **Substitution flagged** — swap for the real SF Symbols in any native Apple context (they are available free to Apple-platform developers via the SF Symbols app).
- **Weights** map to SF Symbols optical weights (`light`/`regular`/`semibold`/`bold`) via stroke scaling; glyphs inherit `currentColor`.
- **App icons** (Home Screen) and **the SF Pro font** are likewise proprietary Apple assets and are **not** reproduced — app icons are stylized colored stand-ins; SF Pro renders natively on Apple devices through the `-apple-system` stack and falls back elsewhere.
- **No emoji** as UI iconography (a couple appear only as playful stand-ins for a chat/app tile in the Home Screen recreation). **No** decorative unicode glyphs.
- All icons are vector SVG via the `Icon` component — no icon font, no raster icons.

---

## Intentional additions

- **`Icon`** — not a source component, but required: the specs depend on SF Symbols, which can't be shipped. Provides the substitute glyph set the components and UI kits render with.

---

## Typography substitution (action needed)

**SF Pro is not bundled** (proprietary Apple typeface). The type tokens intentionally name `-apple-system` / `"SF Pro Text"` / `"SF Pro Display"` first, so text renders in genuine SF Pro on Apple hardware and falls back to the host UI font elsewhere. **If you need SF Pro to render on non-Apple platforms, upload the SF Pro font files** (download from Apple Developer) and add `@font-face` rules — do not substitute a different family, which would break the metrics.

---

## Index / Manifest

Root:
- `styles.css` — the single entry point consumers link (`@import`s the four token files).
- `tokens/` — `colors.css`, `typography.css`, `spacing.css`, `effects.css` (materials, glass, shadows, motion).
- `components/` — `buttons/`, `controls/`, `overlays/`, `pickers/`, `foundation/` (see Components).
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand groups in the Design System tab).
- `ui_kits/ios/` — interactive Home Screen + Control Center recreation (`index.html`, `HomeScreen.jsx`, `ControlCenter.jsx`, `README.md`).
- `uploads/` — the original source spec PDFs.
- `SKILL.md` — Agent-Skill wrapper for downloading/using this system in Claude Code.

The **Design System tab** renders all 19 foundation + component + kit cards. Generated files (`_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`) are produced by the compiler — do not edit.
