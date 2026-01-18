# PediAssist Design System

This document describes the design language for PediAssist v2.0.
Our goal is to create a **Medical-Grade** yet **Modern** and **Premium** interface.
It should feel lightweight, trusted, and professional ("Apple-like" cleanliness with medical precision).

## 1. Design Principles

- **Clarity & Precision:** Information must be legible and organized. No clutter.
- **Trust & Calm:** Colors should be soothing but confident (Deep Blues, Clean Whites).
- **Modern Polish:** Subtle shadows, rounded corners, smooth transitions. Avoid harsh borders.
- **Feedback:** Interactive elements must respond instantly and clearly.
- **Accessibility:** All UI must be legible. Standard contrast ratio WCAG AA (4.5:1) is the minimum requirement for ALL text elements.

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

### Forms & Dashboards (New Standard)
For complex entity creation (e.g., New Patient), avoid modals. Use **Full-Page Sheets**.
- **Container:** `bg-white` (Light) / `bg-slate-900` (Dark), `rounded-[32px]`, `shadow-xl`.
- **Width:** `max-w-4xl` centered for optimal form readability.
- **Structure:** Numbered sections (e.g., "1. Basic Info") to guide the user.
- **Actions:** Primary actions separated by a horizontal divider at the bottom.

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
- **Colored Buttons (Custom Backgrounds):**
  - **CRITICAL RULE:** Any button with a colored background (e.g., `bg-indigo-600`, `bg-teal-600`, `bg-purple-600`, etc.) MUST use `!text-white` (with `!` important modifier) to ensure text visibility.
  - Example: `className="bg-indigo-600 hover:bg-indigo-700 !text-white font-bold"`
  - This prevents text from blending with the background in Electron themes and dark mode.
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
  - Height: `h-10` (Compact/Search) or **`h-14` (Primary Forms)**.
  - Bg: `bg-slate-50/50` (Default) -> `bg-white` (Focus).
  - Shadow: `shadow-sm` (Default) -> `shadow-none` (Focus) to reduce noise.
  - Icons: `text-slate-600` (Minimum to ensure search/user icons are visible).
  - Border: `border-slate-200` -> `border-primary-500` (Focus).
  - Radius: `rounded-xl` or `rounded-2xl` (for h-14 inputs).
- **Layout Rules:**
  - **Grids:** Use equal-width columns (e.g., `grid-cols-3` for Surname/Name/Patronymic).
  - **Typography:** Unified font size for all related fields. No mixtures of `text-lg` and `text-base`.
  - **Password Toggle:** Use `rightIcon` with `Eye/EyeOff` icons to allow visibility control.

### DatePicker (New)
Standardized component for all date-related entities.
- **Base:**
  - Height: `h-14` (matches premium inputs).
  - Radius: `rounded-2xl`.
  - Behavior: **Hybrid Input**. Users can type "DD.MM.YYYY" manually OR pick from calendar.
  - Validation: Auto-reverts to last valid date on blur if invalid.
  - Icon: `Calendar` icon on the right (`text-slate-400`).
- **Popover:**
  - Radius: `rounded-[24px]` (heavier rounding for floating elements).
  - Shadow: `shadow-2xl`.
  - Content: Russian localization, "Today" and "Clear" shortcuts.
  - Active Day: `bg-primary-600` with `shadow-primary-500/40`.

### Navigation (Sidebar)
- **Active Item:**
  - Bg: `bg-primary-50` (Light) / `bg-primary-900/20` (Dark)
  - Text: `text-primary-700` (Light) / `text-primary-300` (Dark)
  - Icon: `text-primary-600`
- **Inactive Item:**
  - Text: `text-slate-600`
  - Hover: `hover:bg-slate-100`

### Tabs (Navigation Pills)
Avoid rectangular standard tabs. Use the **Pill/Track** style for premium feel.
- **Track (TabsList):**
  - Bg: `bg-slate-100/80` (Light) / `bg-slate-800/40` (Dark).
  - Radius: `rounded-[22px]`.
  - Padding: `p-1.5`.
  - Layout: `h-auto inline-flex`.
