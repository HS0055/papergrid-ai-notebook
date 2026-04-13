import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignLeft,
  ArrowRight,
  BrainCircuit,
  Calendar,
  CheckSquare,
  FileDown,
  Grid3X3,
  Hash,
  Image,
  LayoutTemplate,
  ListTodo,
  MessageSquare,
  Music,
  PenTool,
  Search,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import { analyzeThoughts, BlogPost } from './blogData';

type PreviewPost = Pick<
  BlogPost,
  | 'title'
  | 'excerpt'
  | 'category'
  | 'mentalState'
  | 'interactivePlaceholder'
  | 'interactiveOutputTitle'
  | 'productCtaLabel'
  | 'productCtaUrl'
>;

interface BlogNotebookPreviewProps {
  post?: PreviewPost;
}

const LEAF_COUNT = 6;
const MAX_PAGE = LEAF_COUNT;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const DEFAULT_POST: PreviewPost = {
  title: 'Why I Cannot Start Writing',
  excerpt: 'A short guide for turning scattered thoughts into a usable first structure.',
  category: 'Writing blocks',
  mentalState: 'Stuck before starting',
  interactivePlaceholder:
    "I want to write, but I don't know where to start. I have a topic, I keep judging the first line, and everything feels too broad...",
  interactiveOutputTitle: 'Your first usable structure',
  productCtaLabel: 'Open Papera',
  productCtaUrl: '/app',
};

export const BlogNotebookPreview: React.FC<BlogNotebookPreviewProps> = ({ post }) => {
  const resolvedPost = { ...DEFAULT_POST, ...post };
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const targetPageRef = useRef(0);
  const visualPageRef = useRef(0);

  const [targetPage, setTargetPage] = useState(0);
  const [visualPage, setVisualPage] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const isMobile = useIsMobile();

  const sampleThought = resolvedPost.interactivePlaceholder;
  const analysis = useMemo(
    () => analyzeThoughts(sampleThought, resolvedPost),
    [sampleThought, resolvedPost.category, resolvedPost.mentalState],
  );

  useEffect(() => {
    targetPageRef.current = targetPage;
  }, [targetPage]);

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

  const moveToPage = (nextPage: number) => {
    const clampedPage = clamp(nextPage, 0, MAX_PAGE);
    targetPageRef.current = clampedPage;
    setTargetPage(clampedPage);
  };

  const turnBy = (direction: 1 | -1) => {
    const nextPage = clamp(targetPageRef.current + direction, 0, MAX_PAGE);
    // Scroll the page so the scroll-driven handler stays in sync.
    const container = containerRef.current;
    if (container) {
      const scrollableDistance = container.offsetHeight - window.innerHeight;
      const targetY = container.offsetTop + (nextPage / MAX_PAGE) * scrollableDistance;
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    } else {
      moveToPage(nextPage);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      turnBy(1);
    }
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      turnBy(-1);
    }
  };

  // Scroll-driven page turns: read position of the tall container div and
  // map it to a book page. No preventDefault needed — natural scroll, passive.
  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scrollableDistance = container.offsetHeight - window.innerHeight;
      if (scrollableDistance <= 0) return;
      const scrolled = Math.max(0, -rect.top);
      const progress = scrolled / scrollableDistance;
      moveToPage(Math.round(clamp(progress, 0, 1) * MAX_PAGE));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    setTilt({
      x: clamp(y * -5, -5, 5),
      y: clamp(x * 7, -7, 7),
    });
  };

  const resetTilt = () => setTilt({ x: 0, y: 0 });

  const getLeafStyle = (topIndex: number): React.CSSProperties => {
    const leafProgress = clamp(visualPage - topIndex, 0, 1);
    const angle = leafProgress * -180;
    const shadowStrength = Math.max(0, 1 - Math.abs(leafProgress - 0.5) * 2);
    const flipped = angle <= -90;

    return {
      transform: `rotateY(${angle}deg) translateZ(${topIndex * -0.6}px)`,
      zIndex: flipped ? topIndex + 1 : LEAF_COUNT - topIndex,
      boxShadow:
        flipped && Math.round(visualPage) - 1 === topIndex
          ? '22px 0 34px -14px rgba(0,0,0,0.36)'
          : undefined,
      ['--shadow-str' as string]: shadowStrength.toFixed(3),
    };
  };

  const progressPercent = (targetPage / MAX_PAGE) * 100;
  const openProgress = clamp(visualPage, 0, 1);
  const bookShift = isMobile ? 0 : openProgress * 86;
  const bookScale = 1;

  return (
    // Tall scroll container — provides the scroll budget for page turns.
    // (MAX_PAGE + 1) viewport-heights: 1 for the stuck view + 1 per page turn.
    <div ref={containerRef} style={{ height: `calc(${MAX_PAGE + 1} * 100svh)` }}>
    <section
      ref={rootRef}
      className="blog-book-preview"
      style={{ position: 'sticky', top: 0, height: '100svh' }}
      aria-label="Papera notebook product preview"
      tabIndex={0}
      onPointerMove={onPointerMove}
      onPointerLeave={resetTilt}
      onKeyDown={onKeyDown}
    >
      <div className="blog-book-preview__ambient" aria-hidden="true" />
      <div className="blog-book-progress" aria-hidden="true">
        <span>{String(Math.min(MAX_PAGE + 1, targetPage + 1)).padStart(2, '0')}</span>
        <div>
          <i style={{ height: `${progressPercent}%` }} />
        </div>
        <span>07</span>
      </div>

      <div className="blog-book-stage">
        <div
          className="blog-book-wrapper"
          style={{
            transform: `translateX(${bookShift}px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${bookScale})`,
          }}
        >
          <div className="blog-book-object">
            <div className="blog-book-pages-edge" />
            <div className="blog-book-pages-top-edge" />
            <div className="blog-book-pages-bottom-edge" />
            <div className="blog-book-binding" />

            {renderLeaf(5, getLeafStyle(5), (
              <BackInsidePage />
            ), (
              <BackCover />
            ), visualPage)}

            {renderLeaf(4, getLeafStyle(4), (
              <FAQPage />
            ), (
              <FinalCtaPage post={resolvedPost} />
            ), visualPage)}

            {renderLeaf(3, getLeafStyle(3), (
              <IntelligencePage />
            ), (
              <PricingPage />
            ), visualPage)}

            {renderLeaf(2, getLeafStyle(2), (
              <TexturesPage />
            ), (
              <CapabilitiesPage />
            ), visualPage)}

            {renderLeaf(1, getLeafStyle(1), (
              <ArticlePage post={resolvedPost} />
            ), (
              <StructurePage post={resolvedPost} analysis={analysis} />
            ), visualPage)}

            {renderLeaf(0, getLeafStyle(0), (
              <FrontCover />
            ), (
              <InsideCover />
            ), visualPage)}
          </div>
        </div>
      </div>

      <div className="blog-book-controls" aria-label="Notebook preview controls">
        <button
          type="button"
          onClick={() => turnBy(-1)}
          disabled={targetPage === 0}
        >
          Back
        </button>
        <span>Scroll to turn</span>
        <button
          type="button"
          onClick={() => turnBy(1)}
          disabled={targetPage === MAX_PAGE}
        >
          Turn page
        </button>
      </div>
    </section>
    </div>
  );
};

