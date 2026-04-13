import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, PenTool, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BlogPost } from './blogData';

type WidgetPost = Pick<
  BlogPost,
  'title' | 'excerpt' | 'category' | 'mentalState' | 'productCtaLabel' | 'productCtaUrl'
>;

interface BlogBookWidgetProps {
  post?: WidgetPost;
}

// Natural book dimensions at scale 1 (matches .blog-book-object max sizing)
const BOOK_NATURAL_WIDTH = 470;
// Widget scale applied via CSS transform
const BOOK_SCALE = 0.6;
// Rendered visual width = natural * scale
const BOOK_VISUAL_WIDTH = Math.round(BOOK_NATURAL_WIDTH * BOOK_SCALE); // 282

const WIDGET_LEAF_COUNT = 2;
const MAX_PAGE = WIDGET_LEAF_COUNT;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const DEFAULT_POST: WidgetPost = {
  title: 'The notebook that thinks with you',
  excerpt: 'Turn scattered thoughts into structured pages — with AI that understands context.',
  category: 'Writing',
  mentalState: 'Exploring',
  productCtaLabel: 'Open Papera',
  productCtaUrl: '/app',
};

// --- Page components ---

function WidgetFrontCover() {
  return (
    <div className="blog-book-cover blog-book-cover-front">
      <div className="blog-book-glare" />
      <div className="blog-book-cover-line" />
      <div className="blog-book-cover-line blog-book-cover-line--thin" />
      <div className="blog-book-cover-badge">
        <Sparkles size={10} />
        <span>Powered by Advanced AI</span>
      </div>
      <h2>
        The notebook
        <span>that thinks</span>
        with you.
      </h2>
      <div className="blog-book-cover-brand">Papera</div>
      <div className="blog-book-ribbon" />
    </div>
  );
}

function WidgetArticlePage({ post }: { post: WidgetPost }) {
  return (
    <div className="blog-book-paper">
      <p className="blog-book-kicker">Featured Guide</p>
      <h3>{post.title}</h3>
      <p className="blog-book-copy">{post.excerpt}</p>
      <div className="blog-book-article-ticket">
        <span>{post.category}</span>
        <strong>{post.mentalState}</strong>
      </div>
      <span className="blog-book-page-number">03</span>
    </div>
  );
}

function WidgetFinalCtaPage({ post }: { post: WidgetPost }) {
  return (
    <div className="blog-book-paper blog-book-paper--cta">
      <div className="blog-book-cta-frame">
        <PenTool size={24} />
        <h3>Ready to clear your mind?</h3>
        <p>Turn the next rough thought into a page you can keep using.</p>
        <Link to={post.productCtaUrl} className="blog-book-cta-link">
          {post.productCtaLabel}
          <ArrowRight size={14} />
        </Link>
      </div>
      <span className="blog-book-page-number blog-book-page-number--left">04</span>
    </div>
  );
}

// --- Leaf renderer (mirrors BlogNotebookPreview renderLeaf) ---

function renderWidgetLeaf(
  topIndex: number,
  style: React.CSSProperties,
  front: React.ReactNode,
  back: React.ReactNode,
  visualPage: number,
) {
  const progress = clamp(visualPage - topIndex, 0, 1);
  return (
    <div className="blog-book-leaf" data-leaf={topIndex + 1} style={style} key={topIndex}>
      <div className="blog-book-face blog-book-face-front blog-book-page-front">
        <div className="blog-book-lighting blog-book-lighting-front" />
        <div className={`blog-book-content ${progress < 0.1 ? 'is-visible' : ''}`}>{front}</div>
      </div>
      <div className="blog-book-face blog-book-face-back blog-book-page-back">
        <div className="blog-book-lighting blog-book-lighting-back" />
        <div className={`blog-book-content ${progress > 0.9 ? 'is-visible' : ''}`}>{back}</div>
      </div>
    </div>
  );
}

// Page labels shown in the dot indicator
const PAGE_LABELS: readonly string[] = ['Cover', 'Article', 'Try Papera'] as const;

