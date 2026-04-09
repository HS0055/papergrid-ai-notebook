import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Loader2, X, Send, ChevronUp, MessageCircle,
  Lightbulb, Bug, MessageSquare, Megaphone, Sparkles, Circle, Check,
  CheckCircle2, Clock, XCircle, Pin, ShieldCheck,
} from 'lucide-react';
import { api as apiClient, getSessionToken } from '../../services/apiClient';
import { useAuth } from '../../hooks/useAuth';

// ─────────────────────────────────────────────────────────────
// CommunityPage — feedback board + product roadmap + changelog
//
// Repositioned from a generic social feed. The community is now the
// product-feedback loop for the team:
//  • Users vote on feature requests ("Feature Requests" tab)
//  • Users post bugs ("Bugs" tab)
//  • Users leave free-form feedback ("Feedback" tab)
//  • Admins post changelog entries ("News" tab) — admin-only
//
// The vote count is the existing likeCount under the hood so the whole
// like/comment infrastructure still powers it; we just rename the UI
// language from "like" to "vote" and show an upvote chevron instead
// of a heart.
// ─────────────────────────────────────────────────────────────

type Kind = 'feature_request' | 'bug' | 'feedback' | 'announcement';
type Sort = 'trending' | 'recent';

interface FeedPost {
  _id: string;
  authorId: string;
  title: string;
  body: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  viewCount: number;
  status: string;
  kind?: Kind | 'discussion';
  roadmapStatus?: 'open' | 'planned' | 'in_progress' | 'shipped' | 'declined';
  createdAt: string;
  pinnedAt?: string;
  authorHandle?: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  authorRole?: 'user' | 'admin';
  likedByMe?: boolean;
}

interface FeedResponse {
  page: FeedPost[];
  isDone: boolean;
  continueCursor: string | null;
}

interface Comment {
  _id: string;
  postId: string;
  authorId: string;
  body: string;
  likeCount: number;
  createdAt: string;
  parentCommentId?: string;
  authorHandle?: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  authorRole?: 'user' | 'admin';
}

const KINDS: Array<{
  id: Kind;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    id: 'feature_request',
    label: 'Feature Requests',
    icon: <Lightbulb size={16} />,
    description: 'Suggest features. Vote on what you want next.',
  },
  {
    id: 'bug',
    label: 'Bugs',
    icon: <Bug size={16} />,
    description: 'Report something broken. Upvote if it hit you too.',
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: <MessageSquare size={16} />,
    description: 'Share your honest thoughts. Good or bad.',
  },
  {
    id: 'announcement',
    label: 'News',
    icon: <Megaphone size={16} />,
    description: 'Shipping notes, launches, and official product news.',
  },
];

const ROADMAP_STATUS: Record<
  NonNullable<FeedPost['roadmapStatus']>,
  { label: string; icon: React.ReactNode; color: string }
