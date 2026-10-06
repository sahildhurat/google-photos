---
name: The One Where
colors:
  surface: '#f9f9fc'
  surface-dim: '#dadadd'
  surface-bright: '#f9f9fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f6'
  surface-container: '#eeedf1'
  surface-container-high: '#e8e8eb'
  surface-container-highest: '#e2e2e5'
  on-surface: '#1a1c1e'
  on-surface-variant: '#43474e'
  inverse-surface: '#2f3033'
  inverse-on-surface: '#f1f0f4'
  outline: '#73777f'
  outline-variant: '#c3c6d0'
  surface-tint: '#3f608b'
  primary: '#244771'
  on-primary: '#ffffff'
  primary-container: '#3e5f8a'
  on-primary-container: '#c1d9ff'
  inverse-primary: '#a8c8f9'
  secondary: '#565f71'
  on-secondary: '#ffffff'
  secondary-container: '#d7e0f5'
  on-secondary-container: '#5a6375'
  tertiary: '#553e5b'
  on-tertiary: '#ffffff'
  tertiary-container: '#6e5574'
  on-tertiary-container: '#edcdf2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d3e3ff'
  primary-fixed-dim: '#a8c8f9'
  on-primary-fixed: '#001c39'
  on-primary-fixed-variant: '#254872'
  secondary-fixed: '#dae3f8'
  secondary-fixed-dim: '#bec7db'
  on-secondary-fixed: '#131c2b'
  on-secondary-fixed-variant: '#3e4758'
  tertiary-fixed: '#f8d8fd'
  tertiary-fixed-dim: '#dbbce0'
  on-tertiary-fixed: '#28132e'
  on-tertiary-fixed-variant: '#563e5c'
  background: '#f9f9fc'
  on-background: '#1a1c1e'
  surface-variant: '#e2e2e5'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 44px
    fontWeight: '400'
    lineHeight: 52px
    letterSpacing: -0.02em
  display-md:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '400'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '500'
    lineHeight: 40px
    letterSpacing: -0.015em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '500'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.005em
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0em
  title-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: 0.015em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0.02em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.03em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.04em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.25rem
  margin-tablet: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.25rem
  space-2xl: 3rem
---

## Brand & Style

The design system powers an intimate, conversational photo discovery experience designed to recall moments naturally through human language ("the one where we got caught in the rain in Kyoto"). 

### Aesthetic Philosophy
The visual direction fuses **Material 3 Expressive** with an airy, gallery-inspired editorial cadence:
- **Tonal Depth over Harsh Outlines:** Structural depth relies strictly on surface tonal stepping rather than aggressive borders or drop shadows.
- **Expressive Soft Geometry:** Volumetric, friendly radii (up to 28px and full pills) convey approachability and warmth, avoiding the clinical rigidity of typical utility tools.
- **Conversational Sanctuary:** Rejects frantic, high-density chat stream conventions in favor of spacious, gallery-like pacing with generous breathing room around visual assets and text responses.
- **Atmospheric Palette:** Warm neutrals and layered off-whites/deep obsidian form a quiet canvas, allowing photographs to remain the primary chromatic focal points while a single refined indigo-violet guides interaction.

## Colors

The palette adheres to Material 3 Expressive color theory with custom warm-cool balance. The accent tone is a deep, intellectual indigo-violet (`#3E5F8A`), matched with soft periwinkle tonal containers (`#D4E3FF`) to indicate selection, conversational context, and focal actions.

### Light Mode Architecture
- **Surface (`#FDF8F8`):** Underlying window canvas, slightly warmed.
- **Surface Container Lowest (`#FFFFFF`):** High-clarity photo card canvases.
- **Surface Container Low (`#F7F3F3`):** Subordinate structural blocks and quiet sectioning.
- **Surface Container (`#F1EDEE`):** Default conversational bubble base and inactive controls.
- **Surface Container High (`#EBE7E8`):** Elevated search field and floating surfaces.
- **Surface Container Highest (`#E5E1E2`):** Pill segments, passive chips, and input wells.
- **Primary (`#3E5F8A`):** Key action indicators, sent-query capsules, active navigation icons.
- **On-Primary (`#FFFFFF`):** Text/icons seated on primary surfaces.
- **Primary Container (`#D4E3FF`):** Conversational prompt accents and active bottom-nav indicators.
- **On-Primary Container (`#001C3A`):** High-legibility text over primary containers.