- **Trigger (TabsTrigger):**
  - Radius: `rounded-2xl`.
  - Typography: `font-black text-[11px] uppercase tracking-[0.15em]`.
  - Icons: High-contrast `stroke-[2.5]` icons for a clinical look.
  - Active State: `bg-white` (Light) / `bg-slate-900` (Dark), `text-primary-600`, `shadow-xl shadow-primary-500/10`.
  - Transition: `duration-300` on state change.

### ConfirmDialog (Confirmation Modal)
Standardized modal for confirming user actions (deletions, critical operations).
- **Usage:** Replace all `window.confirm()` calls with this component for consistent UX.
- **Structure:**
  - **Overlay:** `bg-black bg-opacity-50`, full screen `fixed inset-0`, `z-50`.
  - **Container:** Centered with `flex items-center justify-center`.
  - **Dialog Box:**
    - Max width: `max-w-md` for optimal readability.
    - Bg: `bg-white` (Light) / `bg-slate-900` (Dark).
    - Border: `border border-slate-200` (Light) / `border-slate-800` (Dark).
    - Radius: `rounded-2xl`.
    - Shadow: `shadow-xl` for depth.
- **Animation:**
  - **Overlay:** Fade-in with `transition-opacity duration-300 ease-out animate-in fade-in`.
  - **Dialog:** Combined zoom and slide effect: `transform transition-all duration-300 ease-out animate-in fade-in zoom-in-95 slide-in-from-bottom-2`.
  - **Rationale:** Smooth, non-jarring appearance that draws attention without feeling abrupt.
- **Header:**
  - Icon: `AlertTriangle` from lucide-react, color varies by variant (danger/warning/info).
  - Title: `text-lg font-bold`, with variant-specific icon color.
  - Close button: `text-slate-400`, hover `text-slate-600`.
- **Body:**
  - Text: `text-slate-700` (Light) / `text-slate-300` (Dark).
  - Supports `whitespace-pre-line` for multi-line messages.
- **Footer:**
  - Actions: `flex items-center justify-end gap-3`.
  - Buttons: Secondary (Cancel) and Primary/Danger (Confirm) based on variant.
  - Button radius: `rounded-xl` for consistency.
- **Variants:**
  - **danger:** Red icon (`text-red-600 dark:text-red-400`), danger button variant for confirm.
  - **warning:** Yellow icon (`text-yellow-600 dark:text-yellow-400`), primary button.
  - **info:** Blue icon (`text-blue-600 dark:text-blue-400`), primary button.
- **Accessibility:**
  - Click outside (overlay) triggers cancel (standard modal pattern).
  - Click inside dialog does not close it (`stopPropagation`).
  - Escape key handling should be implemented at component usage level if needed.

### Filter Pills/Tags
Used for filtering content by categories (e.g., pharmacological groups, status filters).
- **Selected State (CRITICAL):**
  - Bg: `bg-primary-600` (Light) / `bg-primary-500` (Dark).
  - **Text: MUST use `!text-white` (with important modifier)** to ensure visibility in all Electron themes and prevent text color cascade issues.
  - Shadow: `shadow-md` for depth.
  - Hover: `hover:bg-primary-700`.
  - Example: `bg-primary-600 !text-white shadow-md hover:bg-primary-700 dark:bg-primary-500 dark:!text-white`
  - Focus: add `ring-2 ring-primary-400/40` (or similar) to keep outline visible in high contrast themes.
- **Unselected State:**
  - Bg: `bg-slate-100` (Light) / `bg-slate-800` (Dark).
  - Text: `text-slate-800` (Light) / `text-slate-200` (Dark) for high contrast.
  - Border: `border border-slate-300` (Light) / `border-slate-700` (Dark) for definition.
  - Hover: `hover:bg-slate-200` (Light) / `hover:bg-slate-700` (Dark).
- **Common Issues & Solutions:**
  - **Problem:** Selected filter text becomes invisible due to color cascade conflicts.
  - **Solution:** Always use `!text-white` (with `!` important) on selected filter buttons with colored backgrounds.
  - **Rationale:** Electron's theme system and CSS cascade can override text colors, making white text invisible on light backgrounds. The `!` modifier ensures text remains visible.

