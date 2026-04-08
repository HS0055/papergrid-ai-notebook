import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Loader2, X, Send, ChevronUp, MessageCircle,
  Lightbulb, Bug, MessageSquare, Megaphone, Sparkles, Circle, Check,
  CheckCircle2, Clock, XCircle,
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
//  • Admins post changelog entries ("Updates" tab) — admin-only
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
  authorHandle?: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
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
  authorHandle?: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
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
    label: 'Updates',
    icon: <Megaphone size={16} />,
    description: 'What we just shipped. Posted by the team.',
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

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<FeedResponse>(
        `/api/community/feed?sort=${sort}&kind=${kind}&limit=30`,
      );
      setPosts(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [sort, kind]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const toggleVote = async (postId: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setPosts((prev) =>
      prev.map((p) =>
        p._id === postId
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likeCount: p.likeCount + (p.likedByMe ? -1 : 1),
            }
          : p,
      ),
    );
    try {
      await apiClient.post('/api/community/like-post', { postId });
    } catch (err) {
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? {
                ...p,
                likedByMe: !p.likedByMe,
                likeCount: p.likeCount + (p.likedByMe ? -1 : 1),
              }
            : p,
        ),
      );
      setError(err instanceof Error ? err.message : 'Failed to vote');
    }
  };

  const handlePostCreated = (id: string) => {
    setComposerOpen(false);
    loadFeed();
    setActivePostId(id);
  };

  const activeKind = KINDS.find((k) => k.id === kind)!;
  const canCompose = isAuthenticated && (kind !== 'announcement' || isAdmin);

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
                {kind === 'announcement' ? 'New update' : 'New post'}
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

        <div className="space-y-2">
          {posts.map((post) => (
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
          : { title: 'No updates yet', sub: 'Team updates will show up here.' };
  return (
    <div className="py-16 text-center">
      <h2 className="font-serif text-xl font-bold text-slate-800 mb-1">{copy.title}</h2>
      <p className="text-sm text-gray-500 mb-4">{copy.sub}</p>
      {canCompose ? (
        <button
          onClick={onCompose}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} /> {kind === 'announcement' ? 'Post first update' : 'Post first one'}
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
    <article className="bg-white rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                <Megaphone size={10} /> Update
              </span>
            )}
            {roadmap && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${roadmap.color}`}
              >
                {roadmap.icon} {roadmap.label}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-wrap">{post.body}</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            <span>
              {post.authorDisplayName || post.authorHandle || 'Unknown'} · {timeAgo(post.createdAt)}
            </span>
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
  onCreated: (postId: string) => void;
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
      onCreated(result.postId);
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
              'Update title'
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
              'Describe the update. What did you ship?'
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
              Pin to top of Updates
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
  isAdmin: boolean;
  onClose: () => void;
  onVoteToggle: () => void;
  onCommentAdded: () => void;
  onRoadmapChanged: () => void;
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({
  postId, isAdmin, onClose, onVoteToggle, onCommentAdded, onRoadmapChanged,
}) => {
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentDraft, setCommentDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [postRes, commentsRes] = await Promise.all([
        apiClient.get<{ post: { post: FeedPost } | null }>(`/api/community/post?id=${postId}`),
        apiClient.get<{ comments: Comment[] }>(`/api/community/comments?postId=${postId}`),
      ]);
      setPost(postRes.post?.post ?? null);
      setComments(commentsRes.comments);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

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
      await load();
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
      await load();
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
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider">
                        <Megaphone size={10} /> Update
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
              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed mt-4 mb-4">{post.body}</p>

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
                    <div className="flex-1 min-w-0 bg-slate-50 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-slate-900">
                        {c.authorDisplayName ?? c.authorHandle ?? 'Unknown'}
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
              placeholder="Add a comment…"
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
