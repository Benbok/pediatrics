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

### Responsive Layout Principles (CRITICAL)
All pages and components must be optimized to prevent horizontal scrolling and adapt to different screen sizes.

**Core Rules:**
1. **No Horizontal Overflow:** Pages must never cause horizontal scrolling. Use `overflow-x-hidden` on main containers.
2. **Flexible Widths:** Replace fixed widths (`w-56`, `w-40`) with max-widths (`max-w-[14rem]`, `max-w-full`) for responsive behavior.
3. **Min-Width Zero:** Add `min-w-0` to flex containers to allow proper text truncation and prevent overflow.
4. **Text Wrapping:** Use `break-words` on text elements that may contain long content.
5. **Responsive Flex:** Use `flex-col sm:flex-row` pattern for mobile-first responsive layouts.
6. **Flex Wrap:** Add `flex-wrap` to button groups and badge containers to prevent overflow on small screens.

**Implementation Pattern:**
```tsx
// Main container
<div className="space-y-6"> {/* No restrictive max-width or padding */}
  
  // Header with responsive layout
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div className="flex items-center gap-3 min-w-0">
      <div className="shrink-0">{/* Avatar */}</div>
      <div className="min-w-0">
        <h1 className="break-words">{/* Title */}</h1>
        <div className="flex-wrap">{/* Badges */}</div>
      </div>
    </div>
    <div className="flex gap-2 flex-wrap">{/* Actions */}</div>
  </div>
  
  // Content cards with proper constraints
  <div className="overflow-hidden"> {/* Prevent content overflow */}
    <div className="flex flex-col sm:flex-row gap-4 min-w-0">
      <div className="flex-1 min-w-0">
        <h3 className="break-words">{/* Long text */}</h3>
      </div>
      <div className="w-full max-w-full sm:max-w-[14rem]">
        {/* Fixed-width controls on desktop, full-width on mobile */}
      </div>
    </div>
  </div>
</div>
```

**Common Issues & Solutions:**
- **Problem:** Cards with form controls cause horizontal scroll on mobile
- **Solution:** Use `w-full max-w-full sm:max-w-[Xrem]` instead of `w-full sm:w-X`
- **Problem:** Long text in flex containers causes overflow
- **Solution:** Add `min-w-0` to parent flex container and `break-words` to text elements
- **Problem:** Button groups wrap awkwardly
- **Solution:** Use `flex-wrap` or `flex-col sm:flex-row` with `gap-2`

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

### Collapsible Card Components
For large sections that might clutter the interface, use collapsible cards that are collapsed by default.

#### **Collapsible Card Structure**
```tsx
<Card className="p-0 space-y-0">
  <button 
    className="w-full flex items-center gap-3 p-6 cursor-pointer 
               hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors"
    onClick={() => setIsExpanded(!isExpanded)}
    aria-expanded={isExpanded}
  >
    <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
      <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
    </div>
    <h3 className="text-lg font-semibold text-slate-900 dark:text-white text-left flex-1">
      Section Title
    </h3>
    {isExpanded ? (
      <ChevronDown className="w-5 h-5 text-slate-500 dark:text-slate-400" />
    ) : (
      <ChevronRight className="w-5 h-5 text-slate-500 dark:text-slate-400" />
    )}
  </button>

  {isExpanded && (
    <div className="px-6 pb-6 space-y-6">
      {/* Content */}
    </div>
  )}
</Card>
```

**Key properties:**
- **Default state**: `useState(false)` - collapsed by default
- **Card styling**: `p-0 space-y-0` to avoid double padding
- **Header button**: Full-width clickable area with hover effect
- **Expand icon**: ChevronDown when expanded, ChevronRight when collapsed
- **Smooth transition**: Hover effects with `transition-colors`
- **Accessibility**: `aria-expanded` attribute for screen readers
- **Visual separation**: Different background on hover for clear affordance

**When to use:**
- Large forms with multiple sections
- Sections that are not always relevant
- Content that can be grouped logically
- Sections that take significant vertical space

