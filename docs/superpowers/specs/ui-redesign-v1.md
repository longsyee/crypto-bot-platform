# NexusBot UI Redesign — Design Specification v1

> Status: Spec Ready for Review  
> Created: 2026-06-02  
> Mockup: `docs/design-mockup/index.html` (open in browser)  

---

## 1. Executive Summary

This document specifies a premium redesign of the NexusBot trading platform. The goal is to elevate the UI from a functional dark-mode dashboard to an **awwwards-tier fintech experience** while **preserving every existing feature and page structure**.

**What changes:** Visual design system (colors, typography, spacing, animations), component styling, mobile responsiveness.  
**What does NOT change:** Page count, feature set, data flow, routing, API contracts, business logic.

---

## 2. Current State Audit

| Page | Current Issues |
|------|---------------|
| **Dashboard** | Good structure but inconsistent card styling between light/dark modes |
| **Wallet, Profile, Settings, Referrals** | **Hardcoded dark surfaces** — `bg-[#13161f]/80` without `dark:` prefixes breaks light mode |
| **Settings** | Dark-mode toggle is decoupled from global `useTheme()` hook |
| **Root `/`** | Visually outdated, uses `bg-gray-800` without dark variants |
| **Auth pages** | Branding inconsistency: "CryptoBot Platform" vs "NexusBot" on different pages |
| **Bot Detail** | Newly enhanced with live price + floating PnL; layout is solid |
| **Sidebar** | Fixed 260px on desktop, no collapsible/mini state |
| **Mobile** | Sidebar overlay works but lacks bottom-sheet feel; some tables overflow |
| **Notification dropdown** | Safe width but could touch edges on very small phones |

**Mobile responsive issue confirmed:** The screenshot shows the sidebar overlay not fully covering content on mobile/tablet. The main content area should be properly constrained when the sidebar is open.

---

## 3. Design Principles

| # | Principle | Application |
|---|-----------|-------------|
| 1 | **Depth through layering** | Every surface has a purpose: base → elevated → card → hover. Never flat. |
| 2 | **Color tells the story** | Green = long/profit, red = short/loss, blue = primary action, amber = warning/paused. |
| 3 | **Numbers are first-class** | All prices, PnL, percentages use JetBrains Mono with tabular-nums. |
| 4 | **Motion with meaning** | GSAP reveals on scroll, hover micro-interactions, never gratuitous. |
| 5 | **Dark is default, light is refined** | Dark mode is the power-user default. Light mode must be equally polished, not an afterthought. |
| 6 | **Mobile is not a shrink** | Cards stack, tables scroll horizontally, sidebar becomes a sheet, touch targets ≥ 44px. |
| 7 | **Consistency over novelty** | Same card style, same badge style, same table style across every page. |

---

## 4. Color System

### Dark Mode (Default)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base` | `#030712` | Body background |
| `bg-elevated` | `#0a0f1a` | Sidebar, header backdrop |
| `bg-card` | `#0f1525` | Card surfaces |
| `bg-hover` | `#141d2e` | Hover states, input backgrounds |
| `bg-pressed` | `#1a2438` | Active/pressed states |
| `text-primary` | `#f8fafc` | Headings, primary numbers |
| `text-secondary` | `#94a3b8` | Labels, descriptions |
| `text-muted` | `#64748b` | Meta text, timestamps |
| `primary` | `#60a5fa` | Buttons, links, active nav |
| `primary-glow` | `rgba(96,165,250,0.15)` | Card glows, focus rings |
| `success` | `#34d399` | Long, profit, completed |
| `success-glow` | `rgba(52,211,153,0.15)` | Green card borders |
| `danger` | `#f87171` | Short, loss, failed |
| `danger-glow` | `rgba(248,113,113,0.15)` | Red card borders |
| `warning` | `#fbbf24` | Amber badges, warnings |
| `warning-glow` | `rgba(251,191,36,0.15)` | Amber borders |
| `border-subtle` | `rgba(148,163,184,0.08)` | Default dividers |
| `border-default` | `rgba(148,163,184,0.12)` | Hover/active borders |

