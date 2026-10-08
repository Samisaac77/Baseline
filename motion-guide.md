# Baseline Motion Rules

## Core Principles
- **Easing:** `cubic-bezier(0.2, 0.7, 0.2, 1)`. Linear for ambient drift only.
- **Properties:** Animate transforms/opacity only. No layout shifts (exceptions: colors, backgrounds, `stroke-dashoffset`, filters, SVG attributes).
- **Accessibility:** Respect `prefers-reduced-motion` (snap to final state). Page readable at rest (no waiting at `opacity: 0`).
- **Architecture:** `motion.css` (timings/tokens), `motion.js` (behaviors).

## Component Behaviors
*Refer to the specific section code files for exact micro-timings, SVG data attributes, and scroll math.*

- **Nav bar:** Sticky drop-in. Links use spring text roll. Smooth anchor scrolling. Mobile burger opens a full-screen sheet (unrolls down, links rise in staggered, page scroll locked).
- **Hero:** Staggered blur rise, dither scramble H1, status pill scramble, grid drift. Dashboard tilts on scroll (CSS scroll-driven animation on the compositor where supported, JS fallback) and replays on entry. Phones (≤767px): mockup is a cropped 60%-scale card (Mobbin pattern); same tilt-in motion.
- **Integrations:** Staggered blur rise (35% visibility). Endless rAF marquee (stops on hover, finger-down or keyboard focus; a tap does not pause it). Keeps full speed at low frame rates (frame step capped at 1s).
- **Features:** Scroll-linked cards, sticky nav, declarative SVG illustrations (`data-float/pulse/glow`). Entrances trigger at 15% visibility. Stacked layouts (≤1100px): each card shows its title; the title arrow fades dimmed (20%) → black (500ms) when that card becomes active on scroll.
- **Trust badges:** Staggered dither reveal on text; a single shared progress loop drives all count-ups and accent bars.
- **How it works:** Cursor spotlight on grid, staggered text blur-rise, card scale/shadow hovers, and a unified CSS loop for step icons.
- **Why choose us:** Badge and card entrances via `useReveal` (15%). Baseline switch triggers coordinated thumb slide, card fade, staggered drum-style row swaps, and count-ups.
- **Testimonials:** Grid cursor spotlight. Text blur-rise, scrolling topic wheel offsets, and crossfade quote swaps. Autoplays every 5s while in view (no hover pause; pauses only for keyboard focus; a manual pick restarts the count). Reduced motion: no autoplay, instant swaps.
- **Pricing:** Entrances via `useReveal`. Toggle triggers switch slide, price tweens, and crossfades. Card and CTA hovers.
- **Footer:** Grid cursor spotlight, `useReveal` entrances, and H1-style dither reveal. Links use spring text roll; socials brighten on hover. SVG robot arm divider uses continuous rAF cycle (pauses off-screen; reduced motion snaps to static).