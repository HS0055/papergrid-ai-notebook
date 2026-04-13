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
  {
    title: "Why You're Procrastinating (And How to Break the Loop)",
    slug: 'why-youre-procrastinating',
    excerpt:
      'Procrastination is rarely about laziness. It is about the gap between where you are and where the task demands you be. Here is how to close it.',
    body: `# Procrastination is a signal, not a flaw
When you avoid a task, something about the task feels threatening. It might be the size, the ambiguity, the fear of failure, or the fear of starting wrong.

The avoidance is information. The work is to read it.

## Three common root causes

### 1. The task has no clear edge
An undefined task cannot be started because you do not know when you have begun. Replace "work on the project" with "write the first paragraph of section two."

### 2. The cost of failure feels personal
When the output reflects your worth, starting feels like risking your identity. Separate the task from the person doing it. The draft is not you.

### 3. The reward is invisible
The brain resists effort when the payoff is far away. Make a visible, immediate reward for the action, not just the result. One page earns a walk. One hour earns coffee.

## The smallest usable step
The procrastinating mind responds to scale. When the task feels large, shrink it until it feels almost stupid to avoid.

- Not: "write the report"
- Instead: "open the document and type today's date"

That is not a trick. It is accurate scoping. Once you are in the document, resistance drops by half.

## Use structure to remove decisions
Every decision you must make before starting is friction. A template, a checklist, a named first step — each one removes a micro-decision and lowers the entry cost.

Papera is built for this exact problem: you arrive with a vague task, and the page gives it shape before you have to.`,
    category: 'Productivity',
    mentalState: 'Avoiding the task',
    tags: ['procrastination', 'productivity', 'focus', 'habits'],
    featuredImageUrl: BLOG_IMAGES[2],
    interactivePrompt: 'What task are you avoiding right now?',
    interactivePlaceholder:
      "I keep putting off writing the presentation. Every time I sit down to start I end up doing something else. It's due Friday and I'm starting to panic...",
    interactiveOutputTitle: 'Your first real step',
    productCtaLabel: 'Structure it in Papera',
    productCtaUrl: '/app',
    authorName: 'Papera',
    readingTimeMinutes: 5,
    publishedAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  },
  {
    title: 'Decision Paralysis: How to Choose When Every Option Feels Wrong',
    slug: 'decision-paralysis-how-to-choose',
    excerpt:
      'When you are stuck choosing, the problem is rarely lack of information. It is lack of a framework. Here is one that works.',
    body: `# More options do not make better decisions
Research consistently shows that beyond a small number of comparable options, additional choices increase anxiety and reduce satisfaction with whatever you pick.

Decision paralysis is not a character flaw. It is a cognitive response to too many unmapped variables.

## Why the loop keeps going
You return to the same options because you are re-evaluating without new criteria. The loop breaks when you stop adding information and start naming what actually matters to you.

## A three-step framework

### Step 1: Name the real constraint
Most decisions have one constraint that matters more than the others. It might be time, money, relationship, values, or reversibility.

Ask: if I could only optimize for one thing, what would it be?

### Step 2: Eliminate before you evaluate
Remove options that fail the primary constraint. Do not rank them. Do not score them. Remove them. You cannot decide well from a list of twelve. You can decide from a list of two or three.

### Step 3: Ask which you would regret more
Regret is a better signal than preference. Preference is often noise — it changes with mood. Regret points at something stable.

"Would I regret not taking the risk, or regret taking it and failing?"

## When both choices feel equal
If two options are genuinely close, the decision has low stakes. Choose faster. The closeness means the outcome gap is small. What matters is the quality of your commitment after choosing.

Write the choice down. Write why you chose it. That act creates accountability and stops the loop.`,
    category: 'Decision-making',
    mentalState: 'Stuck choosing',
    tags: ['decisions', 'clarity', 'thinking', 'anxiety'],
    featuredImageUrl: BLOG_IMAGES[3],
    interactivePrompt: 'Describe the decision you cannot make.',
    interactivePlaceholder:
      "I have two job offers. One pays more but requires relocation. The other is closer to family but feels like a step sideways in my career. I've been going back and forth for two weeks...",
    interactiveOutputTitle: 'Your decision framework',
    productCtaLabel: 'Map it in Papera',
    productCtaUrl: '/app',
    authorName: 'Papera',
    readingTimeMinutes: 5,
    publishedAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  },
  {
    title: 'How to Take Meeting Notes That Actually Help You Later',
    slug: 'meeting-notes-that-actually-help',
    excerpt:
      'Most meeting notes are transcripts nobody reads. The ones that work look different from the start. Here is the structure.',
    body: `# The problem is not speed. It is structure.
Most people try to capture everything in a meeting. The result is a wall of text that becomes useless the moment the meeting ends.

Useful meeting notes are not a transcript. They are a decision log with action items attached.

## Before the meeting: set the capture frame
Arrive with three blank sections ready:
- **Decisions** — anything that was agreed upon
- **Actions** — who does what by when
- **Open** — questions that need follow-up

You are not writing a summary. You are filling buckets.

## During the meeting: capture less, not more

### Signal vs. noise
Most meeting speech is context, repetition, and hedging. The signal is decisions and commitments. Train yourself to listen for the moment when a statement becomes binding: "we will", "the plan is", "you own this."

### Name the owner immediately
An action item without an owner is a suggestion. The moment a task is mentioned, write the name next to it. Ask for confirmation if it is unclear.

### Use shorthand
Speed matters. Develop a small notation system:
- `D:` — decision
- `A:` — action + name + date
- `?:` — open question
- `!:` — urgent or high-stakes item

## After the meeting: the two-minute edit
Within two minutes of leaving, reorder your buckets and delete redundant context. Do not rewrite everything. Just make it scannable.

Send the action items to owners directly. Do not make them read the full notes to find their task.

## One page per meeting
One meeting gets one page. If the page is full, the meeting was too long or covered too many topics. That is information too.`,
    category: 'Work',
    mentalState: 'Too many action items',
    tags: ['meetings', 'notes', 'productivity', 'work'],
    featuredImageUrl: BLOG_IMAGES[0],
    interactivePrompt: 'What meeting are you trying to process?',
    interactivePlaceholder:
      "Just got out of a 90-minute product review. We covered three features, had two disagreements, and I'm not sure who owns what. My notes are a mess and standup is in an hour...",
    interactiveOutputTitle: 'Your meeting action map',
    productCtaLabel: 'Open Meeting Notes in Papera',
    productCtaUrl: '/app',
    authorName: 'Papera',
    readingTimeMinutes: 4,
    publishedAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  },
  {
    title: 'Study Planning: How to Learn Without Drowning in Material',
    slug: 'study-planning-without-drowning',
    excerpt:
      'Overwhelmed by what you have to learn? The solution is not more time. It is a different map. Here is how to build one.',
    body: `# The problem with studying everything
When you face a large body of material, the instinct is to start from the beginning and work forward. This rarely works.

Most of what you need to know is load-bearing — it supports other concepts. Most of the rest is detail that becomes easy once the load-bearing parts are clear. Studying linearly treats all material as equal. It is not.

## Step one: map the load-bearing concepts
Before you read anything in full, scan the material for the concepts that appear most often or that everything else depends on. These are your anchors.

In a programming course, the anchor might be "functions." In economics, it might be "incentives." In chemistry, it might be "bonds."

Write the three to five anchors on a single page. Everything else you learn will connect to one of them.

## Step two: study in passes, not in chapters

### Pass one — orientation (fast)
Read everything at roughly 3x speed. You are not learning. You are building a map of what exists and what connects to what.

### Pass two — deep work (slow)
Now slow down on the sections that contain your anchors. Take notes in your own words. If you cannot explain it without looking, you do not know it yet.

### Pass three — active recall (no notes)
Close the material. Reconstruct what you know from memory. What gaps appear? Go back only for those.

## Build before you memorize
Do not memorize a fact before you understand why it exists. Context doubles retention speed. If you cannot answer "why does this matter?", you are not ready to memorize it.

## One page per concept
Give each anchor concept its own page. Add examples, exceptions, and connections to other anchors as you learn. This becomes your personal reference — more useful than any textbook index.`,
    category: 'Learning',
    mentalState: 'Overwhelmed by material',
    tags: ['studying', 'learning', 'notes', 'education'],
    featuredImageUrl: BLOG_IMAGES[1],
    interactivePrompt: 'What are you trying to learn right now?',
    interactivePlaceholder:
      "I have an exam in 10 days covering 14 chapters. I've read through it once but nothing is sticking. I don't know what to focus on and I'm starting to panic...",
    interactiveOutputTitle: 'Your study anchor map',
    productCtaLabel: 'Build your study map in Papera',
    productCtaUrl: '/app',
    authorName: 'Papera',
    readingTimeMinutes: 6,
    publishedAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  },
  {
    title: 'Creative Block Is Not a Lack of Ideas',
    slug: 'creative-block-is-not-a-lack-of-ideas',
    excerpt:
      'Creative block feels like emptiness. It is usually the opposite: too many half-formed ideas with no way in. Here is the way in.',
    body: `# The block is not empty
Creative block feels like staring at a blank surface with nothing to put on it. But when you examine it more closely, the problem is almost never absence.

It is noise. Half-started ideas. Expectations about what the work should be. Fear that the output will not match the vision. A backlog of inputs that has not been sorted.

The block is not empty. It is congested.

## What is actually happening

### The inner editor arrived before the creator
The part of you that evaluates work is running before the part that makes it. Every idea that surfaces gets rejected before it can be explored. The result is silence — not because there is nothing, but because everything gets stopped at the gate.

### The reference pool is stale
Creativity draws on inputs. If you have been consuming the same kinds of things — or nothing at all — the material available to recombine runs out. Block is often a signal to change what you are putting in.

### The stakes feel too high
When the work matters a great deal, starting becomes harder. You are not procrastinating. You are protecting the idea from the risk of ruining it.

## Three ways through

### 1. Lower the output format
Do not try to make the real thing first. Make something adjacent and smaller. If you cannot write the article, write the worst possible version of the first sentence. If you cannot design the poster, sketch ten thumbnails in five minutes.

### 2. Make inputs deliberate
For one week, change your input diet: visit a different section of a bookstore, watch something in a genre you avoid, take a route you have never walked. New inputs do not guarantee creative output. But stale inputs almost guarantee the block stays.

### 3. Start in the middle
The beginning is the most expensive place to start. Start with a section or element you already know something about. Beginning in the middle proves to yourself that work is possible. The start becomes easier once there is something to connect it to.`,
    category: 'Creativity',
    mentalState: 'Out of ideas',
    tags: ['creativity', 'creative block', 'writing', 'art'],
    featuredImageUrl: BLOG_IMAGES[2],
    interactivePrompt: 'What are you trying to create but cannot seem to start?',
    interactivePlaceholder:
      "I have a design project due and every direction I try feels wrong. I've been staring at the brief for two days and I've got nothing. The client presentation is next week...",
    interactiveOutputTitle: 'Your way back in',
    productCtaLabel: 'Capture the idea in Papera',
    productCtaUrl: '/app',
    authorName: 'Papera',
    readingTimeMinutes: 5,
    publishedAt: '2026-04-11T00:00:00.000Z',
    updatedAt: '2026-04-11T00:00:00.000Z',
  },
  {
    title: 'How to Journal Daily Without Running Out of Things to Say',
    slug: 'how-to-journal-daily',
    excerpt:
      'Daily journaling is one of the highest-leverage habits for clarity. Most people quit within two weeks. Here is what makes it stick.',
    body: `# The problem with "dear diary"
Most journaling attempts fail because they treat the journal as a confessional — a place to dump feelings chronologically. This format runs out of steam quickly because most days feel similar and most feelings are already known.

The journal becomes more useful when it is used as a processing tool, not a recording device.

## What to actually write

### The daily audit (5 minutes)
Three questions. Do not elaborate until you know the answers.
1. What used the most energy today?
2. What am I carrying into tomorrow that should not come?
3. What was one thing that worked?

These questions surface signal. Most journaling dies because people start with a blank invitation: "how do you feel?" The audit gives you something to respond to.

### The open page (no limit)
Once you have the audit, open the page to whatever surface it triggers. Something in the audit will pull at you. Follow it. Write until it resolves or you find the next question.

This is where real clarity happens: not in the prompt, but in the space after it.

### The weekly thread (Sunday)
Once a week, read only the last seven audit entries. Find the pattern. What energy kept appearing? What unresolved item showed up more than once?

Name it in one sentence. That sentence is your work for the coming week.

## The format that makes consistency easier
Consistency comes from low friction. The same page layout every day removes the decision of how to start.

A good daily page layout:
- Date + one-word mood at the top
- Three audit answers
- Open space below

That is all. The simplicity is the feature.

## Why journaling builds clarity over time
The journal is not a record of who you were. It is a training dataset for how you think. The more consistently you process the day on paper, the faster you recognize patterns — the recurring doubts, the repeated avoidance, the underused strengths.

The page teaches you what you actually think, as opposed to what you think you think.`,
    category: 'Reflection',
    mentalState: 'Processing the day',
    tags: ['journaling', 'reflection', 'habits', 'clarity'],
    featuredImageUrl: BLOG_IMAGES[3],
    interactivePrompt: 'What is the loudest thing from your day right now?',
    interactivePlaceholder:
      "Had a difficult conversation with my manager this afternoon. I've been replaying it since. I think I responded badly but I'm not sure. A lot of other things happened too but I can't stop thinking about that...",
    interactiveOutputTitle: 'Your daily clarity page',
    productCtaLabel: 'Open your journal in Papera',
    productCtaUrl: '/app',
    authorName: 'Papera',
    readingTimeMinutes: 5,
    publishedAt: '2026-04-12T00:00:00.000Z',
    updatedAt: '2026-04-12T00:00:00.000Z',
  },
  {
    title: 'Goal Setting That Works: From Vague Direction to Concrete Plan',
    slug: 'goal-setting-that-works',
    excerpt:
      'Most goal-setting advice focuses on motivation. The real problem is architecture. Here is how to build a goal that holds together.',
    body: `# Goals fail at the architecture level
Most goal-setting fails not because people are unmotivated but because the goal was never built correctly to begin with.

A poorly constructed goal looks specific but contains hidden gaps: no measurement, no timeline, no clear connection between daily action and long-term outcome. When the motivation dips — and it always does — the architecture is what keeps you moving.

## The four parts of a goal that holds

### 1. The outcome
What is the concrete, observable end state? Not "be healthier" but "run a 10k." Not "grow the business" but "close five new clients by June 30."

The outcome is your destination. It must be imaginable in a specific, real scene.

### 2. The lead measure
Outcomes are lag measures — you see them after the work is done. Lead measures are the actions that produce the outcome and that you can track daily or weekly.

For "run a 10k": the lead measure is "run three times per week."
For "close five clients": the lead measure is "send five new outreach messages per day."

Tracking the lead measure keeps you oriented when the outcome feels far away.

### 3. The obstacle map
Every goal has predictable failure points. Name them before you hit them.

"I will miss runs when I travel." → Solution: hotel gym or bodyweight alternative.
"I will stop outreach when a deal gets hot." → Solution: calendar block for outreach regardless of pipeline.

The obstacle map turns unpredictable failure into managed friction.

### 4. The weekly review
Goals without a review rhythm drift. Once a week, spend ten minutes asking:
- Did I hit the lead measure?
- What worked?
- What do I need to change?

Adjust the plan, not the goal.

## Start with one goal
The most common setup mistake is too many goals running in parallel. Three goals compete for attention and dilute execution. One goal held for ninety days compounds.

Write the one goal that, if achieved, would make the others easier or irrelevant. Start there.`,
    category: 'Planning',
    mentalState: 'No clear direction',
    tags: ['goals', 'planning', 'productivity', 'habits'],
    featuredImageUrl: BLOG_IMAGES[0],
    interactivePrompt: 'What direction do you want to move in?',
    interactivePlaceholder:
      "I know I want to grow my freelance income but I'm not sure how to structure it. I have a few clients but no consistent pipeline. I feel like I'm always starting from zero...",
    interactiveOutputTitle: 'Your 90-day goal architecture',
    productCtaLabel: 'Plan it in Papera',
    productCtaUrl: '/app',
    authorName: 'Papera',
    readingTimeMinutes: 5,
    publishedAt: '2026-04-12T00:00:00.000Z',
    updatedAt: '2026-04-12T00:00:00.000Z',
  },
  {
    title: 'How to Take Reading Notes That Make Books Actually Useful',
    slug: 'reading-notes-that-make-books-useful',
    excerpt:
      'You read the book. Two weeks later, you remember almost nothing. The problem is not memory — it is the moment you put it down. Here is the fix.',
    body: `# The forgetting happens at the close
Most reading value is lost in the seconds after finishing. You have just absorbed a concentrated batch of ideas, and then life resumes and the ideas begin to dissolve.

The solution is not re-reading. It is building a residue from each reading session — a small structure that holds the key ideas in a form you can return to and use.

## The three-layer reading note

### Layer 1: The single sentence (during reading)
While reading, keep a running list of statements in the form: "this book argues that ___." One sentence per idea that surprises you or changes something you thought you knew.

Aim for five to ten across the whole book. Not more. If everything surprises you, you are not filtering for signal.

### Layer 2: The reaction note (end of chapter)
At the end of each chapter or major section, write two things:
- The idea I will actually use
- The idea I disagree with or find incomplete

This is the layer most readers skip. It converts reading from passive consumption to active dialogue. The ideas you push back on are often more useful than the ones you accept.

### Layer 3: The reentry note (24 hours later)
The next day, without opening the book, write what you remember. Everything you can reconstruct from memory is actually yours. Everything you cannot reconstruct was not yet learned — it was only read.

The gaps you find are your specific study targets.

## What to do with the notes
A note that sits in a notebook is inert. A note that connects to a decision you have to make is alive.

When you finish a book, ask: where in my current work or life does this idea apply? Write one specific scenario. That act of application is what actually moves an idea from borrowed to owned.

## One page per book
A single well-structured page per book is more valuable than forty pages of highlights. The constraint forces selection. Selection forces understanding.`,
    category: 'Learning',
    mentalState: 'Capturing what matters',
    tags: ['reading', 'notes', 'learning', 'books'],
    featuredImageUrl: BLOG_IMAGES[1],
    interactivePrompt: 'What did you just read (or are reading) that you want to retain?',
    interactivePlaceholder:
      "Just finished 'Deep Work' by Cal Newport. I found myself nodding along to almost everything but when my colleague asked me what it was about yesterday I couldn't really explain it clearly...",
    interactiveOutputTitle: 'Your book residue',
    productCtaLabel: 'Build your reading notes in Papera',
    productCtaUrl: '/app',
    authorName: 'Papera',
    readingTimeMinutes: 5,
    publishedAt: '2026-04-12T00:00:00.000Z',
    updatedAt: '2026-04-12T00:00:00.000Z',
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

