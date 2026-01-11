# PediAssist Design System

This document describes the design language for PediAssist v2.0.
Our goal is to create a **Medical-Grade** yet **Modern** and **Premium** interface.
It should feel lightweight, trusted, and professional ("Apple-like" cleanliness with medical precision).

## 1. Design Principles

- **Clarity & Precision:** Information must be legible and organized. No clutter.
- **Trust & Calm:** Colors should be soothing but confident (Deep Blues, Clean Whites).
- **Modern Polish:** Subtle shadows, rounded corners, smooth transitions. Avoid harsh borders.
- **Feedback:** Interactive elements must respond instantly and clearly.

## 2. Color Palette

We use a custom Tailwind configuration derived from the HSL color space for flexibility.

### Primary (Trust & Professionalism)
Used for primary actions, active states, and brand presence.
- **Primary-50**: `#eff6ff` (Backgrounds)
- **Primary-100**: `#dbeafe`
- **Primary-500**: `#3b82f6` (Actionable)
- **Primary-600**: `#2563eb` (Hover)
- **Primary-700**: `#1d4ed8` (Active/Dark Mode Text)

### Secondary (Calm & Hygiene)
Used for accents, success states, and medical context.
- **Teal-50**: `#f0f9ff`
- **Teal-500**: `#14b8a6`
- **Teal-600**: `#0d9488`

### Neutral (Text & Structure)
Slate for a cooler, more modern look than plain gray.
- **Surface-White**: `#ffffff`
- **Surface-Glass**: `rgba(255, 255, 255, 0.8)` (Backdrop blur)
- **Slate-50**: `#f8fafc` (App Background)
- **Slate-200**: `#e2e8f0` (Borders)
- **Slate-600**: `#475569` (Secondary Text / Icons - *Updated for better contrast*)
- **Slate-900**: `#0f172a` (Primary Text)

### Semantic Colors
- **Error**: `#ef4444` (Red-500)
- **Warning**: `#f59e0b` (Amber-500)
- **Success**: `#22c55e` (Green-500)

## 3. Typography

**Font Family:** `Inter`, `system-ui`, `sans-serif`.
Prioritize readability.

- **H1 (Page Titles):** 24px (1.5rem), semi-bold, tighter tracking.
- **H2 (Section Headers):** 20px (1.25rem), medium.
- **H3 (Card Headers):** 16px (1rem), semi-bold.
- **Body:** 14px (0.875rem), regular.
- **Small/Label:** 12px (0.75rem), medium.

## 4. Layout & Spacing

We use a 4pt grid system (Tailwind default).
- **Padding/Margin:** 4 (16px) is the standard unit.
- **Gap:** 4 (16px) for standard grids, 2 (8px) for tight groups.

### Container
- **Max Width:** `max-w-7xl` centered.
- **Card Padding:** `p-6` (standard) or `p-4` (compact).

## 5. Components

### Cards (The Core Container)
Almost all content lives in cards.
- **Bg:** White (Light) / Slate-900 (Dark).
- **Border:** `border border-slate-200` (Light) / `border-slate-800` (Dark).
- **Shadow:** `shadow-sm` for list items, `shadow-md` for floating panels.
- **Radius:** `rounded-xl` (12px) or `rounded-2xl` (16px).

### Buttons
- **Primary:**
  - Bg: `bg-primary-600`
  - Text: `!text-white` (Explicitly use `!` to prevent theme-based invisibility)
  - Text Weight: `font-bold` (Required for readability on actionable elements)
  - Hover: `hover:bg-primary-700`
  - Shadow: `shadow-md shadow-primary-500/20`
  - Radius: `rounded-lg`
- **Secondary/Outline:**
  - Bg: `bg-white`
  - Border: `border border-slate-300`
  - Text: `text-slate-700`
  - Hover: `hover:bg-slate-50`
- **Ghost:**
  - Bg: `transparent`
  - Text: `text-slate-600`
  - Hover: `hover:bg-slate-100`

