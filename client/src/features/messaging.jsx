/**
 * The message inbox, shared by teachers and parents.
 *
 * Both sides see the same conversation about the same child, so the component
 * is one piece of code parameterised by an adapter — which list endpoint to
 * call, which reply endpoint, and how to label the other party.
 */
import { useEffect, useRef, useState } from 'react';
import { Send, Inbox, ArrowLeft } from 'lucide-react';
import { useAction, useApi } from '../lib/hooks';
import {
  Alert, AsyncSection, Avatar, Badge, Button, Card, EmptyState, PageHeader,
  Textarea, cx, toast,
} from '../ui';
import { timeAgo } from '../lib/format';

export function MessageCentre({
  eyebrow, title, description, adapter, emptyDescription, actions,
}) {
  const [openThreadId, setOpenThreadId] = useState(null);
  const threads = useApi(() => adapter.threads(), []);

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />

      <AsyncSection query={threads} rows={4}>
        {(rows) => {
          if (!rows.length) {
            return (
              <EmptyState
                icon={<Inbox size={28} />}
                title="No conversations yet"
                description={emptyDescription}
              />
            );
          }

          const selected = rows.find((t) => t.id === openThreadId) || null;

          return (
            <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
              {/* Thread list — hidden on mobile once a thread is open */}
              <Card padded={false} className={cx(selected && 'hidden lg:block')}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <p className="text-[0.8rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
                    {rows.length} conversation{rows.length === 1 ? '' : 's'}
                  </p>
                </div>
                <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {rows.map((thread) => {
                    const active = thread.id === openThreadId;
                    const other = adapter.otherParty(thread);
                    return (
                      <li key={thread.id}>
                        <button
                          type="button"
                          onClick={() => setOpenThreadId(thread.id)}
                          className="flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors"
                          style={active ? { background: 'var(--accent-soft)' } : undefined}
                        >
                          <Avatar name={other} size={34} tone={active ? 'accent' : 'neutral'} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span
                                className="truncate text-[0.84rem] font-semibold"
                                style={{ color: active ? 'var(--accent-text)' : 'var(--text-strong)' }}
                              >
                                {other}
                              </span>
                              {thread.unread > 0 && <Badge tone="risk" size="sm">{thread.unread}</Badge>}
                            </span>
                            <span className="block truncate text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
                              {thread.first_name} {thread.last_name} · {thread.subject}
                            </span>
                            <span className="mt-0.5 block truncate text-[0.76rem]" style={{ color: 'var(--text-body)' }}>
                              {thread.last_body || 'No messages yet'}
                            </span>
                            <span className="mt-0.5 block text-[0.7rem]" style={{ color: 'var(--text-muted)' }}>
                              {timeAgo(thread.last_message_at)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Card>

              {/* Conversation */}
              {selected ? (
                <Conversation
                  key={selected.id}
                  thread={selected}
                  adapter={adapter}
                  onBack={() => setOpenThreadId(null)}
                  onSent={threads.reload}
                />
              ) : (
                <Card className="hidden items-center justify-center lg:flex">
                  <p className="py-16 text-center text-[0.85rem]" style={{ color: 'var(--text-muted)' }}>
                    Choose a conversation to read it.
                  </p>
                </Card>
              )}
            </div>
          );
        }}
      </AsyncSection>
    </>
  );
}

function Conversation({ thread, adapter, onBack, onSent }) {
  const query = useApi(() => adapter.thread(thread.id), [thread.id]);
  const [draft, setDraft] = useState('');
  const endRef = useRef(null);

  const reply = useAction(
    () => adapter.reply(thread.id, draft.trim()),
    {
      onSuccess: () => { setDraft(''); toast('Message sent'); query.reload(); onSent(); },
    }
  );

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [query.data?.messages?.length]);

  return (
    <Card padded={false} className="flex min-h-[28rem] flex-col">
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={onBack} icon={<ArrowLeft size={15} />}>
          Back
        </Button>
        <div className="min-w-0">
          <p className="truncate text-[0.88rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
            {adapter.otherParty(thread)}
          </p>
          <p className="truncate text-[0.75rem]" style={{ color: 'var(--text-muted)' }}>
            About {thread.first_name} {thread.last_name} · {thread.subject}
          </p>
        </div>
      </div>

      <AsyncSection query={query} rows={3}>
        {(data) => (
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {data.messages.map((message) => {
              const mine = adapter.isOwnMessage(message);
              return (
                <div key={message.id} className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div
                    className="max-w-[82%] rounded-2xl px-3.5 py-2.5"
                    style={mine
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { background: 'var(--surface-sunken)', color: 'var(--text-body)' }}
                  >
                    {!mine && (
                      <p className="mb-0.5 text-[0.72rem] font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {message.sender_name}
                      </p>
                    )}
                    <p className="term whitespace-pre-line text-[0.85rem] leading-relaxed">{message.body}</p>
                    <p
                      className="mt-1 text-[0.68rem]"
                      style={{ color: mine ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}
                    >
                      {timeAgo(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </AsyncSection>

      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        {reply.error && <Alert tone="risk" className="mb-2">{reply.error.message}</Alert>}
        <div className="flex items-end gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Write a reply…"
            className="flex-1"
            onKeyDown={(event) => {
              // Ctrl/Cmd+Enter sends, so a plain Enter can still make a new line.
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && draft.trim()) {
                event.preventDefault();
                reply.run().catch(() => {});
              }
            }}
          />
          <Button
            variant="primary"
            busy={reply.busy}
            disabled={!draft.trim()}
            icon={<Send size={15} />}
            onClick={() => reply.run().catch(() => {})}
          >
            Send
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Notices feed, shared by the teacher and family portals. */
export function NoticeFeed({ notices, emptyDescription }) {
  if (!notices.length) {
    return <EmptyState title="No notices right now" description={emptyDescription} />;
  }
  return (
    <div className="space-y-3">
      {notices.map((notice) => (
        <Card key={notice.id} className={notice.is_pinned === 1 ? undefined : undefined}
          style={notice.is_pinned === 1
            ? { background: 'var(--surface-card)', border: '1px solid var(--accent)', boxShadow: 'var(--shadow-card)' }
            : undefined}
        >
          <p className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[0.93rem] font-semibold" style={{ color: 'var(--text-strong)' }}>
              {notice.title}
            </span>
            {notice.is_pinned === 1 && <Badge tone="accent" size="sm">Pinned</Badge>}
            {notice.class_name && <Badge tone="neutral" size="sm">{notice.class_name}</Badge>}
          </p>
          <p className="whitespace-pre-line text-[0.85rem] leading-relaxed" style={{ color: 'var(--text-body)' }}>
            {notice.body}
          </p>
          <p className="mt-2 text-[0.73rem]" style={{ color: 'var(--text-muted)' }}>
            {notice.author ? `${notice.author} · ` : ''}{timeAgo(notice.created_at)}
          </p>
        </Card>
      ))}
    </div>
  );
}