### Light Mode

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-base` | `#f8fafc` | Body background |
| `bg-elevated` | `#ffffff` | Sidebar, header |
| `bg-card` | `#ffffff` | Cards |
| `bg-hover` | `#f1f5f9` | Hover, inputs |
| `bg-pressed` | `#e2e8f0` | Active states |
| `text-primary` | `#0f172a` | Headings |
| `text-secondary` | `#475569` | Body text |
| `text-muted` | `#94a3b8` | Meta |
| `primary` | `#2563eb` | Actions |
| `primary-glow` | `rgba(37,99,235,0.15)` | Focus rings |
| `success` | `#059669` | Profit |
| `danger` | `#dc2626` | Loss |
| `warning` | `#d97706` | Warning |
| `border-subtle` | `rgba(148,163,184,0.15)` | Dividers |
| `border-default` | `rgba(148,163,184,0.25)` | Hover borders |

### Gradients (Logos, Icons)

| Name | Value | Usage |
|------|-------|-------|
| `gradient-teal` | `linear-gradient(135deg, #2dd4bf 0%, #059669 100%)` | Logo, primary CTAs |
| `gradient-blue` | `linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)` | Bot cards, info |
| `gradient-purple` | `linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)` | Special bots |
| `gradient-amber` | `linear-gradient(135deg, #fbbf24 0%, #d97706 100%)` | Warnings, paused |

---

## 5. Typography

### Font Stack

| Role | Family | Weights | Usage |
|------|--------|---------|-------|
| **Sans** | Inter | 400, 500, 600, 700 | UI text, labels, buttons |
| **Display** | Space Grotesk | 400, 500, 600, 700 | Page titles, logo, headings |
| **Mono** | JetBrains Mono | 400, 500, 600 | All numbers, prices, PnL, codes |

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display-lg` | 30px (1.875rem) | 700 | 1.2 | Page titles (Dashboard, Bots) |
| `display-md` | 24px (1.5rem) | 600 | 1.3 | Section headers |
| `heading` | 18px (1.125rem) | 600 | 1.4 | Card titles, bot names |
| `body` | 14px (0.875rem) | 400 | 1.5 | Paragraphs, descriptions |
| `label` | 12px (0.75rem) | 600 | 1.4 | Form labels, table headers |
| `caption` | 11px (0.6875rem) | 500 | 1.4 | Meta, timestamps |
| `mono-lg` | 24px | 600 | 1.2 | Stat numbers |
| `mono-md` | 14px | 500 | 1.4 | Table numbers, prices |
| `mono-sm` | 12px | 400 | 1.4 | Small numbers |

### Number Formatting

| Type | Format | Example |
|------|--------|---------|
| **Price** | 2 decimals, mono | `$48,250.00` |
| **PnL (positive)** | + prefix, green, 4 decimals | `+$245.8000` |
| **PnL (negative)** | − prefix, red, 4 decimals | `−$12.4000` |
| **Percentage** | 2 decimals, % suffix | `5.20%` |
| **Token amount** | 4 decimals, mono | `1,240.5000` |
| **Contract size** | 6 decimals, mono | `0.004200` |

---

## 6. Spacing System

### Base Unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Tight gaps, icon margins |
| `space-2` | 8px | Badge padding, small gaps |
| `space-3` | 12px | Icon + text gap, nav padding |
| `space-4` | 16px | Card internal padding, section gap |
| `space-5` | 20px | Large card padding |
| `space-6` | 24px | Section padding |
| `space-8` | 32px | Page gutters |
| `space-10` | 40px | Major section spacing |

### Layout

| Element | Value |
|---------|-------|
| **Sidebar width** | 260px (desktop) |
| **Header height** | 64px |
| **Page max-width** | 1200px (`max-w-6xl`) |
| **Page padding** | 16px mobile → 20px tablet → 24px desktop |
| **Card padding** | 16px–20px |
| **Card border-radius** | 16px (`rounded-2xl`) |
| **Button border-radius** | 12px (`rounded-xl`) |
| **Input border-radius** | 12px (`rounded-xl`) |
| **Badge border-radius** | 999px (`rounded-full`) |

---

## 7. Component Design

### 7.1 Cards

```
background: var(--bg-card)
border: 1px solid var(--border-subtle)
border-radius: 16px
padding: 20px
box-shadow: none (default), var(--shadow-lg) on hover
transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1)

Hover state:
  border-color: var(--border-default)
  box-shadow: var(--shadow-lg)
  transform: translateY(-1px)
