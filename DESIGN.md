---
name: Athenaeum Minimal
colors:
  surface: '#f9f9ff'
  surface-dim: '#d6dae8'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edfc'
  surface-container-high: '#e4e8f6'
  surface-container-highest: '#dee2f0'
  on-surface: '#171c26'
  on-surface-variant: '#44474e'
  inverse-surface: '#2b303b'
  inverse-on-surface: '#ecf0ff'
  outline: '#75777e'
  outline-variant: '#c5c6ce'
  surface-tint: '#4e5e7f'
  primary: '#031633'
  on-primary: '#ffffff'
  primary-container: '#1a2b49'
  on-primary-container: '#8293b6'
  inverse-primary: '#b6c7ec'
  secondary: '#775a00'
  on-secondary: '#ffffff'
  secondary-container: '#fece57'
  on-secondary-container: '#735700'
  tertiary: '#001a20'
  on-tertiary: '#ffffff'
  tertiary-container: '#003039'
  on-tertiary-container: '#579cad'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#b6c7ec'
  on-primary-fixed: '#081b38'
  on-primary-fixed-variant: '#364766'
  secondary-fixed: '#ffdf98'
  secondary-fixed-dim: '#eec14b'
  on-secondary-fixed: '#251a00'
  on-secondary-fixed-variant: '#5a4300'
  tertiary-fixed: '#aaedff'
  tertiary-fixed-dim: '#8cd1e3'
  on-tertiary-fixed: '#001f26'
  on-tertiary-fixed-variant: '#004e5c'
  background: '#f9f9ff'
  on-background: '#171c26'
  surface-variant: '#dee2f0'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: '700'
    lineHeight: 3.5rem
    letterSpacing: -0.025em
  headline-xl:
    fontFamily: Inter
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '600'
    lineHeight: 2.25rem
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.375rem
  label-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.04em
  code-sm:
    fontFamily: Inter
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  gutter-lg: 2rem
  margin: 2rem
  margin-sm: 1rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

The design system projects an authoritative, scholarly, and modern institutional presence. It is calibrated specifically for academic librarians, researchers, archive directors, and university students navigating complex bibliographies and physical/digital asset circulation.

### Visual Character
- **Atmosphere:** Rigorous, tranquil, intellectual, and unhurried. It evokes the sensory clarity of an architectural archive or reading room—precise proportions, clear boundaries, and pristine legibility.
- **Design Movement:** Modern Architectural Editorial mixed with Contemporary Institutional Utility. The interface balances high-density data views with refined negative space, crisp hairline borders, and luminous tonal surfaces.
- **Key Principles:**
  1. *Authoritative Density:* Data-dense tables and indexing systems must remain legible and uncompressed without sacrificing visual breathing room.
  2. *Typographic Integrity:* Absolute support for diacritics in Vietnamese text alongside standard Latin characters, preventing clipping through generous vertical rhythm.
  3. *Intentional Focus:* Visual attention is guided through deliberate tonal contrast rather than heavy ornament or skeuomorphic distraction.

## Colors

The palette establishes an intellectual, distinguished tone rooted in archival discipline.

- **Primary (`#1A2B49` - Oxford Deep Navy):** Anchors the brand hierarchy, primary actions, global navigation, and key typographic headings. It conveys scholarly permanence and institutional authority.
- **Secondary (`#C59B27` - Illuminated Amber/Gold):** Evokes illuminated manuscripts and guild-pressed bindings. Used sparingly for status accents, active states, premium designations, and callout badges.
- **Tertiary (`#1E6B7B` - Scholarly Teal):** A complementary, balancing tone for categorizing digital collections, media archives, and secondary metadata metrics.
- **Neutral Palette (`#181D27` base down to `#F8FAFC`):** Deliberately cool, paper-inspired neutral foundations. Crisp slate surfaces provide sharp contrast against high-density table contents.

### Semantic Tones
- **Success (`#15803D`):** Returned volumes, active reservations, valid memberships.
- **Warning (`#B45309`):** Upcoming due dates, holds expiring in < 24 hours.
- **Error / Destructive (`#B91C1C`):** Overdue fines, damaged asset reports, lost barcodes.
- **Info (`#1D4ED8`):** System notifications, inter-library loan processing notes.

## Typography

Inter serves as the single typographic pillar, chosen for its comprehensive OpenType features, uniform stroke distribution, and flawless rendering of multi-tiered Vietnamese diacritics (dấu ngã, dấu hỏi, dấu nặng). 

- **Line Height Safeguards:** Vertical metrics have been tuned with extra clearance (minimum `1.375rem` on 14px text) to prevent diacritical marks from colliding with uppercase ascenders or table row dividers.
- **Tabular Numerals:** For cataloging indexes (Dewey Decimal / LC Call numbers, ISBNs, and circulation barcodes), enable `font-feature-settings: 'tnum' on, 'cv05' on` to ensure perfect column alignment.
- **Tracking & Case:** Small label tokens (`label-sm`) utilize slight positive letter-spacing (`+0.04em`) when styled in uppercase for archival categorization chips and table header metadata.

## Layout & Spacing

The layout philosophy follows a disciplined, architectural 12-column grid designed to accommodate multi-pane work desks (such as catalog trees alongside detail drawers).

