import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/apiClient';

type EmailProvider = 'none' | 'resend' | 'postmark' | 'sendgrid';

type EmailSettings = {
  enabled: boolean;
  provider: EmailProvider;
  appName: string;
  appBaseUrl: string;
  senderName: string;
  fromEmail: string;
  replyTo: string;
  supportEmail: string;
};

type EmailTemplate = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  subject: string;
  html: string;
  text: string;
  sampleContext: Record<string, unknown>;
};

type ProviderStatus = {
  resendConfigured: boolean;
  postmarkConfigured: boolean;
  sendgridConfigured: boolean;
  activeProviderReady: boolean;
};

type EmailSnapshot = {
  settings: EmailSettings;
  templates: Record<string, EmailTemplate>;
  templateOrder: string[];
  providerStatus: ProviderStatus;
};

type EmailDelivery = {
  _id: string;
  templateKey: string;
  toEmail: string;
  subject: string;
  provider: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  providerMessageId?: string;
  error?: string;
  createdAt: string;
  sentAt?: string;
};

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function formatDate(value?: string): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusPill(status: EmailDelivery['status']): string {
  switch (status) {
    case 'sent':
      return 'bg-emerald-100 text-emerald-700';
    case 'failed':
      return 'bg-rose-100 text-rose-700';
    case 'skipped':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export const EmailAdmin: React.FC = () => {
  const [snapshot, setSnapshot] = useState<EmailSnapshot | null>(null);
  const [deliveries, setDeliveries] = useState<EmailDelivery[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('password_reset');
  const [testEmail, setTestEmail] = useState('');
  const [testContext, setTestContext] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSnapshot, deliveryPayload] = await Promise.all([
        api.get<EmailSnapshot>('/api/admin/email'),
        api.get<{ deliveries: EmailDelivery[] }>('/api/admin/email/deliveries?limit=50'),
      ]);
      setSnapshot(nextSnapshot);
      setDeliveries(deliveryPayload.deliveries ?? []);
      const firstTemplate = nextSnapshot.templateOrder?.[0] ?? 'password_reset';
      setSelectedTemplateKey((current) =>
        nextSnapshot.templates[current] ? current : firstTemplate,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load email admin');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedTemplate = useMemo(() => {
    if (!snapshot) return null;
    return snapshot.templates[selectedTemplateKey] ?? null;
  }, [snapshot, selectedTemplateKey]);

  useEffect(() => {
    if (!selectedTemplate) return;
    setTestContext(prettyJson(selectedTemplate.sampleContext));
  }, [selectedTemplateKey, selectedTemplate]);

  const setSettingsField = <K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) => {
    setSnapshot((current) => {
      if (!current) return current;
      return {
        ...current,
        settings: {
          ...current.settings,
          [key]: value,
        },
      };
    });
  };

  const updateTemplate = (key: string, patch: Partial<EmailTemplate>) => {
    setSnapshot((current) => {
      if (!current) return current;
      const existing = current.templates[key];
      if (!existing) return current;
      return {
        ...current,
        templates: {
          ...current.templates,
          [key]: {
            ...existing,
            ...patch,
          },
        },
      };
    });
  };

  const save = async () => {
    if (!snapshot) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await api.post<EmailSnapshot>('/api/admin/email', {
        settings: snapshot.settings,
        templates: snapshot.templates,
      });
      setSnapshot(next);
      setNotice('Email settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!selectedTemplate) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const context = JSON.parse(testContext);
      await api.post('/api/admin/email/send-test', {
        templateKey: selectedTemplate.key,
        toEmail: testEmail.trim(),
        context,
      });
      setNotice('Test email queued. Refresh deliveries to confirm provider response.');
      const deliveryPayload = await api.get<{ deliveries: EmailDelivery[] }>('/api/admin/email/deliveries?limit=50');
      setDeliveries(deliveryPayload.deliveries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send test email');
    } finally {
      setSending(false);
    }
  };

  if (loading && !snapshot) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">Loading email admin…</div>;
  }

  if (!snapshot) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-rose-600">{error ?? 'Email admin unavailable.'}</div>;
  }

  const templateList = snapshot.templateOrder
    .map((key) => snapshot.templates[key])
    .filter(Boolean);
  const senderUsesResendTestDomain =
    snapshot.settings.provider === 'resend' &&
    snapshot.settings.fromEmail.trim().toLowerCase().endsWith('@resend.dev');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email Admin</h2>
          <p className="mt-1 text-sm text-gray-500">
            Provider selection, sender identity, template editing, and delivery visibility all live here.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Refresh
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {error || notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Provider</h3>
            <p className="text-sm text-gray-500">Secrets stay env-backed. Admin controls which provider is active and how email is branded.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sending enabled</span>
              <select
                value={snapshot.settings.enabled ? 'enabled' : 'disabled'}
                onChange={(e) => setSettingsField('enabled', e.target.value === 'enabled')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="enabled">enabled</option>
                <option value="disabled">disabled</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active provider</span>
              <select
                value={snapshot.settings.provider}
                onChange={(e) => setSettingsField('provider', e.target.value as EmailProvider)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="resend">resend</option>
                <option value="postmark">postmark</option>
                <option value="sendgrid">sendgrid</option>
                <option value="none">none</option>
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">App name</span>
              <input
                value={snapshot.settings.appName}
                onChange={(e) => setSettingsField('appName', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">App base URL</span>
              <input
                value={snapshot.settings.appBaseUrl}
                onChange={(e) => setSettingsField('appBaseUrl', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Sender name</span>
              <input
                value={snapshot.settings.senderName}
                onChange={(e) => setSettingsField('senderName', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">From email</span>
              <input
                value={snapshot.settings.fromEmail}
                onChange={(e) => setSettingsField('fromEmail', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reply-to</span>
              <input
                value={snapshot.settings.replyTo}
                onChange={(e) => setSettingsField('replyTo', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Support email</span>
              <input
                value={snapshot.settings.supportEmail}
                onChange={(e) => setSettingsField('supportEmail', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider readiness</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">Resend env: {snapshot.providerStatus.resendConfigured ? 'ready' : 'missing'}</div>
              <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">Postmark env: {snapshot.providerStatus.postmarkConfigured ? 'ready' : 'missing'}</div>
              <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">SendGrid env: {snapshot.providerStatus.sendgridConfigured ? 'ready' : 'missing'}</div>
              <div className="rounded-lg bg-white px-3 py-2 text-sm text-slate-700">Active provider: {snapshot.providerStatus.activeProviderReady ? 'ready' : 'not ready'}</div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Resend is wired now. The other providers are scaffolded in the admin model but not implemented in the backend adapter yet.
            </p>
            {senderUsesResendTestDomain && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Your From email is still using Resend's test domain. Set it to an address on your verified domain, for example hello@papera.io.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Templates</h3>
            <p className="text-sm text-gray-500">Edit subjects and bodies once. Runtime events pull from these templates.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              {templateList.map((template) => (
                <button
                  key={template.key}
                  onClick={() => setSelectedTemplateKey(template.key)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    selectedTemplateKey === template.key
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">{template.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${template.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {template.enabled ? 'on' : 'off'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{template.description}</p>
                </button>
              ))}
            </div>

            {selectedTemplate && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">{selectedTemplate.label}</h4>
                    <p className="text-xs text-gray-500">{selectedTemplate.description}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedTemplate.enabled}
                      onChange={(e) => updateTemplate(selectedTemplate.key, { enabled: e.target.checked })}
                    />
                    enabled
                  </label>
                </div>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Subject</span>
                  <input
                    value={selectedTemplate.subject}
                    onChange={(e) => updateTemplate(selectedTemplate.key, { subject: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">HTML</span>
                  <textarea
                    value={selectedTemplate.html}
                    onChange={(e) => updateTemplate(selectedTemplate.key, { html: e.target.value })}
                    rows={13}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Text fallback</span>
                  <textarea
                    value={selectedTemplate.text}
                    onChange={(e) => updateTemplate(selectedTemplate.key, { text: e.target.value })}
                    rows={7}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                  />
                </label>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Send test</h3>
            <p className="text-sm text-gray-500">Use the selected template with custom JSON context. This is the admin foundation for future custom sends.</p>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recipient</span>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="founder@example.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Template context (JSON)</span>
            <textarea
              value={testContext}
              onChange={(e) => setTestContext(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            />
          </label>

          <button
            onClick={sendTest}
            disabled={sending || !testEmail.trim()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {sending ? 'Queueing…' : `Send ${selectedTemplate?.label ?? 'template'} test`}
          </button>
        </section>

        <section className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Recent deliveries</h3>
              <p className="text-sm text-gray-500">Operational visibility for transactional email sends.</p>
            </div>
            <button
              onClick={() => void load()}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Refresh log
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Template</th>
                  <th className="px-3 py-2">To</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Subject / error</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                      No delivery records yet.
                    </td>
                  </tr>
                ) : deliveries.map((delivery) => (
                  <tr key={delivery._id} className="border-b last:border-b-0 align-top">
                    <td className="px-3 py-3 text-xs text-gray-500">{formatDate(delivery.sentAt || delivery.createdAt)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-gray-700">{delivery.templateKey}</td>
                    <td className="px-3 py-3 text-xs text-gray-700">{delivery.toEmail}</td>
                    <td className="px-3 py-3 text-xs text-gray-700">{delivery.provider}</td>
                    <td className="px-3 py-3">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${statusPill(delivery.status)}`}>
                        {delivery.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-600">
                      <div className="font-medium text-gray-800">{delivery.subject}</div>
                      {delivery.error && <div className="mt-1 text-rose-600">{delivery.error}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