**Benefits:**
- Reduces initial page clutter
- Improves focus on main content
- Saves vertical space initially
- Allows users to expand only needed sections
- **Active:** 
  - Bg: `bg-blue-600` (solid color, not gradient)
  - Text/Icon: `!text-white` (MUST use `!` modifier for Electron)
  - Shadow: `shadow-lg shadow-blue-500/30`
  - Icon strokeWidth: `2.5`
  - Shows icon + label
- **Inactive:**
  - Bg: `bg-white dark:bg-slate-900`
  - Border: `border border-slate-200 dark:border-slate-700`
  - Text/Icon: `text-slate-600 dark:text-slate-400`
  - Hover: `hover:bg-slate-100 dark:hover:bg-slate-800`
  - Shows icon + label
- **Completion Badge:**
  - Small green dot: `w-2.5 h-2.5 bg-green-500 rounded-full`
  - Positioned: `absolute -top-1 -right-1`

#### **Progress Indicator:**
- Positioned at end: `ml-auto` with `border-l` separator
- Bar: `w-24 h-2` with rounded full
- Background: `bg-slate-200 dark:bg-slate-700`
- Progress fill: `bg-blue-600` (solid, not gradient)
- Shows label: "Прогресс" + count (e.g., "5/10")

### Page Animations (CRITICAL RULE)
**DO NOT** use page-level animations (`animate-in`, `fade-in`, `slide-in-from-bottom`) on main page containers.

**Rationale:**
- Page animations create perceived latency and make the app feel slower
- Users expect instant navigation between pages
- Animations should be reserved for modals, tooltips, and contextual elements

**Rule:**
```tsx
// ❌ BAD - Don't animate entire pages
<div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
  {/* Page content */}
</div>

// ✅ GOOD - No animation on page container
<div className="space-y-6">
  {/* Page content */}
</div>

// ✅ GOOD - Animate individual cards if needed
<Card className="animate-in fade-in duration-300">
  {/* Card content */}
</Card>
```

**Exceptions:**
- Modals and dialogs: Use smooth fade-in + scale animations
- Toast notifications: Use slide-in from appropriate edge
- Dropdown menus: Use subtle fade + slide animations
- Loading states: Use pulse or spin animations

### Navigation Behavior
**Back/Close Button Rules:**
- Navigation buttons should return to the most contextually relevant page
- "Close" buttons on detail pages (e.g., Vaccination, Visit History) should navigate to the parent detail page (Patient Details), not the top-level list
- Example: Vaccination page "Close" → Patient Details (not Patients List)

**Implementation:**
```tsx
// ❌ BAD - Returns to top-level list
<button onClick={() => navigate('/patients')}>Закрыть</button>

// ✅ GOOD - Returns to parent detail page
<button onClick={() => navigate(`/patients/${child.id}`)}>Закрыть</button>
```

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

### Compact Recommendation Cards (Browser Pattern)
Used for displaying recommendations with quick access to full browser/reference. Examples: "Диагностика", "Препараты для лечения".

- **Structure:**
  - **Header:** Title + "Справочник" button in top-right corner.
  - **Content:** Compact list showing first 2-3 items.
  - **Overflow:** "+ ещё N..." link to open full browser.

- **Header Layout:**
```jsx
<div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
        <Icon className="w-5 h-5 text-{color}-500" />
        Title
    </h2>
    <Button variant="secondary" size="sm" className="rounded-xl">
        <Search className="w-4 h-4 mr-1" />
        Справочник
    </Button>
</div>
```

- **Compact Item (List Style):**
```jsx
<div className={`p-2 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all ${
    isSelected 
        ? 'bg-{color}-50 dark:bg-{color}-950/20 border border-{color}-200 dark:border-{color}-800' 
        : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
}`}>
    <div className="flex items-center gap-2 flex-1 min-w-0">
        <Icon className="w-4 h-4 text-{color}-500 flex-shrink-0" />
        <span className="text-sm text-slate-800 dark:text-white truncate font-medium">
            {item.name}
        </span>
    </div>
    {isSelected ? (
        <CheckCircle2 className="w-4 h-4 text-{color}-500 flex-shrink-0" />
    ) : (
        <Plus className="w-4 h-4 text-slate-400 flex-shrink-0" />
    )}
</div>
```

