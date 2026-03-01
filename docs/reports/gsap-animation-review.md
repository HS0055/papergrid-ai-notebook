# GSAP & Animation System Review - PaperGrid Landing Page

**Date:** 2026-02-28
**Reviewer:** Frontend Animation Specialist
**Files Reviewed:** 14 files across `packages/web/src/`

---

## Executive Summary

The landing page animation system is a **well-structured hybrid approach** combining GSAP (hero orchestration) with CSS-driven scroll reveals (IntersectionObserver). The hero timeline is solid. The CSS reveal system is clean and performant. However, there are several gaps: no ScrollTrigger integration, no `prefers-reduced-motion` support, no page transition animation, redundant CSS keyframes, and missing micro-interactions that would elevate the page from good to premium.

**Overall Grade: B+** -- Strong foundation, needs targeted improvements.

---

## 1. GSAP Usage Quality

### 1.1 Hero Timeline (`LandingPage.tsx:26-60`)

**Verdict: Well-structured, good easing choices.**

```typescript
const heroTl = gsap.timeline({ delay: 0.1 });
heroTl
  .from('.hero-badge', { y: -20, opacity: 0, duration: 0.6, ease: 'power3.out' })
  .from('.hero-word', { y: 80, opacity: 0, duration: 1, stagger: 0.15, ease: 'power4.out' }, '-=0.3')
  .from('.hero-desc', { y: 20, opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.5')
  .from('.hero-btns', { y: 20, opacity: 0, duration: 0.8, ease: 'power3.out' }, '-=0.6')
  .from('.hero-mockup', { y: 60, opacity: 0, scale: 0.95, duration: 1.2, ease: 'power2.out' }, '-=0.8');
```

**Strengths:**
- Progressive easing escalation: `power3.out` for small elements, `power4.out` for headline words (more dramatic), `power2.out` for the large mockup (smoother, longer settle)
- Good stagger on `.hero-word` (0.15s) -- creates a word-by-word reveal that feels crafted
- Overlapping offsets (`-=0.3`, `-=0.5`, `-=0.6`, `-=0.8`) create a cascading reveal rather than sequential blocks
- The 80px Y-offset on headlines vs 20px on description creates proper visual hierarchy -- the bigger the element, the more dramatic the entrance

**Issues:**
- `delay: 0.1` is too short to be intentional. Either remove it (let it start immediately) or increase to `0.3-0.5` if waiting for font load is the goal
- The `.hero-mockup` has `scale: 0.95` which is good, but the combination of `y: 60 + scale: 0.95` creates a subtle but noticeable "zoom + slide" that could feel slightly heavy. Consider reducing to `y: 40` when combined with scale

**Recommendation:**
```typescript
const heroTl = gsap.timeline({ delay: 0.3 }); // or 0, but not 0.1
// ...
.from('.hero-mockup', {
  y: 40,           // reduced from 60 when combined with scale
  opacity: 0,
  scale: 0.96,     // slightly less dramatic
  duration: 1.2,
  ease: 'power2.out',
}, '-=0.8');
```

### 1.2 Floating Paper Animations (`LandingPage.tsx:63-75`)

**Verdict: Good concept, good performance choices.**

```typescript
gsap.to('.floating-paper', {
  y: 'random(-18, 18)',
  x: 'random(-8, 8)',
  rotation: 'random(-4, 4)',
  duration: 'random(2.5, 4.5)',
  repeat: -1,
  yoyo: true,
  ease: 'sine.inOut',
  stagger: { each: 0.7, from: 'random' },
});
```

**Strengths:**
- `sine.inOut` is the correct choice for idle/ambient animations -- it creates a natural breathing motion
- Randomized values prevent synchronization between cards (uncanny valley)
- `yoyo: true` with infinite repeat creates seamless back-and-forth
- The animation targets `y`, `x`, `rotation` -- all GPU-compositable transform properties (no layout thrash)
- Stagger `from: 'random'` ensures no two cards start at the same time

