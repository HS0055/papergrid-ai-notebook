import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Globe, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { api as apiClient } from '../../services/apiClient';
import { BlogPost, BlogStatus, DEFAULT_BLOG_POSTS, formatDate } from '../blog/blogData';

interface BlogAdminResponse {
  posts: BlogPost[];
}

interface BlogSaveResponse {
  post: BlogPost;
}

interface BlogForm {
  postId?: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: BlogStatus;
  category: string;
  mentalState: string;
  tags: string;
  featuredImageUrl: string;
  interactivePrompt: string;
  interactivePlaceholder: string;
  interactiveOutputTitle: string;
  productCtaLabel: string;
  productCtaUrl: string;
  seoTitle: string;
  seoDescription: string;
  authorName: string;
}

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

const emptyForm = (): BlogForm => ({
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  status: 'draft',
  category: '',
  mentalState: '',
  tags: '',
  featuredImageUrl: '',
  interactivePrompt: 'What thought are you trying to work through?',
  interactivePlaceholder: 'Describe what you\'re stuck on or thinking about...',
  interactiveOutputTitle: 'Your first usable structure',
  productCtaLabel: 'Open Papera',
  productCtaUrl: '/app',
  seoTitle: '',
  seoDescription: '',
  authorName: 'Papera',
});

const toForm = (post: BlogPost): BlogForm => ({
  postId: post._id,
  title: post.title,
  slug: post.slug,
  excerpt: post.excerpt,
  body: post.body || '',
  status: post.status || 'draft',
  category: post.category,
  mentalState: post.mentalState,
  tags: post.tags.join(', '),
  featuredImageUrl: post.featuredImageUrl || '',
  interactivePrompt: post.interactivePrompt,
  interactivePlaceholder: post.interactivePlaceholder,
  interactiveOutputTitle: post.interactiveOutputTitle,
  productCtaLabel: post.productCtaLabel,
  productCtaUrl: post.productCtaUrl,
  seoTitle: post.seoTitle || post.title,
  seoDescription: post.seoDescription || post.excerpt,
  authorName: post.authorName || 'Papera',
});

const toPayload = (form: BlogForm) => ({
  title: form.title,
  slug: form.slug,
  excerpt: form.excerpt,
  body: form.body,
  status: form.status,
  category: form.category,
  mentalState: form.mentalState,
  tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
  featuredImageUrl: form.featuredImageUrl || undefined,
  interactivePrompt: form.interactivePrompt,
  interactivePlaceholder: form.interactivePlaceholder,
  interactiveOutputTitle: form.interactiveOutputTitle,
  productCtaLabel: form.productCtaLabel,
  productCtaUrl: form.productCtaUrl,
  seoTitle: form.seoTitle || undefined,
  seoDescription: form.seoDescription || undefined,
  authorName: form.authorName || undefined,
});

const statusClass: Record<BlogStatus, string> = {
  draft: 'bg-stone-100 text-stone-700 border-stone-200',
  published: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  archived: 'bg-amber-100 text-amber-700 border-amber-200',
};