- **Overflow Link:**
```jsx
{items.length > maxVisible && (
    <button
        onClick={openBrowser}
        className="text-xs text-{color}-600 hover:text-{color}-700 dark:text-{color}-400 dark:hover:text-{color}-300 pl-6"
    >
        + ещё {items.length - maxVisible}...
    </button>
)}
```

- **Color Themes:**
  - **Diagnostics (Lab):** `blue` - `bg-blue-50`, `text-blue-500`, etc.
  - **Diagnostics (Instrumental):** `purple` - `bg-purple-50`, `text-purple-500`, etc.
  - **Medications:** `teal` - `bg-teal-50`, `text-teal-500`, etc.

- **Browser Modal (Full Reference):**
  - **Animation:** `transition-all duration-300 ease-out`, `hover:scale-[1.02]`, `active:scale-[0.98]`.
  - **Selected State:** Green border + background, changes to red on hover for removal.
  - **Gradient Overlay:** Subtle gradient appears on hover (`bg-gradient-to-br from-{color}-50/50`).
  - **Status Badges:** Smooth transition between "Добавлено" (green) and "Убрать" (red) using opacity/scale.
  - **Icon Container:** Rounded background (`p-1.5 rounded-lg bg-{color}-100 dark:bg-{color}-900/40`).

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

### Form Page Headers (Complex Forms)
For complex multi-section forms (e.g., Visit Form, Patient Form), use a **two-row sticky header** with clear hierarchy.

#### **Structure:**
```tsx
<div className="sticky top-6 z-30 bg-white/90 dark:bg-slate-900/90 
                backdrop-blur-xl rounded-[32px] border border-slate-200/50 
                shadow-xl">
  {/* Top Row: Actions & Status */}
  <div className="flex items-center justify-between p-4 pb-3 border-b">
    <div className="flex items-center gap-3">
      {/* Back button + Status badge */}
    </div>
    <div className="flex items-center gap-2">
      {/* Action buttons: Ghost → Secondary → Primary */}
    </div>
  </div>
  
  {/* Bottom Row: Context & Identity */}
  <div className="px-5 py-4 flex items-center justify-between min-w-0">
    {/* Icon badge + Title + Entity info */}
    {/* Metadata pills (date, age, status, etc.) */}
  </div>
</div>
```

#### **Top Row (Actions & Status):**
- **Left:** Back button + Visual divider + Status badge
- **Right:** Action buttons in hierarchy order (ghost → secondary → primary)
- **Button Heights:** Consistent `h-10` for all header buttons
- **Spacing:** `gap-2` between buttons, `gap-3` in left group

#### **Bottom Row (Context & Identity):**
- **Left:** 
  - Icon badge: `w-12 h-12 rounded-2xl bg-blue-600` (use solid color, NOT gradient for Electron reliability)
  - Icon with `strokeWidth={2.5}` for clarity
  - **Icon color MUST be `!text-white`** (critical for Electron visibility)
  - Shadow: `shadow-lg shadow-blue-500/25` for depth
  - Title + semantic label for entity name
- **Right:**
  - Metadata pills with icons: `bg-slate-50 dark:bg-slate-800/50 rounded-xl border`
  - Visual dividers between metadata items: `w-px h-4 bg-slate-300 dark:bg-slate-600`
  - Color-coded badges for semantic data (gender, status, etc.)

#### **Visual Properties:**
- **Glassmorphism:** `bg-white/90` + `backdrop-blur-xl` for premium depth
- **Rounded Corners:** `rounded-[32px]` for medical-grade polish
- **Shadow:** `shadow-xl shadow-slate-900/5` for subtle elevation
- **Border Opacity:** `border-slate-200/50` for soft definition