**Issues:**
- The random values are evaluated once at creation time, meaning each card gets a fixed path. Over time this can look repetitive. GSAP's `random()` with `repeatRefresh: true` would re-randomize on each cycle
- 4 floating papers on screen simultaneously with `repeat: -1` -- this is fine for performance but they never pause when scrolled out of view

**Recommendation:**
```typescript
gsap.to('.floating-paper', {
  y: 'random(-18, 18)',
  x: 'random(-8, 8)',
  rotation: 'random(-4, 4)',
  duration: 'random(2.5, 4.5)',
  repeat: -1,
  yoyo: true,
  repeatRefresh: true,  // re-randomize on each cycle
  ease: 'sine.inOut',
  stagger: { each: 0.7, from: 'random' },
});
```

### 1.3 `gsap.context()` Usage (`LandingPage.tsx:25, 76, 97-98`)

**Verdict: Correct and proper.**

```typescript
const ctx = gsap.context(() => { /* ... */ }, rootRef);
// ...
return () => { ctx.revert(); observer.disconnect(); };
```

- `gsap.context()` is scoped to `rootRef` -- all GSAP selectors (`.hero-badge`, `.floating-paper`, etc.) are resolved within this DOM subtree, not globally
- `ctx.revert()` in the cleanup function properly kills all animations and reverts inline styles
- This is the correct React 18+ pattern for GSAP cleanup

### 1.4 ScrollTrigger

**Verdict: Not used anywhere.**

GSAP is imported (`import { gsap } from 'gsap'`) but ScrollTrigger is not imported or registered in any file. The scroll reveal system uses a custom IntersectionObserver instead. This is a deliberate choice -- and a reasonable one, since ScrollTrigger adds ~12KB to the bundle. However, this means the project lacks scroll-linked animations (parallax, pinning, scrub-based progress).

---

## 2. CSS Animation System

### 2.1 Scroll Reveal Classes (`globals.css:186-228`)

**Verdict: Clean, performant, well-implemented.**

```css
.reveal {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}
.reveal[data-revealed="true"] {
  opacity: 1;
  transform: translateY(0);
}
```

**Strengths:**
- Uses `data-revealed` attribute instead of class toggling -- cleaner, no specificity wars
- `cubic-bezier(0.22, 1, 0.36, 1)` is an excellent ease -- fast start, gentle overshoot, smooth settle. This is essentially a custom `easeOutExpo` and creates that premium "Apple" feel
- Only animates `opacity` and `transform` -- both compositor-only properties, no layout or paint triggers
- Four variants (`.reveal`, `.reveal-scale`, `.reveal-left`, `.reveal-right`) cover all common reveal directions
- `transitionDelay` is applied inline via `style` props in components, enabling staggered reveals without JavaScript

**Issues:**
- The 32px translate distance is consistent across all variants, which is good for consistency but could benefit from responsive scaling -- 32px is large on mobile screens
- No `will-change` hints are applied, though browsers are generally smart enough to promote these elements during transition

### 2.2 IntersectionObserver Configuration (`LandingPage.tsx:83-93`)

```typescript
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.setAttribute('data-revealed', 'true');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
);
```

**Strengths:**
- `observer.unobserve(entry.target)` after reveal -- one-shot reveals, no re-triggering on scroll back up. This is the right choice for a landing page
- `rootMargin: '0px 0px -40px 0px'` -- elements must be 40px inside the viewport before triggering, preventing reveals at the very edge

**Issues:**
- `threshold: 0.08` (8% visible) is quite low. Elements will start revealing when barely visible. Consider `0.15` for a more deliberate feel
- No disconnection tracking for elements that might be in viewport on initial load -- though the `delay: 0.1` on the GSAP timeline partially handles this

### 2.3 CSS Keyframes vs GSAP Redundancy (`globals.css:234-277`)

**Verdict: Moderate redundancy exists.**

The following keyframes are defined:
- `fadeIn` / `fadeOut` -- used by `anim-fade-in`, `anim-fade-out`
- `slideInFromLeft` / `slideInFromRight` -- used by `anim-slide-left`, `anim-slide-right`
- `contentSwap` -- used by `anim-content-swap`
- `toastSlideIn` / `toastSlideOut` -- used by toast notifications

