/** The teacher's side of parent conversations. */
import { useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useApi } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { useSelectedClass } from '../../layout/portals';
import { MessageCentre } from '../../features/messaging';
import { Alert, Button, Field, Modal, Select, Textarea, toast } from '../../ui';

export default function TeacherMessages() {
  const { user } = useAuth();
  const { selectedId } = useSelectedClass();
  const [composing, setComposing] = useState(false);

  const adapter = {
    threads: () => api.teacher.threads(),
    thread: (id) => api.teacher.thread(id),
    reply: (id, body) => api.teacher.reply(id, body),
    otherParty: (thread) => thread.parent_name,
    isOwnMessage: (message) => message.sender_id === user.id,
  };

  return (
    <>
      <MessageCentre
        eyebrow="Communication"
        title="Parent messages"
        description="One conversation per family, per child. Families reply from their own portal."
        emptyDescription="Start a conversation from a student's page, or with the button above."
        adapter={adapter}
        actions={(
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setComposing(true)}>
            New message
          </Button>
        )}
      />

      {composing && (
        <ComposeDialog classId={selectedId} onClose={() => setComposing(false)} />
      )}
    </>
  );
}

function ComposeDialog({ classId, onClose }) {
  const contacts = useApi(() => api.teacher.guardians(classId), [classId], { skip: !classId });
  const [contactKey, setContactKey] = useState('');
  const [subject, setSubject] = useState('General');
  const [body, setBody] = useState('');

  const rows = contacts.data || [];
  const chosen = rows.find((row) => `${row.student_id}-${row.parent_id}` === contactKey);

  const send = useAction(
    () => api.teacher.startThread({
      student_id: chosen.student_id,
      parent_id: chosen.parent_id,
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
      description="Choose a student's guardian. Existing conversations continue rather than duplicating."
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
        <Field label="Send to" required hint="Guardians linked to students in your class.">
          <Select value={contactKey} onChange={(e) => setContactKey(e.target.value)}>
            <option value="">Choose a guardian…</option>
            {rows.map((row) => (
              <option key={`${row.student_id}-${row.parent_id}`} value={`${row.student_id}-${row.parent_id}`}>
                {row.parent_name} — {row.first_name} {row.last_name} ({row.relationship})
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Subject">
          <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option>General</option>
            <option>Term 1 progress</option>
            <option>Memorization at home</option>
            <option>Attendance</option>
            <option>Homework</option>
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