#### **Responsive Behavior:**
- Use `min-w-0` on flex containers to prevent overflow
- Title truncates with `truncate` class
- Metadata pills can wrap with `flex-wrap`
- Action buttons maintain hierarchy even when wrapping

#### **Status Badge:**
- Completed: `variant="success"` with checkmark icon
- Draft/In-Progress: `variant="default"` with appropriate text
- Location: Left side of top row, after divider

#### **Action Button Priority:**
1. **Primary** (Complete/Submit): Blue with `!text-white`, `shadow-lg shadow-primary-500/25`
2. **Secondary** (Save Draft): Outlined style, medium emphasis
3. **Ghost** (Print, Additional actions): Minimal style, lowest emphasis

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

### Layout System Architecture

**AppShell Container Rules:**
The main application shell (`AppShell.tsx`) must enforce overflow constraints to prevent horizontal scrolling.

**Critical Classes:**
```tsx
// Root container
<div className="min-h-screen ... overflow-x-hidden">
  
  // Main content area
  <div className="flex-1 flex flex-col ... overflow-x-hidden min-w-0">
    
    // Content wrapper
    <main className="flex-1 p-8 overflow-y-auto overflow-x-hidden">
      
      // Max-width container
      <div className="max-w-7xl mx-auto min-w-0">
        <Outlet /> {/* Page content */}
      </div>
    </main>
  </div>
</div>
```

**Key Points:**
1. `overflow-x-hidden` must be applied at multiple levels to prevent cascade issues
2. `min-w-0` on flex containers allows content to shrink below content size
3. `max-w-7xl` provides reasonable content width while `min-w-0` allows shrinking
4. `overflow-y-auto` on main allows vertical scrolling while blocking horizontal

### Page Layout Consistency

**Standard Page Structure:**
All feature pages (Patients, Visits, Vaccination, etc.) should follow consistent spacing and container rules.

```tsx
// ✅ CORRECT - No extra containers or padding
export const FeaturePage = () => {
  return (
    <div className="space-y-6"> {/* Only spacing between sections */}
      <header>...</header>
      <section>...</section>
      <section>...</section>
    </div>
  );
};

// ❌ INCORRECT - Extra padding/container causes layout issues
export const FeaturePage = () => {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* This creates inconsistent layouts and potential overflow */}
    </div>
  );
};
```

**Why:**
- AppShell already provides `p-8` padding and `max-w-7xl` constraint
- Additional containers create nested constraints that can cause overflow
- Consistent `space-y-6` provides visual rhythm without layout issues

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
2. **Gradient vs Solid (CRITICAL for Electron):** For critical colorful elements (like Icon Badges, Gender Avatars), **ALWAYS use Explicit Solid Colors** (`bg-blue-600`) instead of theme gradients (`bg-gradient-to-br from-primary-500 to-primary-600`). 
   - **Rationale:** Gradients may not render properly in Electron environments due to variable resolution issues and theme conflicts.
   - **Icons on colored backgrounds:** MUST use `!text-white` with solid background color (e.g., `bg-blue-600` + `!text-white`).
   - **Verified working pattern:** `<div className="bg-blue-600"><Icon className="!text-white" /></div>`

### 8.4. Accessibility & Contrast Standards
To avoid "blind" elements and unreadable text:
1. **Never** use light text on light backgrounds (e.g., White on Primary-100).
2. **Standard Buttons**: Primary buttons MUST use high-contrast text (`!text-white` on `bg-blue-600`). Always use the `!` important modifier for text color on colored button backgrounds.
3. **Colored Button Text Rule**: ALL buttons with colored backgrounds (indigo, teal, purple, etc.) MUST use `!text-white` to prevent text from blending with the background. This is especially critical in Electron environments where theme cascading can cause visibility issues.
4. **Icon Visibility Rule (CRITICAL)**: ALL icons inside colored backgrounds (buttons, badges, gradient containers) MUST use `!text-white` (with `!` important modifier). This includes:
   - Icons in primary/colored buttons: `<Icon className="w-4 h-4 !text-white" />`
   - Icons in gradient badges: `<Icon className="w-6 h-6 !text-white" strokeWidth={2.5} />`
   - Icons in colored pills/tags: `<Icon className="w-4 h-4 !text-white" />`
   - **Rationale:** Electron's CSS cascade can override icon colors, making them invisible on colored backgrounds.