**Analysis:**
- `fadeIn`/`fadeOut` partially overlap with the `.reveal` system (both animate opacity + translateY)
- `slideInFromLeft`/`slideInFromRight` overlap with `.reveal-left`/`.reveal-right`
- The `anim-*` classes appear to be used for the **app view** page transitions (not the landing page), so they serve a different purpose than the scroll reveals
- Toast animations (`toastSlideIn`/`toastSlideOut`) are correctly separate -- these are event-driven, not scroll-driven

**Recommendation:** Keep the keyframes -- they serve the app view transitions and toasts, which are distinct from the landing scroll reveals. But add a comment block clarifying the separation:

```css
/* Landing page scroll reveals: .reveal, .reveal-scale, .reveal-left, .reveal-right */
/* App view page transitions: .anim-fade-in, .anim-slide-left, etc. */
/* Toast notifications: .toast-enter, .toast-exit */
```

---

## 3. Performance Analysis

### 3.1 Bundle Weight

- **GSAP on disk:** 6.3MB (includes all plugins, source maps, types)
- **GSAP core (minified+gzipped):** ~24KB
- **Version:** `^3.14.2` (latest stable, good)
- **Tree-shaking:** GSAP core (`gsap`) is a single import. Since no plugins (ScrollTrigger, Draggable, etc.) are imported, tree-shaking should be effective. The actual bundle contribution should be ~24KB gzipped

**Assessment:** Acceptable for the animation quality delivered. However, GSAP is only used for the hero section (one timeline + one floating animation). The cost-per-animation ratio is high. If GSAP were removed, the hero could be replicated with CSS animations, but would lose the timeline orchestration and `random()` capabilities that make it feel premium.

**Recommendation:** Keep GSAP. The 24KB cost is justified IF ScrollTrigger is added to the page (see Section 6). Without ScrollTrigger, GSAP is underutilized.

### 3.2 Layout Thrashing Risk

**Risk: Low.**

All animated properties across the codebase are compositor-friendly:
- `transform` (translateX, translateY, scale, rotate) -- compositor only
- `opacity` -- compositor only
- `box-shadow` transitions on hover (in Tailwind `hover:shadow-xl`) -- these DO trigger paint, but are scoped to hover interactions, not scroll

The floating paper cards use inline `style` for positioning (`top`, `left`, `right`, `bottom`), but these are static values, not animated. GSAP animates via `transform` internally.

### 3.3 Off-Screen Animation Management

**Issue: Floating papers animate indefinitely.**

The `gsap.to('.floating-paper')` with `repeat: -1` runs continuously even when the user has scrolled past the hero section. This wastes CPU cycles (though minimal since transforms are GPU-composited).

**Recommendation:** Pause floating animations when hero is off-screen:

```typescript
// In LandingPage.tsx useEffect
const floatingTween = gsap.to('.floating-paper', { /* ... */ });

const heroObserver = new IntersectionObserver(
  ([entry]) => {
    if (entry.isIntersecting) {
      floatingTween.play();
    } else {
      floatingTween.pause();
    }
  },
  { threshold: 0 }
);

const heroEl = rootRef.current?.querySelector('.hero-section');
if (heroEl) heroObserver.observe(heroEl);

return () => {
  ctx.revert();
  observer.disconnect();
  heroObserver.disconnect();
};
```

### 3.4 `backdropFilter: 'blur()'` Usage

Several components use `backdrop-blur`:
- `NavBar.tsx:21` -- `backdrop-blur-xl` on scroll
- `AIFeatureSection.tsx:104` -- `backdropFilter: 'blur(20px)'` on terminal mockup
- `TestimonialsSection.tsx:75` -- `backdropFilter: 'blur(10px)'` on cards

**Risk: Medium on low-end devices.** Backdrop blur is expensive. On the NavBar it is fine (always visible, small area). On testimonial cards (6 cards, each with blur), this could cause jank during scroll on older devices.

**Recommendation:** Consider removing `backdropFilter` from testimonial cards or gating it behind a media query:

