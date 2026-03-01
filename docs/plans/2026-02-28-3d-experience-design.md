# PaperGrid 3D Experience - Full Design Document

**Date**: 2026-02-28
**Status**: Approved
**Approach**: Two-Track Parallel (Landing + App)

---

## Overview

Full 3D overhaul of PaperGrid using React Three Fiber. 15 features across landing page (conversion) and notebook app (engagement). Maximum visual quality with lazy-loaded Three.js for under 3-second first paint.

## Stack

```
@react-three/fiber          # React Three.js renderer
@react-three/drei           # Helper components
@react-three/rapier         # WASM physics engine
@react-three/postprocessing # Bloom, DOF, vignette
three                       # Three.js core
@types/three                # TypeScript types
maath                       # Math easing utilities
```

## File Architecture

```
packages/web/src/components/three/
├── canvas/
│   ├── LandingCanvas.tsx        # Lazy Canvas for landing
│   └── NotebookCanvas.tsx       # Lazy Canvas for app
├── landing/
│   ├── HeroNotebook.tsx         # F1: Interactive 3D notebook hero
│   ├── FloatingPapers.tsx       # F2: 3D floating paper cards
│   ├── PaperStyleCards.tsx      # F3: 3D tilt paper previews
│   ├── BentoPopCards.tsx        # F4: 3D bento with depth
│   ├── AestheticCarousel.tsx    # F5: Rotating notebook carousel
│   ├── WorkflowPipeline.tsx     # F6: 3D thought->AI->page flow
│   ├── TestimonialStack.tsx     # F7: 3D stacked pages
│   └── CTADeskScene.tsx         # F8: 3D desk with open notebook
├── notebook/
│   ├── BookCover3D.tsx          # F9: Realistic 3D book cover
│   ├── PageFlip.tsx             # F10: Physics page turning
│   ├── PaperSurface.tsx         # F11: Normal-mapped paper
│   ├── BlockLift.tsx            # F12: Block hover depth
│   ├── NotebookShelf.tsx        # F13: 3D bookshelf sidebar
│   ├── AIGeneration3D.tsx       # F14: Sparkle materialization
│   └── StickerLayer.tsx         # F15: 3D stickers/washi tape
└── shared/
    ├── PaperMaterial.tsx        # Procedural paper material factory
    ├── BookGeometry.tsx         # Parametric book geometry
    ├── Lighting.tsx             # Shared 3-point lighting rig
    ├── PostEffects.tsx          # Bloom + DOF + vignette
    └── useScrollProgress.ts    # GSAP scroll -> R3F bridge
```

---

## Feature Specifications

### F1: Hero 3D Notebook

**Location**: `HeroSection.tsx` - replaces `hero-mockup` div (lines 188-271)

**Behavior**:
- Book starts closed, cover facing viewer with embossed title
- Camera slowly orbits on idle
- Scroll 0-30%: book opens revealing two-page spread
- Left page: lined paper with sample content
- Right page: dot paper with priority matrix
- Hover: golden rim light activates
- Post-processing: bloom on indigo glow, vignette

**Geometry**: Parametric box (cover) + curved planes (pages)
**Materials**: MeshStandardMaterial with leather normalMap (cover), paper texture + normalMap (pages)
**Lighting**: 3-point rig (key directional, fill ambient, rim point)

### F2: Floating Papers

**Location**: `HeroSection.tsx` - replaces floating-paper divs (lines 36-124)

**Behavior**:
- Real 3D paper planes with slight edge curl
- React to mouse movement (parallax)
- Cast shadows on each other
- Different paper textures (lined, grid, dots)
- Physics-driven gentle drift

**Geometry**: Subdivided planes with vertex displacement for curl
**Materials**: Paper texture maps per card type

### F3: Paper Style 3D Cards

**Location**: `PaperStylesSection.tsx` - enhances tiles (lines 44-68)