5. **Filter Pills/Tags Rule**: Selected filter buttons with colored backgrounds (e.g., `bg-primary-600`) MUST use `!text-white` to ensure text visibility. This prevents the common issue where selected filter text becomes invisible due to CSS cascade conflicts in Electron themes.
6. **Contrast Validation**: Always check contrast using tools or WCAG standards during development.
7. **Visual Hierarchy**: Active states must be clearly distinguishable from inactive states through color contrast or borders.
8. **Icon Minimum Contrast**: Icons must maintain a minimum contrast of 3:1 against their background.

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

### Sticky Navigation Panels (Form Navigation)
For long forms with multiple sections (e.g., Visit Form), use **horizontal sticky navigation bar** positioned below the header with matching design style.

#### **Horizontal Navigation Bar (Below Form Header)**
```tsx
{/* Header card - not sticky */}
<div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl 
                rounded-[32px] border border-slate-200/50 
                dark:border-slate-800/50 shadow-xl shadow-slate-900/5">
  {/* Header content */}
</div>

{/* Sticky navigation - same style, smaller radius and height */}
<div className="sticky top-6 z-30">
  <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl 
                  rounded-[24px] border border-slate-200/50 
                  dark:border-slate-800/50 shadow-lg shadow-slate-900/5">
    <nav className="flex items-center gap-1 px-5 py-3 flex-wrap">
      <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs hidden sm:inline-block">{label}</span>
      </button>
      <div className="ml-auto">{/* progress */}</div>
    </nav>
  </div>
</div>
```

**Key properties:**
- **Layout**: Place navigation AFTER header, wrapped in `sticky top-6 z-30` container
- **Matching style**: Same glassmorphism, border, shadow as header
- **Smaller scale**: `rounded-[24px]` (vs `rounded-[32px]` on header), lower padding `py-3`
- **Same width**: No negative margins, naturally inherits parent width
- **Responsive wrapping**: `flex-wrap` allows items to wrap to next line if needed
- **Compact buttons**: `px-2 py-1.5` with `text-xs` and `w-3.5 h-3.5` icons
- **Mobile-friendly**: Text hidden on small screens (`hidden sm:inline-block`)
- **Progress at end**: `ml-auto` with visual separator

**Why this pattern:**
- Visual consistency with form header
- Compact height (py-3) doesn't waste vertical space
- Sticks to top-6 (same as header would stick)
- Same glassmorphism creates cohesive design
- No horizontal scroll - items wrap naturally
- Responsive text visibility (hidden on small screens)

**Navigation Button States:**
- **Active:** 
  - Bg: `bg-blue-600` (solid color, not gradient)
  - Text/Icon: `!text-white` (MUST use `!` modifier for Electron)
  - Shadow: `shadow-lg shadow-blue-500/30`
  - Icon strokeWidth: `2.5`
  - Shows icon + label
- **Inactive:**
  - Bg: `bg-white dark:bg-slate-900`
  - Border: `border border-slate-200 dark:border-slate-700`
  - Text/Icon: `text-slate-600 dark:text-slate-400`
  - Hover: `hover:bg-slate-100 dark:hover:bg-slate-800`
  - Shows icon + label
- **Completion Badge:**
  - Small green dot: `w-2.5 h-2.5 bg-green-500 rounded-full`
  - Positioned: `absolute -top-1 -right-1`

#### **Progress Indicator:**
- Positioned at end: `ml-auto` with `border-l` separator
- Bar: `w-24 h-2` with rounded full
- Background: `bg-slate-200 dark:bg-slate-700`
- Progress fill: `bg-blue-600` (solid, not gradient)
- Shows label: "Прогресс" + count (e.g., "5/10")