> = {
  open: { label: 'Open', icon: <Circle size={12} />, color: 'bg-slate-100 text-slate-700 border-slate-200' },
  planned: { label: 'Planned', icon: <Clock size={12} />, color: 'bg-amber-100 text-amber-700 border-amber-200' },
  in_progress: { label: 'In Progress', icon: <Sparkles size={12} />, color: 'bg-sky-100 text-sky-700 border-sky-200' },
  shipped: { label: 'Shipped', icon: <CheckCircle2 size={12} />, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  declined: { label: 'Declined', icon: <XCircle size={12} />, color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString();
};

const sortAnnouncements = (feed: FeedPost[]): FeedPost[] =>
  [...feed].sort((a, b) => {
    const aPinned = a.pinnedAt ? new Date(a.pinnedAt).getTime() : 0;
    const bPinned = b.pinnedAt ? new Date(b.pinnedAt).getTime() : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

interface PostResponse {
  post: Omit<FeedPost, 'authorDisplayName' | 'authorAvatarUrl' | 'authorHandle' | 'likedByMe' | 'authorRole'>;
  author: {
    handle?: string;
    displayName?: string;
    avatarUrl?: string;
  } | null;
  authorRole?: 'user' | 'admin';
  likedByMe: boolean;
}

const hydratePost = (payload: PostResponse | null): FeedPost | null => {
  if (!payload) return null;
  return {
    ...payload.post,
    authorHandle: payload.author?.handle,
    authorDisplayName: payload.author?.displayName,
    authorAvatarUrl: payload.author?.avatarUrl,
    authorRole: payload.authorRole,
    likedByMe: payload.likedByMe,
  };
};

export const CommunityPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const isAdmin = (user as { role?: string } | null)?.role === 'admin';

  const [kind, setKind] = useState<Kind>('feature_request');
  const [sort, setSort] = useState<Sort>('trending');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const feedRequestIdRef = useRef(0);
  const feedAbortRef = useRef<AbortController | null>(null);

  const mergePostIntoFeed = useCallback((incoming: FeedPost) => {
    if (incoming.kind !== kind) return;
    setPosts((prev) => {
      const next = [incoming, ...prev.filter((post) => post._id !== incoming._id)];
      const ordered = kind === 'announcement' ? sortAnnouncements(next) : next;
      return ordered.slice(0, 30);
    });
  }, [kind]);

  const patchPostInFeed = useCallback((postId: string, updater: (post: FeedPost) => FeedPost) => {
    setPosts((prev) =>
      prev.map((post) => (post._id === postId ? updater(post) : post)),
    );
  }, []);

  const loadFeed = useCallback(async () => {
    feedAbortRef.current?.abort();
    const controller = new AbortController();
    feedAbortRef.current = controller;
    const requestId = ++feedRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<FeedResponse>(
        `/api/community/feed?sort=${sort}&kind=${kind}&limit=30`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || requestId !== feedRequestIdRef.current) return;
      setPosts(kind === 'announcement' ? sortAnnouncements(data.page) : data.page);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || requestId !== feedRequestIdRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      if (requestId !== feedRequestIdRef.current) return;
      setLoading(false);
    }
  }, [sort, kind]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => () => {
    feedAbortRef.current?.abort();
  }, []);

  const toggleVote = async (postId: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    const applyVoteDelta = (post: FeedPost): FeedPost => ({
      ...post,
      likedByMe: !post.likedByMe,
      likeCount: Math.max(0, post.likeCount + (post.likedByMe ? -1 : 1)),
    });
    patchPostInFeed(postId, applyVoteDelta);
    try {
      await apiClient.post('/api/community/like-post', { postId });
    } catch (err) {
      patchPostInFeed(postId, applyVoteDelta);
      setError(err instanceof Error ? err.message : 'Failed to vote');
    }
  };

  const handlePostCreated = (id: string, createdPost: FeedPost | null) => {
    setComposerOpen(false);
    if (createdPost) {
      mergePostIntoFeed(createdPost);
    } else {
      void loadFeed();
    }
    setActivePostId(id);
  };

  const activeKind = KINDS.find((k) => k.id === kind)!;
  const canCompose = isAuthenticated && (kind !== 'announcement' || isAdmin);
  const spotlightPost = kind === 'announcement' ? posts[0] ?? null : null;
  const listPosts = kind === 'announcement' && spotlightPost ? posts.slice(1) : posts;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-black/5">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/app')}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Back to notebooks"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="font-serif text-xl font-bold leading-tight">Community</h1>
            <p className="text-xs text-gray-500">{activeKind.description}</p>
          </div>
          {canCompose && (
            <button
              onClick={() => setComposerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">
                {kind === 'announcement' ? 'Publish news' : 'New post'}
              </span>
            </button>
          )}
        </div>

        {/* Category tabs */}
        <div className="max-w-4xl mx-auto px-4 pb-2 flex gap-2 overflow-x-auto">
          {KINDS.map((k) => {
            const active = kind === k.id;
            return (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-600 border-black/5 hover:bg-slate-50'
                }`}
              >
                {k.icon}
                {k.label}
              </button>
            );
          })}
        </div>
        <div className="max-w-4xl mx-auto px-4 flex gap-2 pb-2">
          {(['trending', 'recent'] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold capitalize transition-colors ${
                sort === s ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {s === 'trending' ? 'Most Voted' : 'Newest'}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        )}
        {!loading && posts.length === 0 && !error && (
          <EmptyState
            kind={kind}
            canCompose={canCompose}
            isAuthenticated={isAuthenticated}
            onCompose={() => setComposerOpen(true)}
            onSignIn={() => navigate('/login')}
          />
        )}

        {!loading && kind === 'announcement' && spotlightPost && (
          <AnnouncementSpotlight
            post={spotlightPost}
            isAdmin={isAdmin}
            onCompose={() => setComposerOpen(true)}
            onOpen={() => setActivePostId(spotlightPost._id)}
          />
        )}

        <div className="space-y-2">
          {listPosts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onVote={() => toggleVote(post._id)}
              onOpen={() => setActivePostId(post._id)}
            />
          ))}
        </div>
      </main>

      {composerOpen && (
        <ComposerModal
          kind={kind}
          isAdmin={isAdmin}
          onClose={() => setComposerOpen(false)}
          onCreated={handlePostCreated}
          authorName={user?.name}
        />
      )}
      {activePostId && (
        <PostDetailModal
          postId={activePostId}
          initialPost={posts.find((post) => post._id === activePostId) ?? null}
          isAdmin={isAdmin}
          onClose={() => setActivePostId(null)}
          onVoteToggle={() => toggleVote(activePostId)}
          onCommentAdded={loadFeed}
          onRoadmapChanged={loadFeed}
        />
      )}
    </div>
  );
};

// ────────── EmptyState ──────────
const EmptyState: React.FC<{
  kind: Kind;
  canCompose: boolean;
  isAuthenticated: boolean;
  onCompose: () => void;
  onSignIn: () => void;
}> = ({ kind, canCompose, isAuthenticated, onCompose, onSignIn }) => {
  const copy =
    kind === 'feature_request'
      ? { title: 'No feature requests yet', sub: 'Be the first to tell us what to build.' }
      : kind === 'bug'
        ? { title: 'Zero bugs reported', sub: 'If you spot something, tell us.' }
        : kind === 'feedback'
          ? { title: 'No feedback yet', sub: "Tell us what's working and what's not." }
          : { title: 'No news yet', sub: 'Official product updates will land here.' };
  return (
    <div className="py-16 text-center">
      <h2 className="font-serif text-xl font-bold text-slate-800 mb-1">{copy.title}</h2>
      <p className="text-sm text-gray-500 mb-4">{copy.sub}</p>
      {canCompose ? (
        <button
          onClick={onCompose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> {kind === 'announcement' ? 'Publish first news post' : 'Post first one'}
        </button>
      ) : !isAuthenticated ? (
        <button
          onClick={onSignIn}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
        >
          Sign in to post
        </button>
      ) : null}
    </div>
  );
};

const AnnouncementSpotlight: React.FC<{
  post: FeedPost;
  isAdmin: boolean;
  onCompose: () => void;
  onOpen: () => void;
}> = ({ post, isAdmin, onCompose, onOpen }) => (
  <section className="mb-5 overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.18),_transparent_42%),linear-gradient(135deg,#0f172a_0%,#111827_45%,#1e1b4b_100%)] text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
    <div className="px-6 py-6 sm:px-8 sm:py-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-indigo-100">
            <Megaphone size={12} /> Community News
          </span>
          {post.pinnedAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/14 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-100">
              <Pin size={12} /> Pinned
            </span>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={onCompose}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/16"
          >
            <Plus size={15} />
            Publish news
          </button>
        )}
      </div>

      <button onClick={onOpen} className="block w-full text-left">
        <h2 className="max-w-2xl font-serif text-3xl font-bold leading-tight sm:text-[2.5rem]">
          {post.title}
        </h2>
        <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-200/92 sm:text-base">
          {post.body}
        </p>
      </button>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-slate-200/80">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
          <ShieldCheck size={12} />
          {post.authorDisplayName || post.authorHandle || 'PaperGrid team'}
        </span>
        <span>{timeAgo(post.createdAt)}</span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle size={12} />
          {post.commentCount} comments
        </span>
      </div>
    </div>
  </section>
);

// ────────── PostCard ──────────
interface PostCardProps {
  post: FeedPost;
  onVote: () => void;
  onOpen: () => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onVote, onOpen }) => {
  const isAnnouncement = post.kind === 'announcement';
  const roadmap = post.roadmapStatus ? ROADMAP_STATUS[post.roadmapStatus] : null;
  return (
    <article
      className={`rounded-2xl border shadow-sm transition-shadow overflow-hidden ${
        isAnnouncement
          ? 'border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#eef2ff_100%)] hover:shadow-lg'
          : 'bg-white border-black/5 hover:shadow-md'
      }`}
    >
      <div className="flex gap-3 p-4">
        {/* Vote column */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onVote();
          }}
          className={`flex flex-col items-center justify-center shrink-0 w-14 py-2 rounded-xl border-2 transition-all ${
            post.likedByMe
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50'
          }`}
          aria-label={post.likedByMe ? 'Remove vote' : 'Vote'}
        >
          <ChevronUp size={18} strokeWidth={3} />
          <span className="font-bold text-sm tabular-nums">{post.likeCount}</span>
        </button>

        {/* Content */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={onOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpen();
          }}
        >
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-serif text-base font-bold text-slate-900 leading-tight">{post.title}</h3>
            {isAnnouncement && (
              <>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                  <Megaphone size={10} /> News
                </span>
                {post.pinnedAt && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                    <Pin size={10} /> Pinned
                  </span>
                )}
              </>
            )}
            {roadmap && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roadmap.color}`}
              >
                {roadmap.icon} {roadmap.label}
              </span>
            )}
          </div>
          <p className={`line-clamp-2 whitespace-pre-wrap ${isAnnouncement ? 'text-sm text-slate-700' : 'text-sm text-gray-600'}`}>
            {post.body}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>
              {post.authorDisplayName || post.authorHandle || 'Unknown'} · {timeAgo(post.createdAt)}
            </span>
            {post.authorRole === 'admin' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 ring-1 ring-indigo-100">
                <ShieldCheck size={10} /> Team
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={12} />
              {post.commentCount}
            </span>
            {post.tags.slice(0, 3).map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px]">
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
};

// ────────── ComposerModal ──────────
interface ComposerModalProps {
  kind: Kind;
  isAdmin: boolean;
  onClose: () => void;
  onCreated: (postId: string, createdPost: FeedPost | null) => void;
  authorName?: string;
}

const ComposerModal: React.FC<ComposerModalProps> = ({
  kind, isAdmin, onClose, onCreated, authorName,
}) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const kindMeta = KINDS.find((k) => k.id === kind)!;
  const isAnnouncement = kind === 'announcement';

  const tags = useMemo(
    () =>
      tagInput
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter((t) => t.length > 0)
        .slice(0, 8),
    [tagInput],
  );

  const submit = async () => {
    if (!getSessionToken()) {
      setErr('Please sign in first');
      return;
    }
    if (!title.trim()) {
      setErr('Title is required');
      return;
    }
    if (!body.trim()) {
      setErr('Body is required');
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const endpoint = isAnnouncement
        ? '/api/community/admin/announce'
        : '/api/community/posts';
      const payload = isAnnouncement
        ? { title: title.trim(), body: body.trim(), tags, pinned }
        : { title: title.trim(), body: body.trim(), tags, kind };
      const result = await apiClient.post<{ postId: string }>(endpoint, payload);
      let createdPost: FeedPost | null = null;
      try {
        const created = await apiClient.get<{ post: PostResponse | null }>(
          `/api/community/post?id=${result.postId}`,
        );
        createdPost = hydratePost(created.post);
      } catch {
        // Fall back to a full feed reload in the parent if the detail fetch fails.
      }
      onCreated(result.postId, createdPost);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-black/5 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {kindMeta.icon}
            <h2 className="font-serif text-lg font-bold">New {kindMeta.label.toLowerCase().replace(/s$/, '')}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full hover:bg-black/5">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {authorName && <p className="text-xs text-gray-500">Posting as {authorName}</p>}
          <input
            type="text"
            placeholder={
              kind === 'feature_request' ? 'What should we build?' :
              kind === 'bug' ? 'What broke?' :
              kind === 'feedback' ? 'What do you want to say?' :
              'News headline'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-serif text-base"
          />
          <textarea
            placeholder={
              kind === 'feature_request' ? 'Describe it. How would it work? Why do you need it?' :
              kind === 'bug' ? 'Steps to reproduce, expected vs actual, any screenshots...' :
              kind === 'feedback' ? 'What would you change? What do you love?' :
              'Describe the news. What shipped, launched, or changed?'
            }
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={8000}
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm resize-y"
          />
          <input
            type="text"
            placeholder="Tags (optional, comma separated)"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-black/10 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm"
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {isAdmin && isAnnouncement && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="rounded border-black/10"
              />
              Pin to top of News
            </label>
          )}
          {err && (
            <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {err}
            </div>
          )}
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait transition-colors"
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ────────── PostDetailModal ──────────
interface PostDetailModalProps {
  postId: string;
  initialPost: FeedPost | null;
  isAdmin: boolean;
  onClose: () => void;
  onVoteToggle: () => Promise<void>;
  onCommentAdded: () => void;
  onRoadmapChanged: () => void;
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({
  postId, initialPost, isAdmin, onClose, onVoteToggle, onCommentAdded, onRoadmapChanged,
}) => {
  const [post, setPost] = useState<FeedPost | null>(initialPost);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(!initialPost);
  const [commentDraft, setCommentDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!initialPost) return;
    setPost((current) => {
      if (!current || current._id !== initialPost._id) return initialPost;
      return { ...current, ...initialPost };
    });
  }, [initialPost]);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [postRes, commentsRes] = await Promise.all([
        apiClient.get<{ post: PostResponse | null }>(`/api/community/post?id=${postId}`),
        apiClient.get<{ comments: Comment[] }>(`/api/community/comments?postId=${postId}`),
      ]);
      setPost(hydratePost(postRes.post));
      setComments(commentsRes.comments);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load(!initialPost);
  }, [initialPost, load]);

  const addComment = async () => {
    if (!commentDraft.trim()) return;
    setPosting(true);
    setErr(null);
    try {
      await apiClient.post('/api/community/comments', {
        postId,
        body: commentDraft.trim(),
      });
      setCommentDraft('');
      await load(false);
      onCommentAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to comment');
    } finally {
      setPosting(false);
    }
  };

  const setRoadmap = async (status: NonNullable<FeedPost['roadmapStatus']>) => {
    try {
      await apiClient.post('/api/community/admin/roadmap-status', {
        postId,
        roadmapStatus: status,
      });
      await load(false);
      onRoadmapChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update roadmap');
    }
  };

  const roadmap = post?.roadmapStatus ? ROADMAP_STATUS[post.roadmapStatus] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl h-[92vh] sm:h-[88vh] overflow-hidden shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-black/5 px-5 py-3 flex items-center justify-between z-10">
          <h2 className="font-serif text-lg font-bold">Post</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full hover:bg-black/5">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          )}
          {!loading && !post && (
            <p className="text-center text-gray-500 py-12">Post not found</p>
          )}
          {post && (
            <>
              <div className="flex items-start gap-3 mb-3">
                <button
                  onClick={onVoteToggle}
                  className={`flex flex-col items-center justify-center shrink-0 w-14 py-2 rounded-xl border-2 transition-all ${
                    post.likedByMe
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400'
                  }`}
                >
                  <ChevronUp size={20} strokeWidth={3} />
                  <span className="font-bold text-sm">{post.likeCount}</span>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {post.kind === 'announcement' && (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                          <Megaphone size={10} /> News
                        </span>
                        {post.pinnedAt && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider">
                            <Pin size={10} /> Pinned
                          </span>
                        )}
                      </>
                    )}
                    {post.authorRole === 'admin' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                        <ShieldCheck size={10} /> Official
                      </span>
                    )}
                    {roadmap && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roadmap.color}`}>
                        {roadmap.icon} {roadmap.label}
                      </span>
                    )}
                  </div>
                  <h1 className="font-serif text-2xl font-bold mb-1">{post.title}</h1>
                  <p className="text-xs text-gray-500">
                    {post.authorDisplayName ?? post.authorHandle ?? 'Unknown'} · {timeAgo(post.createdAt)}
                  </p>
                </div>
              </div>
              <div className={post.kind === 'announcement' ? 'rounded-2xl border border-indigo-100 bg-indigo-50/65 p-4' : ''}>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {post.body}
                </p>
              </div>

              {isAdmin && post.kind === 'feature_request' && (
                <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">Admin: set roadmap status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(ROADMAP_STATUS) as Array<keyof typeof ROADMAP_STATUS>).map((s) => {
                      const meta = ROADMAP_STATUS[s];
                      const active = post.roadmapStatus === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setRoadmap(s)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                            active ? meta.color : 'bg-white text-slate-500 border-black/5 hover:bg-slate-100'
                          }`}
                        >
                          {meta.icon}
                          {meta.label}
                          {active && <Check size={10} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <h3 className="font-serif text-sm font-bold text-slate-900 mt-5 mb-3 uppercase tracking-wide">Comments</h3>
              {isAdmin && (
                <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Team replies are highlighted as official responses.
                </p>
              )}
              {comments.length === 0 && (
                <p className="text-sm text-gray-400">Be the first to comment.</p>
              )}
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c._id} className="flex gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                      style={{
                        background: c.authorAvatarUrl
                          ? `url(${c.authorAvatarUrl}) center/cover`
                          : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                      }}
                    >
                      {!c.authorAvatarUrl && (c.authorDisplayName?.[0]?.toUpperCase() ?? '?')}
                    </div>
                    <div
                      className={`flex-1 min-w-0 rounded-xl px-3 py-2 ${
                        c.authorRole === 'admin'
                          ? 'border border-indigo-100 bg-indigo-50/80'
                          : 'bg-slate-50'
                      }`}
                    >
                      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-900">
                        {c.authorDisplayName ?? c.authorHandle ?? 'Unknown'}
                        {c.authorRole === 'admin' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                            <ShieldCheck size={10} /> Official reply
                          </span>
                        )}
                        <span className="text-gray-400 font-normal ml-2">{timeAgo(c.createdAt)}</span>
                      </p>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        {post && isAuthenticated && (
          <div className="border-t border-black/5 bg-white px-4 py-3 flex items-end gap-2">
            <textarea
              placeholder={isAdmin ? 'Post an official reply…' : 'Add a comment…'}
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={1}
              maxLength={2000}
              className="flex-1 px-3 py-2 rounded-xl border border-black/10 focus:outline-none focus:border-indigo-500 text-sm resize-none"
            />
            <button
              onClick={addComment}
              disabled={posting || !commentDraft.trim()}
              className="p-2 rounded-full bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700"
              aria-label="Send comment"
            >
              <Send size={18} />
            </button>
          </div>
        )}
        {err && (
          <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-xs text-rose-700">
            {err}
          </div>
        )}
      </div>
    </div>
  );
};