**Behavior**:
- 10 3D planes with real paper textures
- Hover: tilt toward cursor, lift with shadow
- Selected: glow rim light, subtle float
- Camera focus shifts on selection change

### F4: Bento 3D Pop Cards

**Location**: `BlockTypesBento.tsx` - enhances bento grid

**Behavior**:
- Each bento card is a 3D panel with paper depth
- Priority Matrix: quadrants physically separate on hover
- Callout: peels up like real Post-it
- Mood: emoji spheres bounce with physics
- Grid: rows slide out like filing cabinet
- Tasks: checkboxes 3D flip on tick
- Parallax depth on scroll

### F5: Aesthetic Notebook Carousel

**Location**: `AestheticsSection.tsx` - replaces flat cards

**Behavior**:
- 4 physical 3D notebooks on rotating display
- Drag to rotate current notebook
- Unique cover materials per aesthetic:
  - Modern Planner: black leather + gold embossing
  - E-Ink: matte gray (reMarkable-style)
  - Bullet Journal: kraft paper + washi tape
  - Cornell: yellow legal binding
- Opens to show paper style on click

### F6: Workflow Pipeline

**Location**: `HowItWorksSection.tsx` - replaces step cards

**Behavior**:
- Scroll-driven 3D animation:
  1. Thought bubble floats up from 3D keyboard
  2. Sparkles swirl, text transforms to block shapes
  3. Blocks settle on 3D paper, pen writes content
- Celebrates human + AI creative partnership

### F7: Testimonial Stack

**Location**: `TestimonialsSection.tsx` - replaces flat cards

**Behavior**:
- Cards are literal 3D notebook pages
- Different paper textures per card
- Stack with depth, selected lifts forward
- Testimonial "written" in hand font
- Dog-eared corners, paper curl
- Auto-rotate with page-turning animation

### F8: CTA Desk Scene

**Location**: `FinalCTA.tsx` - replaces paper-lines section

**Behavior**:
- 3D desk with wood grain texture
- Open notebook with fluttering pages
- Pen beside it, casting shadow
- Coffee cup with steam particles
- Blank page inviting user to write
- Mouse parallax on desk items
- CTA button glows indigo

### F9: 3D Book Cover

**Location**: `App.tsx` - replaces cover div (lines 382-411)

**Behavior**:
- Full 3D book: spine, covers, page stack
- Cover material by color:
  - indigo = leather + gold embossing
  - rose = velvet
  - emerald = canvas
  - slate = matte linen
- 3D extruded title text
- Hover: rim light, slight lift
- Click: cover rotates open on spine axis with physics

### F10: 3D Page Flip

**Location**: `App.tsx` - replaces CSS slide animations

**Behavior**:
- Deformable mesh page (20x20 subdivisions)
- Forward: right page lifts, curls, swings left
- Backward: left page lifts, curls right
- Both sides visible during flip
- Shadow on page below
- rapier physics or bezier curve deformation
- Speed matches gesture (fast swipe / slow drag)
- Motion blur during fast flips

**Replaces**: `anim-slide-left` / `anim-slide-right` CSS keyframes

### F11: 3D Paper Surface

**Location**: `NotebookView.tsx` - enhances paper backgrounds

**Behavior**:
- Normal maps add surface relief per paper type:
  - Lined: grooves where lines are
  - Dotted: tiny raised bumps
  - Grid: shadow channels
  - Legal: visible grain, raised margin
  - Crumpled: displacement mesh (geometry wrinkles)
- Cursor-driven lighting response
- Edge vignette darkening

### F12: Block Lift Effect

**Location**: `BlockComponent.tsx` - enhances hover

**Behavior**:
- Hover: block lifts (translateZ) with drop shadow
- Callout: corner curls up in 3D
- Grid: slight perspective tilt
- Headings: subtle 3D text extrusion
- Dividers: thin 3D ribbon on paper
- Drag reorder: float above with DOF blur
- Place: micro-bounce settle