### Breakpoints & Adaptability
- **Desktop (1280px+):** 12 columns, `gutter-lg` (2rem), `margin-lg` (3rem). Persistent sidebar navigation (260px) paired with split-view reading and editing panels.
- **Tablet (768px - 1279px):** 8 columns, `gutter` (1.5rem), `margin` (2rem). Collapsible sidebar menu that overlays into an off-canvas drawer when inspecting item record metadata.
- **Mobile (< 768px):** 4 columns, `gutter-sm` (1rem), `margin-sm` (1rem). Single-column stack, prioritizing barcode scanning, loan status indicators, and search field discovery.

### Rhythm
Components adhere strictly to an 8px base rhythm (`space-xs` = 4px, `space-sm` = 8px, `space-md` = 16px, `space-lg` = 24px, `space-xl` = 40px). Data grid row heights are standardized at 48px for compact density and 64px for standard scanning.

## Elevation & Depth

Visual hierarchy is established using **low-contrast outlines** and **subtle tonal layering** rather than heavy drop shadows.

- **Level 0 (Base Canvas):** Pure off-white paper tone (`#F8FAFC`).
- **Level 1 (Cards, Data Tables, Workspaces):** Flat white (`#FFFFFF`) framed by a crisp 1px hairline border (`#E2E8F0`).
- **Level 2 (Popovers, Dropdown Menus, Context Sheets):** `#FFFFFF` paired with a 1px border (`#CBD5E1`) and an ultra-subtle, directional ambient shadow: `0 4px 12px -2px rgba(26, 43, 73, 0.06), 0 2px 6px -1px rgba(26, 43, 73, 0.04)`.
- **Level 3 (Modal Dialogs & Asset Inspect Drawers):** High-density surface elevated with `0 20px 25px -5px rgba(26, 43, 73, 0.1), 0 8px 10px -6px rgba(26, 43, 73, 0.05)`, flanked by an ink-navy backdrop blur overlay (`rgba(26, 43, 73, 0.45)` with `backdrop-filter: blur(4px)`).

## Shapes

The design system employs **Soft (Level 1)** geometric discipline. Corners are restrained and architectural, communicating administrative rigor and timeless reliability.

- Standard buttons, form controls, and search bars: `0.25rem` (4px).
- Cards, record summaries, and modal viewports: `0.5rem` (8px).
- Pill geometry is restricted exclusively to status indicators, circulation chips, and badge tags to create instant semantic recognition against structured layout containers.

## Components

### Buttons
- **Primary:** Deep navy background (`#1A2B49`), crisp white text, 4px border radius. On hover, smooth transition to `#2A3F66`. Active state scales to `0.99`.
- **Secondary:** Transparent fill, solid 1px border (`#CBD5E1`), navy text (`#1A2B49`). Hover shifts to neutral surface tint (`#F1F5F9`).
- **Tertiary (Scholarly Accent):** Used for accessioning actions (e.g., "Add New Edition"); background in `#1E6B7B` with white text.
- **Focus Rings:** Uncompromised high-contrast accessibility ring: 2px offset with a 2px solid halo in Illuminated Amber (`#C59B27`).

### Input Fields & Search Bars
- Background `#FFFFFF`, 1px border `#CBD5E1`, internal padding `0.625rem 0.875rem`. Text rendered in `body-sm` or `body-md`.
- Focus state switches the border to primary navy (`#1A2B49`) with an outer 3px glow tinted in amber at 20% opacity (`rgba(197, 155, 39, 0.2)`).
- Search fields for LC/Dewey decimal records must include prefix slots for faceted taxonomy tags (e.g., `Title`, `Author`, `ISBN`, `Call Number`).

### Data Tables & Circulation Lists
- Header cells: Uppercase `label-sm`, subtle cool background (`#F8FAFC`), bottom border 1px solid (`#E2E8F0`).
- Row zebra striping is avoided; differentiation is achieved through a 1px border (`#F1F5F9`) between rows and an instantaneous hover highlight (`#F8FAFC`).
- High-priority cells (overdue dates, damaged status) receive bold monospaced identifiers and high-contrast color indicators.

### Status Chips & Badges
- Compact padding (`0.125rem 0.5rem`), font `label-sm`, fully pill-shaped.
- **Available:** Light emerald background (`#DCFCE7`), deep green text (`#15803D`).
- **Reserved / On Hold:** Light amber background (`#FEF3C7`), dark amber text (`#92400E`).
- **Overdue / Impaired:** Light rose background (`#FEE2E2`), dark crimson text (`#991B1B`).
- **Archived / Reference Only:** Light slate background (`#E2E8F0`), charcoal text (`#334155`).

### Selection Controls (Checkboxes & Radios)
- Square (checkboxes, 2px radius) or circular (radios), 18px footprint, 1.5px border (`#94A3B8`).
- Checked state fills with `#1A2B49` featuring a crisp white micro-tick mark.
- Focus state projects a 2px amber ring (`#C59B27`).

### Callout & Record Cards
- Background `#FFFFFF`, hairline boundary 1px (`#E2E8F0`).
- Features a 4px left accent stripe indicating record tier (Navy for General Collection, Amber for Special Collections/Rare Books, Teal for Digital Repositories).