### Inputs
- **Base:**
  - Height: `h-10` (40px)
  - Bg: `bg-white`
  - Icons: `text-slate-600` (Minimum to ensure search/user icons are visible)
  - Border: `border-slate-300`
  - Radius: `rounded-lg`
  - Focus: `ring-2 ring-primary-500/20 border-primary-500`
- **Features:**
  - **Password Toggle:** Use `rightIcon` with `Eye/EyeOff` icons to allow visibility control.

### Navigation (Sidebar)
- **Active Item:**
  - Bg: `bg-primary-50` (Light) / `bg-primary-900/20` (Dark)
  - Text: `text-primary-700` (Light) / `text-primary-300` (Dark)
  - Icon: `text-primary-600`
- **Inactive Item:**
  - Text: `text-slate-600`
  - Hover: `hover:bg-slate-100`

## 6. Implementation Strategy

To create a consistent app, we will introduce a **Design System Component Library** in `src/components/ui/`.
This isolates styles and ensures uniformity.

New Components to Create:
1. `Button` (Variants: primary, secondary, ghost, danger)
2. `Input` (Text, Number, Date, with error states)
3. `Card` (Header, Content, Footer)
4. `Badge` (Status indicators)
5. `Avatar` (User profiles)

## 7. Motion & Aesthetics
- **Transitions:** `transition-all duration-200` on hover states.
- **Glassmorphism:** Use `backdrop-blur-md` and `bg-white/80` for sticky headers or modals.
- **Gradients:** Use subtle gradients for branding elements, e.g., `bg-gradient-to-r from-blue-600 to-indigo-600` for main logos or primary buttons (optional).

## 8. Design Architecture

### 8.1. Token System (Level 0)
The visual language is defined via Tailwind **v4 CSS Tokens**.
- **Definitions**: Tokens must be declared in `src/index.css` inside an `@theme` block. In v4, the `tailwind.config.js` is largely bypassed for core tokens in favour of CSS variables.
- **Dark Mode Syntax**: To support class-based dark mode in v4, a custom variant must be registered in CSS: `@custom-variant dark (&:where(.dark, .dark *));`.
- **Colors**: `primary`, `secondary`, `slate`, `error`.
- **Contrast Rule**: Critical brand elements (logos, primary button labels) should often use the `!` important modifier (e.g., `!text-white`) to override potential CSS cascade conflicts in the new engine.
- **Icons**: Use `strokeWidth={2.5}` or `3` for branding/logo icons to maintain visibility on medical interfaces.

**Rule:** Do not hardcode hex values in components. Always use tokens. Favour plain backgrounds for high-utility flows (Login, Search) to avoid accessibility issues. 

**Pro-Tip (v4 Visibility):** If text in a primary button is invisible, ensure you use `!text-white` and consider wrapping the label in a `<span>` with the same class. This overrides the shadow-root/cascade issues in themed Electron environments.

### 8.2. Atomic Component Layer (Level 1)
Located in `src/components/ui/`.
- **Responsibility:** Enforce Token usage and ensure visual consistency.
- **Characteristics:**
  - **Stateless:** Generally dumb components (presentation only).
  - **Composition:** Use `children` or props for content.
  - **Style Isolation:** Encapsulate complex Tailwind strings here to keep business code clean.
  - **Examples:** `Button.tsx`, `Card.tsx`, `Input.tsx`, `Badge.tsx`.

### 8.3. Theming Engine
- **Strategy**: Class-based dark mode using the `.dark` class.
- **V4 Requirement**: Requires the explicit `@custom-variant dark` directive in the main CSS file to enable `dark:` utility prefixes when the class is present.
- **Implementation**: `AppShell` or a dedicated ThemeProvider toggles the `.dark` class on the `<html>` or `<body>` element.
- **Consistency**: Use semantic tokens to ensure automatic adaptation between themes.
