/** The family's side of conversations with their child's teachers. */
import { useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { MessageCentre } from '../../features/messaging';
import { Alert, Button, Field, Modal, Select, Textarea, toast } from '../../ui';

export default function FamilyMessages() {
  const { user } = useAuth();
  const [composing, setComposing] = useState(false);

  const adapter = {
    threads: () => api.parent.threads(),
    thread: (id) => api.parent.thread(id),
    reply: (id, body) => api.parent.reply(id, body),
    otherParty: (thread) => thread.teacher_name,
    isOwnMessage: (message) => message.sender_id === user.id,
  };

  return (
    <>
      <MessageCentre
        eyebrow="From the maktab"
        title="Messages"
        description="Talk directly to your child's teacher. Teachers reply from their own portal."
        emptyDescription="Start a conversation with your child's teacher using the button above."
        adapter={adapter}
        actions={(
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setComposing(true)}>
            New message
          </Button>
        )}
      />

      {composing && <ComposeDialog onClose={() => setComposing(false)} />}
    </>
  );
}

function ComposeDialog({ onClose }) {
  const contacts = useApi(() => api.parent.contacts(), []);
  const [key, setKey] = useState('');
  const [subject, setSubject] = useState('General');
  const [body, setBody] = useState('');

  const rows = contacts.data || [];
  const chosen = rows.find((row) => `${row.student_id}-${row.teacher_id}` === key);

  const send = useAction(
    () => api.parent.startThread({
      student_id: chosen.student_id,
      teacher_id: chosen.teacher_id,
      subject,
      body: body.trim(),
    }),
    { onSuccess: () => { toast('Message sent'); onClose(); } }
  );

  return (
    <Modal
      open
      onClose={onClose}
      title="New message"
      description="Choose which child and which teacher this is about."
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={send.busy}>Cancel</Button>
          <Button
            variant="primary"
            busy={send.busy}
            disabled={!chosen || !body.trim()}
            icon={<Send size={15} />}
            onClick={() => send.run().catch(() => {})}
          >
            Send
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <Field label="Teacher" required>
          <Select value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="">Choose a teacher…</option>
            {rows.map((row) => (
              <option key={`${row.student_id}-${row.teacher_id}`} value={`${row.student_id}-${row.teacher_id}`}>
                {row.teacher_name} — about {row.first_name} ({row.class_name})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subject">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option>General</option>
            <option>Memorization at home</option>
            <option>Attendance</option>
            <option>Homework question</option>
            <option>Term progress</option>
          </Select>
        </Field>
        <Field label="Message" required>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
        </Field>
        {send.error && <Alert tone="risk">{send.error.message}</Alert>}
      </div>
    </Modal>
  );
}