### Dark Mode Architecture
- **Surface (`#121316`):** Pure deep charcoal canvas with a microscopic warm violet undertone.
- **Surface Container Lowest (`#0D0E11`):** Recessed media views.
- **Surface Container Low (`#1A1B1F`):** Structural backdrops.
- **Surface Container (`#1E2024`):** Cards, conversational bot bubbles, resting control tiles.
- **Surface Container High (`#292A2E`):** Floating sheets and overlays.
- **Surface Container Highest (`#33353A`):** Input field resting surfaces and interactive chips.
- **Primary (`#A6C8FF`):** Luminous periwinkle for dark-field interaction.
- **On-Primary (`#003061`):** Deep navy glyphs on bright primary caps.
- **Primary Container (`#244771`):** Deep indigo fill for query badges and pill anchors.
- **On-Primary Container (`#D4E3FF`):** Soft luminous text on muted primary fills.

## Typography

The type system prioritizes editorial warmth, readability, and relaxed conversational timing. Using **Inter** with tailored letter-spacing and loosened line-heights, the typography mirrors the clarity and quiet intelligence of modern storytelling platforms.

### Typography Guidelines
- **Wordmark & Identity:** The title phrase *"The One Where"* is set in `headline-md` or `headline-lg` with medium weight and optical kerning (`letterSpacing: -0.02em`), emphasizing an intimate, spoken cadence.
- **Conversational Queries:** User queries utilize `body-lg` at weight `500` inside tinted capsules, establishing human-centric rhythm without screaming.
- **Spacious Leading:** Body text features generous vertical rhythm (`line-height: 1.625`) to prevent narrative fatigue across photo captions, memories, and natural-language search summaries.
- **Labels and Badges:** Metadata tags (date, camera parameters, geolocations) leverage `label-md` and `label-sm` with slight positive tracking to ensure effortless scanning over tonal containers.

## Layout & Spacing

Layouts follow a fluid, mobile-first grid anchored by generous negative space. Clustered elements are decoupled to allow memory narratives to breathe.

### Grid & Canvas Structure
- **Mobile (<600px):** 4-column fluid layout with `0.75rem` (12px) gutters and `1.25rem` (20px) outer margins. Vertical message spacing maintains `space-lg` (24px) gaps to prevent compact chat clutter.
- **Tablet / Large Handheld (600px - 1024px):** 8-column layout with `1rem` (16px) gutters and `2rem` (32px) margins. Photos reflow into organic asymmetrical multi-column masonry.
- **Desktop / Wide Form Factor (>1024px):** 12-column system, max-width constrained to `960px` for conversational reading flows, retaining touch-first thumb zone accessibility in centered viewports.

### Vertical Rhythm & Pacing
- Dialog exchanges alternate between distinct tonal surface blocks with `space-xl` separation between conversation topics.
- Photo clusters embed directly under conversational responses with a `space-sm` internal grid gap and a `space-md` boundary inset from the enclosing container.

## Elevation & Depth

Visual hierarchy uses **Material 3 Expressive Tonal Surface Tiers** accompanied by hyper-diffused, ambient color-bleed shadows rather than high-contrast structural borders.