```

**Glow variants** (for stat cards):
- `glow-blue`: `box-shadow: var(--shadow-glow-blue)`
- `glow-green`: `box-shadow: var(--shadow-glow-green)`
- `glow-red`: `box-shadow: var(--shadow-glow-red)`

### 7.2 Buttons

| Variant | Background | Text | Border | Shadow |
|---------|-----------|------|--------|--------|
| **Primary** | `var(--primary)` | White | None | `var(--shadow-glow-blue)` |
| **Ghost** | Transparent | `var(--text-secondary)` | `var(--border-subtle)` | None |
| **Danger** | `var(--danger)` | White | None | `var(--shadow-glow-red)` |

**Hover**: `filter: brightness(1.1)`, `translateY(-1px)`  
**Active**: `transform: scale(0.98)`  
**Height**: 40px (touch-friendly)  
**Padding**: 10px 20px

### 7.3 Tables

```
Header:
  font-size: 12px
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.03em
  color: var(--text-muted)
  padding: 12px 16px
  white-space: nowrap

Row:
  font-size: 14px
  padding: 14px 16px
  border-top: 1px solid var(--border-subtle)
  white-space: nowrap

Hover:
  background: var(--bg-hover)

Container:
  overflow-x: auto
  border-radius: 16px
  border: 1px solid var(--border-subtle)
```

### 7.4 Badges

```
display: inline-flex
align-items: center
gap: 6px
padding: 4px 10px
border-radius: 999px
font-size: 12px
font-weight: 600
letter-spacing: 0.02em
```

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Green | `var(--success-glow)` | `var(--success)` | `rgba(52,211,153,0.2)` |
| Red | `var(--danger-glow)` | `var(--danger)` | `rgba(248,113,113,0.2)` |
| Blue | `var(--primary-glow)` | `var(--primary)` | `rgba(96,165,250,0.2)` |
| Amber | `var(--warning-glow)` | `var(--warning)` | `rgba(251,191,36,0.2)` |

### 7.5 Inputs

```
background: var(--bg-hover)
border: 1px solid var(--border-subtle)
border-radius: 12px
padding: 12px 16px
font-size: 14px
color: var(--text-primary)
transition: all 0.2s ease

Focus:
  outline: none
  border-color: var(--primary)
  box-shadow: 0 0 0 3px var(--primary-glow)
```

### 7.6 Sidebar Navigation

```
Default:
  padding: 10px 14px
  border-radius: 12px
  color: var(--text-secondary)
  border: 1px solid transparent

Hover:
  background: var(--bg-hover)
  color: var(--text-primary)

Active:
  background: var(--bg-hover)
  color: var(--primary)
  border-color: var(--border-default)
  box-shadow: var(--shadow-glow-blue)
  left indicator: 3px solid var(--primary)