```css
@media (min-resolution: 2dppx) {
  .testimonial-card { backdrop-filter: blur(10px); }
}
```

---

## 4. Animation Design Quality

### 4.1 Timing and Feel

| Animation | Duration | Easing | Assessment |
|-----------|----------|--------|------------|
| Hero badge | 0.6s | power3.out | Good -- quick, snappy |
| Hero words | 1.0s, stagger 0.15 | power4.out | Excellent -- dramatic, cinematic |
| Hero description | 0.8s | power3.out | Good |
| Hero buttons | 0.8s | power3.out | Good |
| Hero mockup | 1.2s | power2.out | Good -- heavy element, slow settle |
| Floating papers | 2.5-4.5s | sine.inOut | Excellent -- organic |
| Scroll reveals | 0.7s | cubic-bezier(0.22,1,0.36,1) | Excellent |
| Scale reveals | 0.6s | cubic-bezier(0.22,1,0.36,1) | Good |

**Overall feel: Premium and well-timed.** The easing choices are consistent and intentional. The hero feels cinematic. Scroll reveals are smooth without being slow.

### 4.2 Visual Hierarchy

The animation hierarchy is correct:
1. Badge (smallest, fastest -- orients the user)
2. Headline words (largest, most dramatic -- the hook)
3. Description (supporting text, subdued entrance)
4. Buttons (call to action -- appears after context is set)
5. Mockup (large visual proof -- arrives last as the payoff)

This matches the F-pattern reading flow and guides the eye downward.

### 4.3 Stagger Quality

- **Hero words:** 0.15s stagger -- tight enough to feel connected, loose enough to read each word. Good.
- **Paper style tiles:** 60ms stagger via `transitionDelay` -- creates a cascading grid fill. Effective.
- **BlockTypesBento cards:** 80ms stagger -- slightly slower than paper tiles, appropriate for larger cards.
- **Testimonials:** 80ms stagger -- matches the bento cards.
- **AI steps:** 150ms stagger -- longer delay for larger content blocks. Good.

### 4.4 Issues

1. **StatsStrip counter animation is missing.** The stats (`10+`, `infinity`, `12`, `4`) simply fade in. A counting-up animation would be much more engaging.

2. **AI prompt rotation (`AIFeatureSection.tsx:39-42`) has no transition animation.** The text swaps instantly every 2.4s. There should be a fade or typewriter effect.

```typescript
// Current: instant swap
setActivePromptIdx(i => (i + 1) % prompts.length);
```

3. **Testimonial cards lack entrance stagger on mobile.** The `marginTop: i % 3 === 1 ? '24px' : '0'` offset only works in the 3-column layout. On mobile (1-column), all cards appear at the same vertical position.

---

## 5. Missing Animations

### 5.1 Page Transition: Landing to App (CRITICAL)

Currently in `App.tsx:132-141`:

```typescript
const handleLaunchApp = () => {
  setIsLandingExiting(true);
  setTimeout(() => {
    setShowLanding(false);
    setIsDashboardEntering(true);
    localStorage.setItem('papergrid_landing_hide', 'true');
    setTimeout(() => setIsDashboardEntering(false), 600);
  }, 500);
};
```

This uses `setTimeout` chaining with boolean flags, but the `isLandingExiting` and `isDashboardEntering` states are defined but **no CSS classes or inline styles reference them in the render output**. The landing page simply unmounts after 500ms with no visual transition.

**This is the single biggest animation gap on the page.**

### 5.2 Accessibility: `prefers-reduced-motion` (CRITICAL)

**Not implemented anywhere.** No CSS media query, no JavaScript check. Users who have motion sensitivity will see all animations at full intensity.

### 5.3 Scroll-Triggered Parallax

No parallax effects exist on any section. The ambient glow blobs in HeroSection and AIFeatureSection are static.

### 5.4 Interactive Hover Micro-Interactions

Current hover effects are minimal Tailwind transitions:
- `hover:-translate-y-1` on cards (good but generic)
- `hover:shadow-xl` on cards
- `group-hover:translate-x-0.5` on arrow icons