### Elevation Levels
- **Level 0 (Flat):** `Surface` base. Background canvases and non-interactive sections carry no elevation or outlines.
- **Level 1 (Docked / Resting Surface):** Conversational bubbles, contextual chips, and photo cards use `Surface Container` or `Surface Container Low`. Elevation is defined by color-step delta (`#FDF8F8` to `#F1EDEE` in light; `#121316` to `#1E2024` in dark).
- **Level 2 (Active Focus):** Floating query suggestions, photo quick-actions, and dialog prompts use `Surface Container High` with a soft ambient shadow: `box-shadow: 0px 8px 24px -4px rgba(62, 95, 138, 0.08)`.
- **Level 3 (Modal / Persistent Floating):** The bottom navigation bar and floating contextual composer sit at Level 3: `Surface Container Highest` blended with 80% opacity and a backdrop blur of `20px` (`backdrop-filter: blur(20px)`), anchored by an ambient drop shadow: `box-shadow: 0px 12px 32px -4px rgba(0, 0, 0, 0.12)`.

## Shapes

The design uses **expressive rounded curves**, reinforcing the organic, sentimental nature of photo discovery. Sharp angles are entirely avoided.

### Corner Radii Tokens
- **Micro Elements (8px - 12px):** Internal photo thumbnails within dense previews and nested tags.
- **Small Elements (16px):** System badges, metadata chips, contextual action tools.
- **Medium Elements (20px):** User conversational bubbles, prompt suggestions, secondary photo frames.
- **Large Elements (24px - 28px):** Primary photo memory cards, assistant conversational blocks, bottom sheet top corners, dialog surfaces.
- **Pill (9999px / Full):** Input text-field capsules, bottom navigation active indicators, filter chips, primary CTA buttons.

## Components

### 1. M3 Bottom Navigation Bar
- **Container:** Height `80px`, anchored to screen bottom. Background set to `Surface Container` with optional backdrop blur. 0px border.
- **Navigation Items (4):** *Photos*, *Collections*, *Ask*, *Search*.
- **Active Indicator Pill:** A pill shape (`64px × 32px`) rendered in `Primary Container` (`#D4E3FF` light / `#244771` dark). The active item icon adopts `On-Primary Container` color.
- **Labels:** Set in `label-md`, positioned `4px` beneath the indicator icon. Inactive items use `Neutral Variant` text and icon tones.

### 2. Conversational Message Bubbles
- **User Message ("The Prompts"):** Right-aligned. Background `Primary` (`#3E5F8A` light / `#A6C8FF` dark). Text `On-Primary`. Corner radius `24px` on all corners, with `space-md` inner padding.
- **Assistant Message ("The Discovery"):** Left-aligned. Spans up to 92% of the content container. Background `Surface Container Low` or `Surface Container`. Radius `24px` with bottom-left corner slightly pinched to `16px`. Displays typography hierarchy: query interpretation summary in `title-md`, followed by inline photo grid.

### 3. Photo Cards & Gallery Clusters
- **Hero Photo Card:** Radius `24px`. Overflow hidden. Subtle 1px inset tonal border (`rgba(255, 255, 255, 0.12)` in dark mode).
- **Cluster Previews (2x2 / 3x2):** Corner radius `16px` on individual images, with dynamic aspect ratios (4:3, 1:1, 16:9). Tapping opens a full-screen ambient viewer.

### 4. Input Field & Conversational Bar
- **Composer Pill:** Full pill radius (`9999px`), minimum height `56px`. Surface color `Surface Container High`. 
- **Leading / Trailing Icons:** Microphone or photo attachments use circular tap zones (`40px × 40px`) in transparent tone; the send button sits in a solid `Primary` circular container (`40px × 40px`).
- **Placeholder:** Set to `body-lg` in `Neutral Variant`: *"Describe a place, date, or moment..."*

### 5. Filter Chips & Memory Tags
- **Base Style:** Full pill shape, height `36px`, padding `0 16px`. Background `Surface Container Highest`.
- **Selected Style:** Background `Primary Container`, text and icon in `On-Primary Container`. Zero outlines, relying strictly on tonal shifts.

### 6. Interactive Controls (Checkboxes & Radios)
- **Checkboxes:** Curved squares (radius `8px`) with filled `Primary` and white check icon when selected.
- **Radios:** Outer circular target (`20px`) with a floating center dot (`10px`) in `Primary` when active.