```

---

## 8. Animation Specification

### 8.1 Page Entrance (GSAP ScrollTrigger)

```javascript
gsap.to('.gsap-section', {
  opacity: 1,
  y: 0,
  duration: 0.6,
  ease: 'power3.out',
  scrollTrigger: {
    trigger: element,
    start: 'top 85%',
    toggleActions: 'play none none none',
  },
  stagger: 0.05,
});
```

**Initial state**: `opacity: 0`, `transform: translateY(24px)`  
**Applies to**: Every major section, card grid, table container

### 8.2 Sidebar Entrance

```javascript
gsap.fromTo(sidebar,
  { x: -40, opacity: 0 },
  { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.1 }
);
```

### 8.3 Header Entrance

```javascript
gsap.fromTo(header,
  { y: -20, opacity: 0 },
  { y: 0, opacity: 1, duration: 0.5, ease: 'power3.out', delay: 0.05 }
);
```

### 8.4 Card Hover

```css
transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
```

**Properties**: `border-color`, `box-shadow`, `transform`  
**Duration**: 300ms  
**Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (snappy, premium feel)

### 8.5 Nav Hover Micro-interaction

```javascript
gsap.to(navItem, { x: 4, duration: 0.25, ease: 'power2.out' });        // enter
gsap.to(navItem, { x: 0, duration: 0.3, ease: 'power2.out' });       // leave
gsap.to(glowElement, { opacity: 1, duration: 0.25 });                 // enter
gsap.to(glowElement, { opacity: 0, duration: 0.3 });                  // leave
```

### 8.6 Dropdown Open

```javascript
gsap.fromTo(dropdown,
  { opacity: 0, y: -6, scale: 0.97 },
  { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: 'power3.out' }
);
```

### 8.7 Mobile Sidebar

```css
transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
transform: translateX(-100%) → translateX(0)
```

**Overlay**: `opacity: 0 → 1`, `pointer-events: none → auto`, 200ms

### 8.8 Number Count-up (Admin stats, PnL displays)

```javascript
const proxy = { val: 0 };
gsap.to(proxy, {
  val: targetValue,
  duration: 0.8,
  ease: 'power2.out',
  onUpdate: () => setDisplay(proxy.val.toFixed(decimals)),
});
```

### 8.9 Capital Allocation Bars (Calculator)

```javascript
gsap.to(bar, {
  width: `${percentage}%`,
  duration: 0.6,
  ease: 'power2.out',
});
```

---

## 9. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| **Mobile** | < 640px | Sidebar hidden, hamburger menu, cards stack 1-col, tables scroll horizontally, touch targets ≥ 44px |
| **Tablet** | 640–1024px | Sidebar hidden, hamburger menu, cards stack 2-col, tables scroll |
| **Desktop** | > 1024px | Sidebar visible (260px), cards in grid, tables full-width |

### Mobile Sidebar Behavior

1. Sidebar is `fixed`, off-canvas (`translateX(-100%)`)
2. Hamburger button `fixed` top-left, `z-index: 2000`
3. Overlay backdrop: `bg-black/60 backdrop-blur-sm`
4. When open: `translateX(0)`, overlay visible, body scroll locked
5. Nav item click: auto-close sidebar
6. Escape key: close sidebar

### Mobile Content Behavior

- Main content has `overflow-x-hidden` to prevent horizontal bleed
- Cards always full-width with internal padding
- Stats grid: 1 col mobile → 2 col tablet → 4 col desktop
- Bot cards: 1 col mobile → 2 col desktop
- Calculator: inputs stack above results on mobile

---

## 10. Mobile Navbar Fix (Current Issue)

**Problem**: On mobile/tablet, the main content area doesn't properly constrain when the sidebar opens, causing layout overlap.

**Solution applied in commit `d3e268a`**:

1. **`__root.tsx`**: Added `overflow-x-hidden` to `<main>`:
   ```tsx
   <main className="flex-1 p-4 sm:p-5 lg:p-6 overflow-x-hidden overflow-y-auto ...">
   ```

2. **`sidebar.tsx`**: Added `will-change-transform` for GPU acceleration:
   ```tsx
   <aside className="... will-change-transform ...">
   ```

**Additional recommended fixes**:

3. Ensure the sidebar overlay has `z-index: 1500` and main content stays below it when sidebar is open.
4. Add `touch-action: pan-y` to main content to prevent horizontal swipe conflicts with sidebar.

---

## 11. Page-by-Page Redesign Notes

### Dashboard
- Stats cards: use `glow-*` variants for primary metrics
- Activity feed: card with `overflow-hidden`, internal `divide-y`
- Recent transactions: table inside card

### Bots List
- Bot cards: gradient icon badges (teal/blue/purple/amber)
- Status badges: green (running), amber (paused), red (stopped)
- Quick actions: ghost buttons inside each card
- Filter tabs: pill-style segmented control

### Bot Detail
- **Capital Breakdown**: 4-column grid on desktop, 2 on tablet, 1 on mobile
- **Position Cards**: `pos-long` (green border + tint) / `pos-short` (red border + tint)
- **Live Market Price**: blue-tinted card to distinguish from calculated values
- **Floating PnL**: real-time computed, green/red based on sign
- **Orders/Logs/Activity**: tabs with consistent underline active indicator

### DCA Calculator
- **Inputs panel**: 400px fixed on desktop, full-width on mobile
- **Direction selector**: 3-way segmented button (long/short/both)
- **Leverage + Margin Type**: side-by-side on desktop, stacked on mobile
- **Results**: summary banner → analytics cards → capital bars → levels table
- **Bars**: blue for base, teal for safety orders, animated width on change

### Wallet
- Balance cards: 3-column grid, glow variants
- Action buttons: primary (deposit) + ghost (withdraw, convert)
- Transaction table: type icon + amount (colored) + badge status

### Auth Pages
- Split layout: left panel (brand + illustration), right panel (form)
- Form card: `auth-card` style with elevated shadow
- Inputs: dark-agnostic (work in both modes)
- Branding: consistent "NexusBot" everywhere

### Admin
- Stat cards: count-up animation on load
- Tables: dense but readable, status badges
- Actions: ghost buttons with icon + label

### Settings
- **CRITICAL**: Connect dark-mode toggle to global `useTheme()` hook
- Remove local `useState(true)` and use `const { theme, toggle } = useTheme()`
- Cards: same as dashboard
- Toggle switches: custom styled, not browser default

---

## 12. Implementation Checklist

### Phase 1: Foundation
- [ ] Update `tailwind.config.ts` with CSS variable strategy for dark/light
- [ ] Refactor `index.css` to use CSS custom properties (`:root` / `.dark`)
- [ ] Update `use-theme.ts` to toggle class on `<html>` + sync with localStorage
- [ ] Add Google Fonts (Inter, Space Grotesk, JetBrains Mono) to `index.html`

### Phase 2: Global Components
- [ ] Redesign `Sidebar` with new nav item styling + active indicator
- [ ] Redesign `Header` with new backdrop blur + wallet chip
- [ ] Redesign `PageWrapper` with updated GSAP scroll trigger config
- [ ] Update `Card` component (if shadcn) or global `.card` class

### Phase 3: Pages (one by one)
- [ ] Dashboard: stat cards + activity feed
- [ ] Bots List: bot cards + filter tabs
- [ ] Bot Detail: capital breakdown + position cards + live price
- [ ] DCA Calculator: inputs + results panels
- [ ] Wallet: balances + transactions
- [ ] Auth: login/register/forgot/reset (consistent branding)
- [ ] Settings: fix dark mode toggle
- [ ] Profile + Referrals: remove hardcoded dark colors, add `dark:` variants

### Phase 4: Polish
- [ ] Verify all pages in light mode
- [ ] Verify all pages in dark mode
- [ ] Mobile test: iPhone SE width (375px)
- [ ] Tablet test: iPad width (768px)
- [ ] Desktop test: 1440px+
- [ ] Check touch targets (all buttons ≥ 44px)
- [ ] Verify table horizontal scroll on mobile
- [ ] Test GSAP animations don't jank on low-end devices

---

## 13. Mockup Reference

**File**: `docs/design-mockup/index.html`

Open this file in any browser to see the complete redesign mockup. It includes:
- Sidebar + Header with theme toggle
- Dashboard stats + activity
- Bots list with cards
- Bot detail with capital breakdown + position card + live price
- DCA Calculator with inputs + results
- Wallet with balances + transactions
- Auth pages (login + register)
- Mobile responsive behavior (resize browser to test)
- Dark/light mode toggle (bottom-right floating button)
- GSAP scroll animations

---

## 14. Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/index.css` | CSS variable system, dark/light base styles |
| `apps/web/tailwind.config.ts` | Add CSS variable colors to Tailwind config |
| `apps/web/index.html` | Add Google Fonts |
| `apps/web/src/styles/design-tokens.ts` | Update tokens to match spec |
| `apps/web/src/components/layout/sidebar.tsx` | New nav styling, active indicator |
| `apps/web/src/components/layout/header.tsx` | New blur, wallet chip, dropdown styling |
| `apps/web/src/routes/__root.tsx` | Layout spacing, overflow fixes |
| `apps/web/src/routes/dashboard.tsx` | Stat cards, activity feed styling |
| `apps/web/src/routes/bots/index.tsx` | Bot cards, filter tabs |
| `apps/web/src/routes/bots/$botId.tsx` | Capital cards, position cards (already updated) |
| `apps/web/src/routes/calculator.tsx` | Calculator layout (reuse `dca-calculator.tsx`) |
| `apps/web/src/routes/wallet.tsx` | Balance cards, transaction table |
| `apps/web/src/routes/login.tsx` | Consistent branding, centered layout |
| `apps/web/src/routes/register.tsx` | Consistent branding |
| `apps/web/src/routes/settings.tsx` | Fix dark mode toggle, add `dark:` variants |
| `apps/web/src/routes/profile.tsx` | Add `dark:` variants |
| `apps/web/src/routes/referrals.tsx` | Add `dark:` variants |
| `apps/web/src/components/ui/badge.tsx` | Update badge styling |
| `apps/web/src/components/ui/card.tsx` | Update card styling |
| `apps/web/src/components/ui/button.tsx` | Update button variants |

---

*End of Design Specification v1.*

To implement: work through the checklist page by page. The mockup at `docs/design-mockup/index.html` is the visual reference — match it as closely as possible while keeping all existing functionality intact.