export const BlogBookWidget: React.FC<BlogBookWidgetProps> = ({ post }) => {
  const resolvedPost = { ...DEFAULT_POST, ...post };

  const [targetPage, setTargetPage] = useState(0);
  const [visualPage, setVisualPage] = useState(0);

  const targetPageRef = useRef(0);
  const visualPageRef = useRef(0);

  // Keep ref in sync with state so the animation closure always reads the
  // latest target without depending on the state value directly.
  useEffect(() => {
    targetPageRef.current = targetPage;
  }, [targetPage]);

  // Spring animation — same 0.16 lerp factor as BlogNotebookPreview
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      visualPageRef.current = targetPage;
      setVisualPage(targetPage);
      return;
    }

    let frame = 0;

    const animate = () => {
      const target = targetPageRef.current;
      const current = visualPageRef.current;
      const diff = target - current;

      if (Math.abs(diff) < 0.01) {
        visualPageRef.current = target;
        setVisualPage(target);
        frame = 0;
        return;
      }

      const next = current + diff * 0.16;
      visualPageRef.current = next;
      setVisualPage(next);
      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, [targetPage]);

  const goTo = (page: number) => {
    const clamped = clamp(page, 0, MAX_PAGE);
    targetPageRef.current = clamped;
    setTargetPage(clamped);
  };

  const getLeafStyle = (topIndex: number): React.CSSProperties => {
    const leafProgress = clamp(visualPage - topIndex, 0, 1);
    const angle = leafProgress * -180;
    const shadowStrength = Math.max(0, 1 - Math.abs(leafProgress - 0.5) * 2);
    const flipped = angle <= -90;

    return {
      transform: `rotateY(${angle}deg) translateZ(${topIndex * -0.6}px)`,
      zIndex: flipped ? topIndex + 1 : WIDGET_LEAF_COUNT - topIndex,
      boxShadow:
        flipped && Math.round(visualPage) - 1 === topIndex
          ? '22px 0 34px -14px rgba(0,0,0,0.36)'
          : undefined,
      // CSS custom property consumed by the page-curl gradient in globals.css
      ['--shadow-str' as string]: shadowStrength.toFixed(3),
    };
  };

  // Natural height of the book at scale 1 (aspect-ratio 5/7 → height = width * 7/5)
  const naturalHeight = Math.round(BOOK_NATURAL_WIDTH * (7 / 5)); // 658
  // Reserve exactly the visual height so the widget doesn't collapse
  const visualHeight = Math.round(naturalHeight * BOOK_SCALE); // 395

  const currentPageIndex = clamp(Math.round(targetPage), 0, MAX_PAGE);

  return (
    <div
      className="blog-book-widget"
      aria-label="Papera notebook preview widget"
      style={{ maxWidth: BOOK_VISUAL_WIDTH, margin: '1.5rem auto 0' }}
    >
      {/* Book stage: collapses to the visual (scaled) height while the inner
          element stays at the natural size so CSS sizing resolves correctly. */}
      <div style={{ position: 'relative', height: visualHeight, overflow: 'visible' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            // Centre the natural-width element inside the visual-width container
            left: '50%',
            marginLeft: -(BOOK_NATURAL_WIDTH / 2),
            width: BOOK_NATURAL_WIDTH,
            transformOrigin: 'top center',
            transform: `scale(${BOOK_SCALE})`,
            // Establish perspective for the 3D page-flip on this subtree
            perspective: '1200px',
          }}
        >
          <div
            className="blog-book-object"
            style={{
              // Pin to the constant natural width so the responsive CSS min()
              // expression doesn't resolve to something smaller inside a narrow column
              width: BOOK_NATURAL_WIDTH,
            }}
          >
            <div className="blog-book-pages-edge" />
            <div className="blog-book-pages-top-edge" />
            <div className="blog-book-pages-bottom-edge" />
            <div className="blog-book-binding" />

            {/* Leaf 1 (topIndex 1): front = ArticlePage, back = FinalCtaPage */}
            {renderWidgetLeaf(
              1,
              getLeafStyle(1),
              <WidgetArticlePage post={resolvedPost} />,
              <WidgetFinalCtaPage post={resolvedPost} />,
              visualPage,
            )}

            {/* Leaf 0 (topIndex 0): front = FrontCover, back = ArticlePage */}
            {renderWidgetLeaf(
              0,
              getLeafStyle(0),
              <WidgetFrontCover />,
              <WidgetArticlePage post={resolvedPost} />,
              visualPage,
            )}
          </div>
        </div>
      </div>

      {/* Dot indicator */}
      <div
        role="tablist"
        aria-label="Book pages"
        style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: '0.875rem' }}
      >
        {PAGE_LABELS.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={currentPageIndex === index}
            aria-label={`Go to ${label}`}
            onClick={() => goTo(index)}
            style={{
              width: currentPageIndex === index ? 18 : 7,
              height: 7,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: currentPageIndex === index ? '#1c1917' : '#d6d3d1',
              padding: 0,
              transition: 'width 200ms ease, background 200ms ease',
            }}
          />
        ))}
      </div>

      {/* Prev / Next navigation buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: '0.625rem',
        }}
      >
        <button
          type="button"
          aria-label="Previous page"
          disabled={targetPage === 0}
          onClick={() => goTo(targetPage - 1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #e7e5e4',
            background: 'white',
            fontSize: 13,
            fontWeight: 600,
            color: '#1c1917',
            cursor: targetPage === 0 ? 'not-allowed' : 'pointer',
            opacity: targetPage === 0 ? 0.4 : 1,
            flex: 1,
            transition: 'opacity 150ms ease',
          }}
        >
          <ChevronLeft size={15} />
          Back
        </button>

        <button
          type="button"
          aria-label="Next page"
          disabled={targetPage === MAX_PAGE}
          onClick={() => goTo(targetPage + 1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid transparent',
            background: targetPage < MAX_PAGE ? '#1c1917' : 'white',
            borderColor: targetPage < MAX_PAGE ? 'transparent' : '#e7e5e4',
            color: targetPage < MAX_PAGE ? 'white' : '#1c1917',
            fontSize: 13,
            fontWeight: 600,
            cursor: targetPage === MAX_PAGE ? 'not-allowed' : 'pointer',
            opacity: targetPage === MAX_PAGE ? 0.4 : 1,
            flex: 1,
            transition: 'opacity 150ms ease, background 150ms ease',
          }}
        >
          Next
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Persistent CTA link */}
      <Link
        to="/app"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: '1rem',
          paddingBottom: '0.25rem',
          fontSize: 13,
          fontWeight: 700,
          color: '#059669',
          textDecoration: 'none',
          letterSpacing: '0.02em',
        }}
      >
        Try Papera
        <ArrowRight size={13} />
      </Link>
    </div>
  );
};