function renderLeaf(
  topIndex: number,
  style: React.CSSProperties,
  front: React.ReactNode,
  back: React.ReactNode,
  visualPage: number,
) {
  const progress = clamp(visualPage - topIndex, 0, 1);
  return (
    <div className="blog-book-leaf" data-leaf={topIndex + 1} style={style}>
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

function PageNumber({ children, side = 'right', style }: { children: React.ReactNode; side?: 'left' | 'right'; style?: React.CSSProperties }) {
  return <span className={`blog-book-page-number blog-book-page-number--${side}`} style={style}>{children}</span>;
}

function FrontCover() {
  return (
    <div className="blog-book-cover blog-book-cover-front">
      <div className="blog-book-glare" />
      <div className="blog-book-cover-line" />
      <div className="blog-book-cover-line blog-book-cover-line--thin" />
      <div className="blog-book-cover-badge">
        <Sparkles size={13} />
        <span>Powered by Advanced AI</span>
      </div>
      <h2>
        The notebook
        <span>that thinks</span>
        with you.
      </h2>
      <div className="blog-book-cover-stats">
        <div><strong>22+</strong><span>block types</span></div>
        <div><strong>10</strong><span>paper textures</span></div>
        <div><strong>∞</strong><span>AI layouts</span></div>
      </div>
      <div className="blog-book-cover-brand">Papera</div>
      <div className="blog-book-ribbon" />
    </div>
  );
}

function InsideCover() {
  return (
    <div className="blog-book-paper blog-book-paper--inside">
      <p className="blog-book-kicker blog-book-kicker--gold">What's inside</p>
      <h3 style={{ marginBottom: '0.85rem' }}>Your walkthrough</h3>
      <div className="blog-book-toc">
        {([
          ['The guide', '03'],
          ['AI structure', '04'],
          ['Paper types', '05'],
          ['Block toolkit', '06'],
          ['Intelligence', '07'],
          ['Your plan', '08'],
        ] as [string, string][]).map(([label, pg]) => (
          <div key={label} className="blog-book-toc-item">
            <span>{label}</span>
            <span className="blog-book-toc-page">{pg}</span>
          </div>
        ))}
      </div>
      <PageNumber side="left">02</PageNumber>
    </div>
  );
}

function ArticlePage({ post }: { post: PreviewPost }) {
  return (
    <div className="blog-book-paper blog-book-paper--article">
      <div className="blog-book-article-pills">
        <span className="blog-book-pill blog-book-pill--cat">{post.category}</span>
        <span className="blog-book-pill blog-book-pill--state">{post.mentalState}</span>
      </div>
      <h3>{post.title}</h3>
      <p className="blog-book-copy">{post.excerpt}</p>
      <div className="blog-book-article-meta">
        <span>5 min read</span>
        <span>·</span>
        <span>Turn this into a page</span>
      </div>
      <PageNumber>03</PageNumber>
    </div>
  );
}

function StructurePage({ post, analysis }: { post: PreviewPost; analysis: ReturnType<typeof analyzeThoughts> }) {
  const score = parseInt(String(analysis.clarityScore), 10) || 0;
  return (
    <div className="blog-book-paper blog-book-paper--right">
      <p className="blog-book-kicker">AI Output</p>
      <h3 style={{ marginBottom: '0.5rem' }}>{post.interactiveOutputTitle}</h3>
      <div className="blog-book-clarity-bar">
        <div className="blog-book-clarity-bar__track">
          <div className="blog-book-clarity-bar__fill" style={{ width: `${score}%` }} />
        </div>
        <span>{analysis.clarityScore} clarity</span>
      </div>
      <div className="blog-book-check-list">
        {analysis.structure.slice(0, 3).map((item) => (
          <div key={item} className="blog-book-check-item">
            <span className="blog-book-check-dot" />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="blog-book-next-move">{analysis.nextMove}</div>
      <PageNumber side="left">04</PageNumber>
    </div>
  );
}

function TexturesPage() {
  return (
    <div className="blog-book-paper blog-book-paper--textures">
      <p className="blog-book-kicker">Paper Feel</p>
      <h3>10 textures. One vibe.</h3>
      <div className="blog-book-texture-grid">
        <div className="blog-book-swatch blog-book-swatch--grid">
          <span>Grid</span>
        </div>
        <div className="blog-book-swatch blog-book-swatch--lined">
          <span>Ruled</span>
        </div>
        <div className="blog-book-swatch blog-book-swatch--dots">
          <span>Dot</span>
        </div>
        <div className="blog-book-swatch blog-book-swatch--kraft">
          <span>Kraft</span>
        </div>
        <div className="blog-book-swatch blog-book-swatch--blank">
          <span>Blank</span>
        </div>
        <div className="blog-book-swatch blog-book-swatch--more">
          <span>+5 more</span>
        </div>
      </div>
      <p className="blog-book-copy blog-book-mobile-hide" style={{ marginTop: '0.6rem' }}>
        Pick the paper. Set the mood. The right texture makes writing feel real.
      </p>
      <PageNumber>05</PageNumber>
    </div>
  );
}

function CapabilitiesPage() {
  const blocks = [
    { icon: <AlignLeft size={14} />, name: 'Text' },
    { icon: <CheckSquare size={14} />, name: 'Tasks' },
    { icon: <Grid3X3 size={14} />, name: 'Grid' },
    { icon: <Hash size={14} />, name: 'Heading' },
    { icon: <MessageSquare size={14} />, name: 'Quote' },
    { icon: <Music size={14} />, name: 'Music' },
    { icon: <Calendar size={14} />, name: 'Calendar' },
    { icon: <Image size={14} />, name: 'Image' },
    { icon: <ListTodo size={14} />, name: 'Kanban' },
    { icon: <LayoutTemplate size={14} />, name: 'Layout' },
  ];
  return (
    <div className="blog-book-paper blog-book-paper--right">
      <p className="blog-book-kicker blog-book-kicker--gold">Block Toolkit</p>
      <h3>22+ block types.</h3>
      <div className="blog-book-block-grid">
        {blocks.map(({ icon, name }) => (
          <div key={name} className="blog-book-block-chip">
            {icon}
            <span>{name}</span>
          </div>
        ))}
      </div>
      <PageNumber side="left">06</PageNumber>
    </div>
  );
}

function IntelligencePage() {
  return (
    <div className="blog-book-paper">
      <p className="blog-book-kicker blog-book-kicker--gold">Intelligence</p>
      <h3>Say it. Papera builds it.</h3>
      <div className="blog-book-ai-demo">
        <div className="blog-book-ai-prompt">
          <span className="blog-book-ai-label">You</span>
          <p>"weekly study plan for my thesis"</p>
        </div>
        <div className="blog-book-ai-arrow">
          <BrainCircuit size={14} />
          <span>Papera</span>
        </div>
        <div className="blog-book-ai-output">
          <div><span>📅</span> Week-by-week schedule</div>
          <div><span>✅</span> Daily focus blocks</div>
          <div><span>📝</span> Research tracker</div>
          <div><span>🔍</span> Semantic search</div>
        </div>
      </div>
      <PageNumber>07</PageNumber>
    </div>
  );
}

function PricingPage() {
  return (
    <div className="blog-book-paper blog-book-paper--right">
      <p className="blog-book-kicker">Plans</p>
      <h3>Start free. Scale when ready.</h3>
      <div className="blog-book-plan">
        <div>
          <strong>Free</strong>
          <span>$0</span>
        </div>
        <div className="blog-book-plan-checks">
          <span>10 Ink/month</span>
          <span>Unlimited notebooks</span>
          <span>All paper types</span>
        </div>
      </div>
      <div className="blog-book-plan blog-book-plan--pro">
        <div>
          <strong>Pro</strong>
          <span>$9.99/mo</span>
        </div>
        <div className="blog-book-plan-checks">
          <span>100 Ink/month</span>
          <span>Priority AI models</span>
          <span>Get 2 months free</span>
        </div>
      </div>
      <PageNumber side="left">08</PageNumber>
    </div>
  );
}

function FAQPage() {
  return (
    <div className="blog-book-paper">
      <p className="blog-book-kicker">Common Questions</p>
      <h3>Good Qs.</h3>
      <div className="blog-book-qa">
        <ShieldCheck size={18} />
        <div>
          <strong>Is my data private?</strong>
          <p>Yes. AI runs through private endpoints. Your entries are never used for training.</p>
        </div>
      </div>
      <div className="blog-book-qa">
        <WifiOff size={18} />
        <div>
          <strong>Works offline?</strong>
          <p>Write and organize offline. AI syncs when you reconnect.</p>
        </div>
      </div>
      <div className="blog-book-qa blog-book-mobile-hide">
        <FileDown size={18} />
        <div>
          <strong>Can I export?</strong>
          <p>PDF and Markdown export. Your pages, your format.</p>
        </div>
      </div>
      <PageNumber>09</PageNumber>
    </div>
  );
}

function FinalCtaPage({ post }: { post: PreviewPost }) {
  return (
    <div className="blog-book-paper blog-book-paper--cta blog-book-paper--cta-dark">
      <div className="blog-book-cta-inner">
        <div className="blog-book-cta-icon-wrap">
          <PenTool size={28} />
        </div>
        <h3>Your next page is blank.</h3>
        <p>Turn this rough idea into a structure you can actually use.</p>
        <Link to={post.productCtaUrl} className="blog-book-cta-link">
          {post.productCtaLabel}
          <ArrowRight size={16} />
        </Link>
        <div className="blog-book-cta-sub">Free to start — no card needed</div>
      </div>
      <PageNumber side="left" style={{ color: 'rgba(255,255,255,0.3)' }}>10</PageNumber>
    </div>
  );
}

function BackInsidePage() {
  return (
    <div className="blog-book-paper blog-book-paper--endpaper">
      <div className="blog-book-quote-mark">"</div>
      <p className="blog-book-quote-body">
        The best thinking happens on paper.
        <br />
        Papera just makes the paper smarter.
      </p>
      <div className="blog-book-quote-rule" />
      <div className="blog-book-endpaper-search">
        <Search size={14} />
        <span>Search by meaning, not keywords</span>
      </div>
    </div>
  );
}

function BackCover() {
  return (
    <div className="blog-book-cover blog-book-cover-back">
      <div className="blog-book-glare" />
      <div className="blog-book-back-mark">P</div>
      <p>Designed for thinkers, writers, and creators.</p>
      <span>EST. 2024</span>
      <Sparkles size={16} className="blog-book-back-check" />
    </div>
  );
}
