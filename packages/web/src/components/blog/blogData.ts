export type BlogStatus = 'draft' | 'published' | 'archived';

export interface BlogPost {
  _id?: string;
  title: string;
  slug: string;
  excerpt: string;
  body?: string;
  status?: BlogStatus;
  category: string;
  mentalState: string;
  tags: string[];
  featuredImageUrl?: string;
  interactivePrompt: string;
  interactivePlaceholder: string;
  interactiveOutputTitle: string;
  productCtaLabel: string;
  productCtaUrl: string;
  seoTitle?: string;
  seoDescription?: string;
  authorName?: string;
  readingTimeMinutes: number;
  publishedAt?: string;
  updatedAt?: string;
  createdAt?: string;
}

export interface ThoughtAnalysis {
  signal: string;
  friction: string;
  structure: string[];
  nextMove: string;
  clarityScore: number;
}

export const BLOG_IMAGES = [
  '/notebook-models/hardcover-embossed.jpg',
  '/notebook-models/spiral-classic.jpg',
  '/notebook-models/softcover-floral.jpg',
  '/notebook-models/hardcover-clasp.jpg',
] as const;

export const DEFAULT_BLOG_POSTS: BlogPost[] = [
  {
    title: "Why I Can't Start Writing",
    slug: 'why-i-cant-start-writing',
    excerpt:
      'A short guide for turning pressure, scattered thoughts, and blank-page friction into a usable first structure.',
    body: `# The blank page is usually not empty
Most people think they cannot start because they have no ideas. Usually the opposite is true. They have too many signals competing for attention.

When your head feels loud, the job is not to write a perfect sentence. The job is to separate the mess into a few named parts.

## Start with the pressure
- What am I trying to prove?
- Who am I imagining will judge this?
- What would be enough for the first version?

## Turn the fog into parts
- The topic: what this is about.
- The tension: why it feels hard.
- The next move: one action small enough to do now.

## Use the smallest useful draft
Write one rough sentence, then ask what it is trying to say. That sentence does not need to survive. It only needs to reveal the shape of the next one.

Content is manual thinking. Papera is automated thinking. The move is the same: get the thought out, give it structure, then continue with less noise.`,
    category: 'Writing blocks',
    mentalState: 'Stuck before starting',
    tags: ['writing', 'clarity', 'blank page'],
    featuredImageUrl: BLOG_IMAGES[0],
    interactivePrompt: 'Drop the thoughts you keep circling around.',
    interactivePlaceholder:
      "I want to write, but I don't know where to start. I have a topic, I keep judging the first line, and everything feels too broad...",
    interactiveOutputTitle: 'Your first usable structure',
    productCtaLabel: 'Open Papera',
    productCtaUrl: '/app',
    authorName: 'Papera',
    readingTimeMinutes: 4,
    publishedAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
  {
    title: 'How To Untangle A Thought',
    slug: 'how-to-untangle-a-thought',
    excerpt:
      'A practical way to move from mental pile-up to a clean outline, without pretending the thought is already organized.',
    body: `# A thought becomes useful when it has edges
The mind often sends ideas as one dense bundle: facts, fears, plans, memories, and half-decisions arrive together.

The first step is not prioritizing. The first step is naming the kinds of material in the bundle.

## Split the thought into four lanes
- Facts: what is actually known.
- Feelings: what the situation is producing in you.
- Questions: what still needs an answer.
- Moves: what could happen next.

## Do not optimize too early
If you try to make the thought elegant before it is visible, you lose information. Capture first. Sort second. Rewrite third.

This is the thinking journey Papera is built around: the page is not storage. The page is a guide.`,
    category: 'Thinking guides',
    mentalState: 'Overloaded',
    tags: ['thinking', 'structure', 'notes'],
    featuredImageUrl: BLOG_IMAGES[1],
    interactivePrompt: 'Paste one tangled thought.',
    interactivePlaceholder:
      'I need to decide what to do next, but I have deadlines, ideas, doubts, and a bunch of notes in different places...',
    interactiveOutputTitle: 'Your thinking lanes',
    productCtaLabel: 'Build this in Papera',
    productCtaUrl: '/app',
    authorName: 'Papera',
    readingTimeMinutes: 3,
    publishedAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
  },
];

const fallbackTexts = [
  'Name the stuck point in one plain sentence.',
  'Separate what you know from what you feel.',
  'Choose one next action that takes less than ten minutes.',
];

export const analyzeThoughts = (input: string, post?: Pick<BlogPost, 'mentalState' | 'category'>): ThoughtAnalysis => {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      signal: 'The page is waiting for a raw thought.',
      friction: post?.mentalState || 'No clear friction named yet.',
      structure: fallbackTexts,
      nextMove: 'Write one messy paragraph. Papera can organize the next layer.',
      clarityScore: 18,
    };
  }

  const sentences = trimmed
    .split(/[\n.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const blocker = sentences.find((sentence) =>
    /\b(can't|cannot|stuck|hard|confused|overwhelmed|afraid|judge|too much|broad)\b/i.test(sentence),
  );
  const firstSignal = sentences[0] || trimmed.slice(0, 140);
  const repeatedWords = Array.from(
    new Set(
      words
        .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .filter((word) => word.length > 5),
    ),
  ).slice(0, 3);

  const structure = [
    `Signal: ${firstSignal}`,
    `Friction: ${blocker || post?.mentalState || 'the next step is not named yet'}`,
    repeatedWords.length
      ? `Themes: ${repeatedWords.join(', ')}`
      : `Context: ${post?.category || 'thinking'}`,
  ];

  return {
    signal: firstSignal,
    friction: blocker || post?.mentalState || 'The thought needs a smaller first move.',
    structure,
    nextMove: 'Turn this into one page: title, tension, next move. Then continue from the structure, not the noise.',
    clarityScore: Math.min(96, 28 + Math.round(words.length * 1.8) + structure.length * 7),
  };
};

export const formatDate = (iso?: string): string => {
  if (!iso) return 'Draft';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