Missing:
- Magnetic cursor effect on CTA buttons
- Tilt/perspective shift on paper style tiles
- Color shift on hover for the bento grid cards
- Parallax depth on floating papers (mouse movement)

### 5.5 Number Counter Animation

The StatsStrip section shows `10+`, `infinity`, `12`, `4` as static text. These should count up when revealed.

### 5.6 AI Prompt Typewriter Effect

The AI prompt text in `AIFeatureSection.tsx:117-119` swaps instantly. A typewriter delete-then-type animation would sell the AI interaction model.

---

## 6. Proposed Improvements

### 6.1 Add `prefers-reduced-motion` Support (Priority: HIGH)

In `globals.css`:

```css
@media (prefers-reduced-motion: reduce) {
  .reveal,
  .reveal-scale,
  .reveal-left,
  .reveal-right {
    transition: none;
    opacity: 1;
    transform: none;
  }

  .floating-paper {
    animation: none !important;
  }

  .anim-fade-in,
  .anim-fade-out,
  .anim-slide-left,
  .anim-slide-right,
  .anim-content-swap {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

In `LandingPage.tsx`:

```typescript
useEffect(() => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ctx = gsap.context(() => {
    if (prefersReduced) {
      // Skip timeline, just make everything visible
      gsap.set('.hero-badge, .hero-word, .hero-desc, .hero-btns, .hero-mockup', {
        opacity: 1, y: 0, scale: 1,
      });
      return;
    }

    const heroTl = gsap.timeline({ delay: 0.3 });
    // ... existing timeline code
  }, rootRef);

  // ... rest of useEffect
}, []);
```

### 6.2 Landing-to-App Page Transition (Priority: HIGH)

Replace the `setTimeout` chain with a proper GSAP-driven transition:

```typescript
// In App.tsx
const handleLaunchApp = () => {
  const landingEl = document.querySelector('.landing-root');
  if (!landingEl) {
    setShowLanding(false);
    return;
  }

  gsap.to(landingEl, {
    opacity: 0,
    scale: 0.97,
    y: -30,
    duration: 0.5,
    ease: 'power3.in',
    onComplete: () => {
      setShowLanding(false);
      localStorage.setItem('papergrid_landing_hide', 'true');
    },
  });
};
```

And for the dashboard entrance, apply an entering animation class:

```css
@keyframes dashboardEnter {
  from {
    opacity: 0;
    transform: scale(1.02) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.dashboard-entering {
  animation: dashboardEnter 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
}
```

### 6.3 ScrollTrigger Parallax for Section Backgrounds (Priority: MEDIUM)

If adding ScrollTrigger is approved (~12KB additional), add subtle parallax to the ambient glow blobs:

```typescript
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// In LandingPage useEffect:
gsap.to('.hero-section .ambient-glow', {
  y: -80,
  scrollTrigger: {
    trigger: '.hero-section',
    start: 'top top',
    end: 'bottom top',
    scrub: 1.5,
  },
});
```

### 6.4 Stats Counter Animation (Priority: MEDIUM)

```typescript
// StatsStrip.tsx - add counter effect
import { useEffect, useRef } from 'react';

const AnimatedStat: React.FC<{ value: string; delay: number }> = ({ value, delay }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const numericValue = parseInt(value);
  const isNumeric = !isNaN(numericValue);

  useEffect(() => {
    if (!isNumeric || !ref.current) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const obj = { val: 0 };
        gsap.to(obj, {
          val: numericValue,
          duration: 1.5,
          delay,
          ease: 'power2.out',
          onUpdate: () => {
            if (ref.current) {
              ref.current.textContent = Math.round(obj.val) + (value.includes('+') ? '+' : '');
            }
          },
        });
        observer.disconnect();
      }
    }, { threshold: 0.5 });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return <span ref={ref}>{isNumeric ? '0' : value}</span>;
};
```

### 6.5 AI Prompt Typewriter Effect (Priority: LOW)

```typescript
// AIFeatureSection.tsx - typewriter transition
const [displayText, setDisplayText] = useState(prompts[0]);
const [isTyping, setIsTyping] = useState(false);

useEffect(() => {
  const timer = setInterval(() => {
    setIsTyping(true);
    // Delete animation
    const deleteInterval = setInterval(() => {
      setDisplayText(prev => {
        if (prev.length <= 1) {
          clearInterval(deleteInterval);
          setActivePromptIdx(i => {
            const next = (i + 1) % prompts.length;
            // Type new prompt
            let charIdx = 0;
            const typeInterval = setInterval(() => {
              setDisplayText(prompts[next].slice(0, charIdx + 1));
              charIdx++;
              if (charIdx >= prompts[next].length) {
                clearInterval(typeInterval);
                setIsTyping(false);
              }
            }, 35);
            return next;
          });
          return '';
        }
        return prev.slice(0, -1);
      });
    }, 20);
  }, 4000);
  return () => clearInterval(timer);
}, []);
```

### 6.6 Mouse-Reactive Floating Papers (Priority: LOW)

Add subtle depth parallax to floating papers based on mouse position:

```typescript
useEffect(() => {
  const handleMouseMove = (e: MouseEvent) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;

    gsap.to('.floating-paper', {
      x: (i: number) => x * (10 + i * 5),
      y: (i: number) => y * (8 + i * 4),
      duration: 1.2,
      ease: 'power2.out',
      overwrite: 'auto',
    });
  };

  window.addEventListener('mousemove', handleMouseMove);
  return () => window.removeEventListener('mousemove', handleMouseMove);
}, []);
```

**Note:** This would conflict with the existing floating animation. To combine them, use a separate wrapper div for the mouse parallax and keep the idle float on the inner element.

---

## 7. Summary of Recommendations

| # | Issue | Priority | Effort | Impact |
|---|-------|----------|--------|--------|
| 1 | Add `prefers-reduced-motion` support | **Critical** | Low | Accessibility compliance |
| 2 | Implement landing-to-app transition | **High** | Medium | Eliminates jarring view swap |
| 3 | Pause floating papers when off-screen | Medium | Low | CPU savings on scroll |
| 4 | Add `repeatRefresh: true` to floating papers | Low | Trivial | More organic motion |
| 5 | Add stats counter animation | Medium | Medium | Engagement on StatsStrip |
| 6 | Add AI prompt typewriter effect | Medium | Medium | Sells the AI interaction |
| 7 | Increase IntersectionObserver threshold to 0.15 | Low | Trivial | More deliberate reveals |
| 8 | Add ScrollTrigger parallax (optional) | Low | Medium | Premium depth effect |
| 9 | Reduce `backdropFilter` on testimonials | Low | Trivial | Performance on low-end |
| 10 | Add clarifying comments to CSS animation blocks | Low | Trivial | Maintainability |
| 11 | Mouse-reactive floating papers | Low | Medium | Delight/interactivity |

---

## 8. Files That Need Changes

| File | Changes |
|------|---------|
| `packages/web/src/styles/globals.css` | Add `prefers-reduced-motion` rules, add section comments |
| `packages/web/src/components/LandingPage.tsx` | Add reduced motion check, pause floating on scroll-away, add `repeatRefresh` |
| `packages/web/src/App.tsx` | Replace setTimeout transition with GSAP-driven page transition |
| `packages/web/src/components/landing/StatsStrip.tsx` | Add counter animation |
| `packages/web/src/components/landing/AIFeatureSection.tsx` | Add typewriter effect |
| `packages/web/src/components/landing/TestimonialsSection.tsx` | Consider removing `backdropFilter` |

---

## 9. Bundle Impact Assessment

| Current | Addition | New Total |
|---------|----------|-----------|
| gsap core ~24KB gzip | -- | 24KB |
| -- | ScrollTrigger (if added) ~12KB | 36KB |
| CSS animations ~2KB | prefers-reduced-motion ~0.3KB | 2.3KB |

**Total animation budget: 24-36KB gzipped** -- well within acceptable limits for a marketing landing page.