### F13: 3D Notebook Shelf

**Location**: `App.tsx` - replaces sidebar (lines 282-323)

**Behavior**:
- Wooden shelf with realistic grain texture
- Each notebook as 3D book, spine out
- Spine shows title embossed
- Different cover materials visible
- Click: book slides out, transitions to opening
- "New Notebook": glowing empty slot
- Warm ambient lighting
- Books shadow each other

### F14: AI Generation 3D Effect

**Location**: `App.tsx` - enhances generation (lines 222-250)

**Behavior**:
- Screen dims, page glows indigo
- Sparkle particle vortex above page
- Blocks materialize from particles (top-to-bottom)
- Start transparent/ghostly, solidify with "thunk"
- Final flourish: brief glow then settle
- 2-3 second duration synced with API
- Loading state: particles swirl in anticipation

### F15: 3D Stickers & Washi Tape

**Location**: New feature overlay

**Behavior**:
- Sticker picker panel slides out
- Stickers: slight thickness, glossy, cast shadows
- Place by drag, "stick" press animation
- Washi tape: semi-transparent 3D ribbon with texture
- Rotate, scale, overlap blocks
- Peel to remove: edge adhesive stretch
- Packs: productivity, cute, minimal

---

## Performance Strategy

### Lazy Loading
```
First Paint (< 3s): HTML + CSS + React DOM
+ 1-2s: Three.js + R3F (landing 3D appears)
On App Open: rapier WASM + physics downloads
```

### Frame Budget
- Desktop: 60fps target
- Mobile: 30fps acceptable
- Auto-disable post-processing below 30fps
- Paper normal maps: 512x512 max
- Book geometry: ~5K triangles
- Page mesh: 400 vertices (20x20)

### Bundle
- three.js: ~150KB gzipped
- R3F + drei: ~45KB gzipped
- rapier WASM: ~80KB gzipped
- postprocessing: ~30KB gzipped
- Total: ~305KB gzipped (lazy loaded)

---

## Implementation Phases

| Phase | Features | Files |
|-------|----------|-------|
| 1 | Stack install + shared infra | Lighting, PostEffects, PaperMaterial, BookGeometry |
| 2 | Hero Notebook + Floating Papers | HeroNotebook, FloatingPapers, LandingCanvas |
| 3 | Book Cover + Page Flip | BookCover3D, PageFlip, NotebookCanvas |
| 4 | Paper Cards + Bento Pop | PaperStyleCards, BentoPopCards |
| 5 | Paper Surface + Block Lift | PaperSurface, BlockLift |
| 6 | Aesthetic Carousel + Workflow | AestheticCarousel, WorkflowPipeline |
| 7 | Shelf + AI Generation | NotebookShelf, AIGeneration3D |
| 8 | Testimonials + CTA Desk + Stickers | TestimonialStack, CTADeskScene, StickerLayer |

---

## Decision Log

| # | Decision | Alternatives | Rationale |
|---|----------|-------------|-----------|
| 1 | React Three Fiber | Vanilla Three.js, Spline, Babylon | Best React 19 integration, TypeScript, state binding |
| 2 | Two-Track Parallel | Sequential, Infra-first | Fastest visible results on both fronts |
| 3 | rapier physics | cannon-es, custom springs | WASM performance, realistic soft-body |
| 4 | Code geometry | GLB models | Smaller bundle, parametric customization |
| 5 | Lazy Canvas | Eager load | Under 3s first paint requirement |
| 6 | Post-processing | None | Maximum quality requested |
| 7 | 3D replaces navigation | Toggle/hybrid | Full physical metaphor commitment |
| 8 | All 15 features | Subset | Full wow factor requested |
| 9 | Canvas textures | Image files | Dynamic, small, matches CSS patterns |
| 10 | 3D shelf sidebar | Flat sidebar | Maximum immersion differentiator |
