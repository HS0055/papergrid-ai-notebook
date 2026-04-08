import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, MessageCircle, Users, Plus, ArrowLeft, Loader2, X, Send,
} from 'lucide-react';
import { api as apiClient, getSessionToken } from '../../services/apiClient';
import { useAuth } from '../../hooks/useAuth';

// ─────────────────────────────────────────────────────────────
// CommunityPage — minimal MVP feed + composer + profile modal
//
// This is a thin shell over the /api/community/* HTTP routes so users
// can actually see the community module working. More polish (infinite
// scroll, nested comments, followers list) is deliberately deferred.
// ─────────────────────────────────────────────────────────────

type Sort = 'recent' | 'trending' | 'featured';

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
  const [sort, setSort] = useState<Sort>('recent');
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
        `/api/community/feed?sort=${sort}&limit=30`,
      );
      setPosts(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const toggleLike = async (postId: string) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    // Optimistic update.
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
      // Revert on failure.
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
      setError(err instanceof Error ? err.message : 'Failed to like');
    }
  };

  const handlePostCreated = (id: string) => {
    setComposerOpen(false);
    loadFeed();
    setActivePostId(id);
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-black/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/app')}
            className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-colors"
            aria-label="Back to notebooks"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h1 className="font-serif text-xl font-bold leading-tight">Community</h1>
            <p className="text-xs text-gray-500">Share your layouts. Discover new ones.</p>
          </div>
          {isAuthenticated && (
            <button
              onClick={() => setComposerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">New post</span>
            </button>
          )}
        </div>
        <div className="max-w-3xl mx-auto px-4 flex gap-2 pb-2">
          {(['recent', 'trending', 'featured'] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                sort === s
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-black/5'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <main className="max-w-3xl mx-auto px-4 py-6">
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
          <div className="py-16 text-center">
            <Users size={40} className="mx-auto mb-4 text-gray-300" />
            <h2 className="font-serif text-xl font-bold text-slate-800 mb-1">No posts yet</h2>
            <p className="text-sm text-gray-500 mb-4">Be the first to share a layout.</p>
            {isAuthenticated ? (
              <button
                onClick={() => setComposerOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} /> Create first post
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
              >
                Sign in to post
              </button>
            )}
          </div>
        )}

        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onLike={() => toggleLike(post._id)}
              onOpen={() => setActivePostId(post._id)}
            />
          ))}
        </div>
      </main>

      {composerOpen && (
        <ComposerModal
          onClose={() => setComposerOpen(false)}
          onCreated={handlePostCreated}
          authorName={user?.name}
        />
      )}
      {activePostId && (
        <PostDetailModal
          postId={activePostId}
          onClose={() => setActivePostId(null)}
          onLikeToggle={() => toggleLike(activePostId)}
          onCommentAdded={loadFeed}
        />
      )}
    </div>
  );
};

// ────────── PostCard ──────────
interface PostCardProps {
  post: FeedPost;
  onLike: () => void;
  onOpen: () => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onLike, onOpen }) => {
  return (
    <article className="bg-white rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div
        className="p-5 cursor-pointer"
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpen();
        }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
            style={{
              background: post.authorAvatarUrl
                ? `url(${post.authorAvatarUrl}) center/cover`
                : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
            }}
          >
            {!post.authorAvatarUrl && (post.authorDisplayName?.[0]?.toUpperCase() ?? '?')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {post.authorDisplayName || post.authorHandle || 'Unknown'}
            </p>
            {post.authorHandle && (
              <p className="text-xs text-gray-500">@{post.authorHandle} · {timeAgo(post.createdAt)}</p>
            )}
          </div>
        </div>
        <h3 className="font-serif text-lg font-bold text-slate-900 mb-1">{post.title}</h3>
        <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">{post.body}</p>
        {post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 5).map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="px-5 py-3 border-t border-black/5 flex items-center gap-4 text-sm text-gray-600">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onLike();
          }}
          className={`inline-flex items-center gap-1.5 transition-colors ${
            post.likedByMe ? 'text-rose-600' : 'hover:text-rose-600'
          }`}
          aria-label={post.likedByMe ? 'Unlike post' : 'Like post'}
        >
          <Heart size={16} fill={post.likedByMe ? 'currentColor' : 'none'} />
          <span className="font-semibold">{post.likeCount}</span>
        </button>
        <button
          onClick={onOpen}
          className="inline-flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
          aria-label="View comments"
        >
          <MessageCircle size={16} />
          <span className="font-semibold">{post.commentCount}</span>
        </button>
      </div>
    </article>
  );
};

// ────────── ComposerModal ──────────
interface ComposerModalProps {
  onClose: () => void;
  onCreated: (postId: string) => void;
  authorName?: string;
}

const ComposerModal: React.FC<ComposerModalProps> = ({ onClose, onCreated, authorName }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      const result = await apiClient.post<{ postId: string }>('/api/community/posts', {
        title: title.trim(),
        body: body.trim(),
        tags,
      });
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
          <h2 className="font-serif text-lg font-bold">New post</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full hover:bg-black/5">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {authorName && <p className="text-xs text-gray-500">Posting as {authorName}</p>}
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-serif text-base"
          />
          <textarea
            placeholder="Share your layout, story, or tip…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={8000}
            rows={8}
            className="w-full px-4 py-3 rounded-xl border border-black/10 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-sm resize-y"
          />
          <input
            type="text"
            placeholder="Tags (comma or space separated, up to 8)"
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
  onClose: () => void;
  onLikeToggle: () => void;
  onCommentAdded: () => void;
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({
  postId, onClose, onLikeToggle, onCommentAdded,
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

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl h-[90vh] sm:h-[85vh] overflow-hidden shadow-2xl flex flex-col"
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
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{
                    background: post.authorAvatarUrl
                      ? `url(${post.authorAvatarUrl}) center/cover`
                      : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                  }}
                >
                  {!post.authorAvatarUrl && (post.authorDisplayName?.[0]?.toUpperCase() ?? '?')}
                </div>
                <div>
                  <p className="font-semibold text-sm">{post.authorDisplayName ?? post.authorHandle ?? 'Unknown'}</p>
                  {post.authorHandle && (
                    <p className="text-xs text-gray-500">@{post.authorHandle} · {timeAgo(post.createdAt)}</p>
                  )}
                </div>
              </div>
              <h1 className="font-serif text-2xl font-bold mb-2">{post.title}</h1>
              <p className="text-sm text-slate-700 whitespace-pre-wrap mb-4 leading-relaxed">{post.body}</p>
              {post.tags.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {post.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 py-3 border-y border-black/5">
                <button
                  onClick={onLikeToggle}
                  className={`inline-flex items-center gap-1.5 text-sm ${post.likedByMe ? 'text-rose-600' : 'text-gray-600 hover:text-rose-600'}`}
                >
                  <Heart size={16} fill={post.likedByMe ? 'currentColor' : 'none'} />
                  <span className="font-semibold">{post.likeCount}</span>
                </button>
                <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                  <MessageCircle size={16} />
                  <span className="font-semibold">{comments.length}</span>
                </span>
              </div>

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