### Avatars (User Profiles)
- **Base:**
  - Size: `w-16 h-16` (List) or `w-24 h-24` (Profile).
  - Radius: `rounded-2xl` or `rounded-3xl` (Squircle).
  - Content: Initials of surname/name.
- **Color Logic (Vital):**
  - **Male:** Use `bg-blue-600` (Explicit). Avoid `bg-primary` gradients on critical avatars to ensure visibility in all Electron themes.
  - **Female:** Use `bg-rose-500` (Explicit).
  - **Text:** Always `text-white` with `font-black`.

## 6. Implementation Strategy

To create a consistent app, we will introduce a **Design System Component Library** in `src/components/ui/`.
This isolates styles and ensures uniformity.

New Components to Create:
1. `Button` (Variants: primary, secondary, ghost, danger)
2. `Input` (Text, Number, Date, with error states)
3. `DatePicker` (Custom premium calendar)
4. `Card` (Header, Content, Footer)
5. `Badge` (Status indicators)
6. `Avatar` (User profiles)
7. `ConfirmDialog` (Confirmation modal for user actions)

## 7. Motion & Aesthetics
- **Transitions:** `transition-all duration-200` on hover states.
- **Modal Animations:** Use smooth fade-in and scale animations for modal dialogs. Overlay fades in with `transition-opacity duration-300 ease-out`, dialog content uses `transform transition-all duration-300 ease-out` with inline styles for opacity (0→1) and transform (`scale(0.95) translateY(8px)` → `scale(1) translateY(0)`) for premium feel.
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

**Pro-Tip (v4 Visibility):** 
1. If text in a primary button is invisible, ensure you use `!text-white` and consider wrapping the label in a `<span>` with the same class. This overrides the shadow-root/cascade issues in themed Electron environments.
2. **Gradient vs Solid:** For critical colorful elements (like Gender Avatars), prefer **Explicit Solid Colors** (`bg-blue-600`) over theme gradients (`from-primary-500`). This avoids variable resolution issues in mixed dark/light contexts.

### 8.4. Accessibility & Contrast Standards
To avoid "blind" elements and unreadable text:
1. **Never** use light text on light backgrounds (e.g., White on Primary-100).
2. **Standard Buttons**: Primary buttons MUST use high-contrast text (`!text-white` on `bg-blue-600`). Always use the `!` important modifier for text color on colored button backgrounds.
3. **Colored Button Text Rule**: ALL buttons with colored backgrounds (indigo, teal, purple, etc.) MUST use `!text-white` to prevent text from blending with the background. This is especially critical in Electron environments where theme cascading can cause visibility issues.
4. **Filter Pills/Tags Rule**: Selected filter buttons with colored backgrounds (e.g., `bg-primary-600`) MUST use `!text-white` to ensure text visibility. This prevents the common issue where selected filter text becomes invisible due to CSS cascade conflicts in Electron themes.
5. **Contrast Validation**: Always check contrast using tools or WCAG standards during development.
6. **Visual Hierarchy**: Active states must be clearly distinguishable from inactive states through color contrast or borders.
7. **Icon Visibility**: Icons must maintain a minimum contrast of 3:1 against their background.

### 8.2. Atomic Component Layer (Level 1)
Located in `src/components/ui/`.
- **Responsibility:** Enforce Token usage and ensure visual consistency.
- **Characteristics:**
  - **Stateless:** Generally dumb components (presentation only).
  - **Composition:** Use `children` or props for content.
  - **Style Isolation:** Encapsulate complex Tailwind strings here to keep business code clean.
  - **Examples:** `Button.tsx`, `Card.tsx`, `Input.tsx`, `Badge.tsx`, `DatePicker.tsx`.

### 8.3. Theming Engine
- **Strategy**: Class-based dark mode using the `.dark` class.
- **V4 Requirement**: Requires the explicit `@custom-variant dark` directive in the main CSS file to enable `dark:` utility prefixes when the class is present.
- **Implementation**: `AppShell` or a dedicated ThemeProvider toggles the `.dark` class on the `<html>` or `<body>` element.
- **Consistency**: Use semantic tokens to ensure automatic adaptation between themes.
