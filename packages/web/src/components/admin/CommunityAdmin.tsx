import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bug,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Lightbulb,
  Loader2,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Pin,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { api as apiClient } from '../../services/apiClient';

type CommunityKind = 'feedback' | 'feature_request' | 'bug' | 'announcement';

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
  kind?: CommunityKind | 'discussion';
  roadmapStatus?: 'open' | 'planned' | 'in_progress' | 'shipped' | 'declined';
  createdAt: string;
  pinnedAt?: string;
  authorHandle?: string;
  authorDisplayName?: string;
  authorAvatarUrl?: string;
  authorRole?: 'user' | 'admin';
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
  authorRole?: 'user' | 'admin';
}

interface FeedResponse {
  page: FeedPost[];
}

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

const FILTERS: Array<{
  id: CommunityKind;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    id: 'feedback',
    label: 'Feedback',
    icon: <MessageSquare size={16} />,
    description: 'Answer user sentiment and product opinions.',
  },
  {
    id: 'feature_request',
    label: 'Feature Requests',
    icon: <Lightbulb size={16} />,
    description: 'Reply and move ideas through the roadmap.',
  },
  {
    id: 'bug',
    label: 'Bugs',
    icon: <Bug size={16} />,
    description: 'Acknowledge issues and give status updates.',
  },
  {
    id: 'announcement',
    label: 'News',
    icon: <Megaphone size={16} />,
    description: 'Publish launch notes and product updates.',
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

const hydratePost = (payload: PostResponse | null): FeedPost | null => {
  if (!payload) return null;
  return {
    ...payload.post,
    authorHandle: payload.author?.handle,
    authorDisplayName: payload.author?.displayName,
    authorAvatarUrl: payload.author?.avatarUrl,
    authorRole: payload.authorRole,
  };
};

export function CommunityAdmin() {
  const [kind, setKind] = useState<CommunityKind>('feedback');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [replyDraft, setReplyDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [postingReply, setPostingReply] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<FeedResponse>(`/api/community/feed?sort=recent&kind=${kind}&limit=40`);
      const nextPosts = kind === 'announcement' ? sortAnnouncements(data.page) : data.page;
      setPosts(nextPosts);
      setSelectedPostId((current) => {
        if (current && nextPosts.some((post) => post._id === current)) return current;
        return nextPosts[0]?._id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load community inbox');
      setPosts([]);
      setSelectedPostId(null);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  const loadDetail = useCallback(async (postId: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const [postRes, commentsRes] = await Promise.all([
        apiClient.get<{ post: PostResponse | null }>(`/api/community/post?id=${postId}`),
        apiClient.get<{ comments: Comment[] }>(`/api/community/comments?postId=${postId}`),
      ]);
      setSelectedPost(hydratePost(postRes.post));
      setComments(commentsRes.comments);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load thread');
      setSelectedPost(null);
      setComments([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (!selectedPostId) {
      setSelectedPost(null);
      setComments([]);
      return;
    }
    void loadDetail(selectedPostId);
  }, [loadDetail, selectedPostId]);

  const selectedMeta = useMemo(
    () => FILTERS.find((entry) => entry.id === kind) ?? FILTERS[0],
    [kind],
  );

  const postReply = async () => {
    if (!selectedPostId || !replyDraft.trim()) return;
    setPostingReply(true);
    setError(null);
    try {
      await apiClient.post('/api/community/comments', {
        postId: selectedPostId,
        body: replyDraft.trim(),
      });
      setReplyDraft('');
      await Promise.all([loadFeed(), loadDetail(selectedPostId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setPostingReply(false);
    }
  };

  const setRoadmap = async (status: NonNullable<FeedPost['roadmapStatus']>) => {
    if (!selectedPostId) return;
    setError(null);
    try {
      await apiClient.post('/api/community/admin/roadmap-status', {
        postId: selectedPostId,
        roadmapStatus: status,
      });
      await Promise.all([loadFeed(), loadDetail(selectedPostId)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update roadmap');
    }
  };

  const onNewsPublished = async (postId: string) => {
    setComposerOpen(false);
    setSelectedPostId(postId);
    if (kind === 'announcement') {
      await loadFeed();
      return;
    }
    setKind('announcement');
  };

  const removeSelectedPost = async () => {
    if (!selectedPostId || !selectedPost) return;
    const confirmed = window.confirm(
      `Remove "${selectedPost.title}" from the public community?`,
    );
    if (!confirmed) return;

    setDeletingPost(true);
    setError(null);
    try {
      await apiClient.post('/api/community/admin/delete-post', {
        postId: selectedPostId,
      });
      setSelectedPostId(null);
      setSelectedPost(null);
      setComments([]);
      await loadFeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove post');
    } finally {
      setDeletingPost(false);
    }
  };

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[360px,minmax(0,1fr)]">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#0f172a_0%,#1e1b4b_100%)] px-5 py-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-indigo-200">
                  Community Inbox
                </p>
                <h2 className="mt-2 font-serif text-2xl font-bold">Reply and publish from one place</h2>
                <p className="mt-2 text-sm text-slate-200/85">
                  Official replies show up instantly in the public community. News posts land in the in-app newsroom.
                </p>
              </div>
              <button
                onClick={() => setComposerOpen(true)}
                className="shrink-0 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                Publish news
              </button>
            </div>
          </div>

          <div className="p-4">
            <div className="grid gap-2">
              {FILTERS.map((filter) => {
                const active = filter.id === kind;
                return (
                  <button
                    key={filter.id}
                    onClick={() => setKind(filter.id)}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      active
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {filter.icon}
                      {filter.label}
                    </div>
                    <p className={`mt-1 text-xs ${active ? 'text-indigo-700' : 'text-slate-500'}`}>
                      {filter.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between px-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {selectedMeta.label}
                </p>
                <p className="text-sm text-slate-500">{posts.length} visible posts</p>
              </div>
              <button
                onClick={() => void loadFeed()}
                className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {loading && (
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-slate-400">
                  <Loader2 size={22} className="animate-spin" />
                </div>
              )}

              {!loading && posts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
                  <p className="font-serif text-lg font-semibold text-slate-800">Nothing here yet</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {kind === 'announcement'
                      ? 'Publish the first news post for users.'
                      : 'When people post here, this queue will populate automatically.'}
                  </p>
                </div>
              )}

              {!loading && posts.map((post) => {
                const active = selectedPostId === post._id;
                const roadmap = post.roadmapStatus ? ROADMAP_STATUS[post.roadmapStatus] : null;
                return (
                  <button
                    key={post._id}
                    onClick={() => setSelectedPostId(post._id)}
                    className={`block w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      active
                        ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {post.kind === 'announcement' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                          <Megaphone size={10} /> News
                        </span>
                      )}
                      {post.pinnedAt && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                          <Pin size={10} /> Pinned
                        </span>
                      )}
                      {roadmap && (
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${roadmap.color}`}>
                          {roadmap.icon} {roadmap.label}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 line-clamp-2 font-serif text-lg font-bold text-slate-900">{post.title}</h3>
                    <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">{post.body}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>{post.authorDisplayName || post.authorHandle || 'Unknown'}</span>
                      <span>{timeAgo(post.createdAt)}</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle size={12} />
                        {post.commentCount}
                      </span>
                      <span>{post.likeCount} votes</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">Thread Workspace</p>
            <h2 className="mt-2 font-serif text-2xl font-bold text-slate-900">
              {selectedPost ? selectedPost.title : 'Select a conversation'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Respond as the team, publish context, and update roadmap state without leaving admin.
            </p>
          </div>

          <div className="min-h-[720px] bg-slate-50/70 px-6 py-5">
            {detailLoading && (
              <div className="flex items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-24 text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            )}

            {!detailLoading && !selectedPost && (
              <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-24 text-center">
                <div>
                  <p className="font-serif text-xl font-semibold text-slate-900">Pick a post to manage</p>
                  <p className="mt-2 text-sm text-slate-500">
                    The selected thread will show public details, comments, and reply tools here.
                  </p>
                </div>
              </div>
            )}

            {!detailLoading && selectedPost && (
              <div className="space-y-4">
                <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedPost.kind === 'announcement' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-indigo-700">
                            <Megaphone size={12} /> News
                          </span>
                        )}
                        {selectedPost.pinnedAt && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">
                            <Pin size={12} /> Pinned
                          </span>
                        )}
                        {selectedPost.authorRole === 'admin' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white">
                            <ShieldCheck size={12} /> Official
                          </span>
                        )}
                        {selectedPost.roadmapStatus && (
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] ${ROADMAP_STATUS[selectedPost.roadmapStatus].color}`}>
                            {ROADMAP_STATUS[selectedPost.roadmapStatus].icon}
                            {ROADMAP_STATUS[selectedPost.roadmapStatus].label}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {selectedPost.authorDisplayName || selectedPost.authorHandle || 'Unknown'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {timeAgo(selectedPost.createdAt)} · {selectedPost.commentCount} comments · {selectedPost.likeCount} votes
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => void removeSelectedPost()}
                      disabled={deletingPost}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingPost ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      Remove post
                    </button>
                  </div>

                  <div className={`mt-4 rounded-2xl ${selectedPost.kind === 'announcement' ? 'border border-indigo-100 bg-indigo-50/80 p-4' : ''}`}>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {selectedPost.body}
                    </p>
                  </div>

                  {selectedPost.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedPost.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </article>

                {selectedPost.kind === 'feature_request' && (
                  <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">
                      Roadmap Control
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(Object.keys(ROADMAP_STATUS) as Array<keyof typeof ROADMAP_STATUS>).map((status) => {
                        const meta = ROADMAP_STATUS[status];
                        const active = selectedPost.roadmapStatus === status;
                        return (
                          <button
                            key={status}
                            onClick={() => void setRoadmap(status)}
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                              active ? meta.color : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {meta.icon}
                            {meta.label}
                            {active && <Check size={12} />}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">
                        Official Reply
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Your response is posted publicly and marked as an official team reply inside the app.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-end gap-3">
                    <textarea
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder="Write the response users should see in the community thread…"
                      className="min-h-[120px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-500 focus:bg-white"
                    />
                    <button
                      onClick={() => void postReply()}
                      disabled={postingReply || !replyDraft.trim()}
                      className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {postingReply ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Send
                    </button>
                  </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">
                        Public Thread
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Official responses are highlighted so people can quickly find the team answer.
                      </p>
                    </div>
                    <button
                      onClick={() => selectedPostId && void loadDetail(selectedPostId)}
                      className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                    >
                      Refresh thread
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {comments.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                        No comments yet.
                      </div>
                    )}

                    {comments.map((comment) => (
                      <article
                        key={comment._id}
                        className={`rounded-2xl border px-4 py-4 ${
                          comment.authorRole === 'admin'
                            ? 'border-indigo-100 bg-indigo-50/80'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {comment.authorDisplayName || comment.authorHandle || 'Unknown'}
                          </p>
                          {comment.authorRole === 'admin' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                              <ShieldCheck size={10} /> Official reply
                            </span>
                          )}
                          <span className="text-xs text-slate-400">{timeAgo(comment.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {comment.body}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {composerOpen && (
        <AnnouncementComposerModal
          onClose={() => setComposerOpen(false)}
          onCreated={(postId) => void onNewsPublished(postId)}
        />
      )}
    </>
  );
}

const AnnouncementComposerModal: React.FC<{
  onClose: () => void;
  onCreated: (postId: string) => void;
}> = ({ onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [pinned, setPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tags = useMemo(
    () =>
      tagInput
        .split(/[,\s]+/)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8),
    [tagInput],
  );

  const submit = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiClient.post<{ postId: string }>('/api/community/admin/announce', {
        title: title.trim(),
        body: body.trim(),
        tags,
        pinned,
      });
      onCreated(result.postId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish news');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-slate-400">Community News</p>
            <h3 className="mt-2 font-serif text-2xl font-bold text-slate-900">Publish a newsroom post</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={140}
            placeholder="What shipped, launched, or changed?"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-serif text-base text-slate-900 outline-none transition-colors focus:border-indigo-500"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={8}
            maxLength={8000}
            placeholder="Explain the update in a way users can understand."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-500"
          />
          <input
            type="text"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            placeholder="release, launch, ios, roadmap"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition-colors focus:border-indigo-500"
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(event) => setPinned(event.target.checked)}
              className="rounded border-slate-300"
            />
            Pin this post to the top of the public news feed
          </label>
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
            Publish
          </button>
        </div>
      </div>
    </div>
  );
};