export const BlogAdmin: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [form, setForm] = useState<BlogForm>(() => emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<BlogAdminResponse>('/api/blog/admin/posts?limit=150');
      setPosts(data?.posts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  const selectedPost = useMemo(
    () => posts.find((post) => post._id === form.postId),
    [form.postId, posts],
  );

  const updateForm = (patch: Partial<BlogForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const updateTitle = (title: string) => {
    setForm((current) => {
      const oldAutoSlug = slugify(current.title);
      const shouldUpdateSlug = !current.slug || current.slug === oldAutoSlug;
      return {
        ...current,
        title,
        slug: shouldUpdateSlug ? slugify(title) : current.slug,
      };
    });
  };

  const newDraft = () => {
    setForm(emptyForm());
    setError(null);
  };

  const validateForm = (f: BlogForm): string | null => {
    if (!f.title.trim()) return 'Title is required';
    if (!f.slug.trim()) return 'Slug is required — type a title to auto-fill it';
    if (!f.excerpt.trim()) return 'Excerpt is required';
    if (!f.body.trim()) return 'Article body is required';
    if (!f.category.trim()) return 'Category is required';
    if (!f.mentalState.trim()) return 'Mental state is required';
    return null;
  };

  const save = async (overrideStatus?: BlogForm['status']) => {
    const submitting = overrideStatus ? { ...form, status: overrideStatus } : form;
    const validationError = validateForm(submitting);
    if (validationError) { setError(validationError); return; }
    setSaving(true);
    setError(null);
    try {
      const data = await apiClient.post<BlogSaveResponse>('/api/blog/admin/posts', {
        postId: submitting.postId,
        post: toPayload(submitting),
      });
      if (overrideStatus) setForm((f) => ({ ...f, status: overrideStatus }));
      await loadPosts();
      if (data?.post) setForm(toForm(data.post));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save blog post');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!form.postId) return;
    const confirmed = window.confirm('Delete this blog post? This cannot be undone.');
    if (!confirmed) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/api/blog/admin/delete', { postId: form.postId });
      setForm(emptyForm());
      await loadPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete blog post');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold text-gray-900">Blog posts</h2>
            <p className="text-xs text-gray-500">Interactive SEO guides</p>
          </div>
          <button
            onClick={newDraft}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            <Plus size={14} />
            New
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-5 text-sm text-gray-500">
            <Loader2 size={16} className="animate-spin" />
            Loading posts
          </div>
        ) : (
          <div className="max-h-[680px] overflow-y-auto p-3">
            {posts.length === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
                No database posts yet. Save the starter draft to publish the first guide.
              </p>
            )}
            {posts.map((post) => (
              <button
                key={post._id}
                onClick={() => setForm(toForm(post))}
                className={`mb-2 w-full rounded-lg border p-3 text-left transition ${
                  form.postId === post._id
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold leading-snug text-gray-900">{post.title}</div>
                    <div className="mt-1 text-xs text-gray-500">/{post.slug}</div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass[post.status || 'draft']}`}>
                    {post.status || 'draft'}
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {post.category} / {formatDate(post.publishedAt)}
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section className="rounded-xl border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {form.postId ? 'Edit blog guide' : 'New blog guide'}
            </h2>
            <p className="text-sm text-gray-500">
              Blog teaches. Papera executes. Keep every guide tied to one mental state.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedPost?.slug && selectedPost.status === 'published' && (
              <a
                href={`/blog/${selectedPost.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:border-emerald-500 hover:text-emerald-700"
              >
                View live
                <ArrowUpRight size={15} />
              </a>
            )}
            {form.postId && (
              <button
                onClick={remove}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={15} />
                Delete
              </button>
            )}
            <button
              onClick={() => save()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save draft
            </button>
            <button
              onClick={() => save('published')}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Globe size={15} />}
              {form.status === 'published' ? 'Update live' : 'Publish'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-2">
          <Field label="Title">
            <input
              value={form.title}
              onChange={(event) => updateTitle(event.target.value)}
              onBlur={() => updateForm({ slug: form.slug || slugify(form.title) })}
              className="admin-input"
            />
          </Field>
          <Field label="Slug">
            <input
              value={form.slug}
              onChange={(event) => updateForm({ slug: slugify(event.target.value) })}
              className="admin-input"
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(event) => updateForm({ status: event.target.value as BlogStatus })}
              className="admin-input"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Category">
            <input value={form.category} onChange={(event) => updateForm({ category: event.target.value })} className="admin-input" />
          </Field>
          <Field label="Mental state">
            <input value={form.mentalState} onChange={(event) => updateForm({ mentalState: event.target.value })} className="admin-input" />
          </Field>
          <Field label="Tags">
            <input value={form.tags} onChange={(event) => updateForm({ tags: event.target.value })} className="admin-input" />
          </Field>
          <Field label="Featured image URL">
            <input value={form.featuredImageUrl} onChange={(event) => updateForm({ featuredImageUrl: event.target.value })} className="admin-input" />
          </Field>
          <Field label="Author">
            <input value={form.authorName} onChange={(event) => updateForm({ authorName: event.target.value })} className="admin-input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 px-5 pb-5 lg:grid-cols-2">
          <Field label="Excerpt">
            <textarea value={form.excerpt} onChange={(event) => updateForm({ excerpt: event.target.value })} rows={4} className="admin-input" />
          </Field>
          <Field label="SEO description">
            <textarea value={form.seoDescription} onChange={(event) => updateForm({ seoDescription: event.target.value })} rows={4} className="admin-input" />
          </Field>
        </div>

        <div className="px-5 pb-5">
          <Field label="Article body">
            <textarea
              value={form.body}
              onChange={(event) => updateForm({ body: event.target.value })}
              rows={16}
              className="admin-input font-mono text-sm"
              placeholder="# Heading&#10;Paragraph&#10;&#10;## Section&#10;- Bullet"
            />
          </Field>
        </div>

        <div className="border-t px-5 py-5">
          <h3 className="font-semibold text-gray-900">Interactive block</h3>
          <p className="mt-1 text-sm text-gray-500">
            This is the bridge: reader input becomes a small Papera-style output.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Field label="Prompt">
              <input value={form.interactivePrompt} onChange={(event) => updateForm({ interactivePrompt: event.target.value })} className="admin-input" />
            </Field>
            <Field label="Output title">
              <input value={form.interactiveOutputTitle} onChange={(event) => updateForm({ interactiveOutputTitle: event.target.value })} className="admin-input" />
            </Field>
            <Field label="CTA label">
              <input value={form.productCtaLabel} onChange={(event) => updateForm({ productCtaLabel: event.target.value })} className="admin-input" />
            </Field>
            <Field label="CTA URL">
              <input value={form.productCtaUrl} onChange={(event) => updateForm({ productCtaUrl: event.target.value })} className="admin-input" />
            </Field>
            <div className="lg:col-span-2">
              <Field label="Placeholder">
                <textarea value={form.interactivePlaceholder} onChange={(event) => updateForm({ interactivePlaceholder: event.target.value })} rows={4} className="admin-input" />
              </Field>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
    {children}
  </label>
);
