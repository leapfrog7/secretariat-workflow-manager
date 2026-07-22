import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const DEFAULT_REMINDERS = {
  inAppEnabled: true,
  emailEnabled: false,
  upcomingDays: 7,
  digestFrequency: 'weekly',
};

function normalizePreferences(payload = {}) {
  const reminders = { ...DEFAULT_REMINDERS, ...(payload.reminders || {}) };
  return {
    inAppEnabled: reminders.inAppEnabled !== false,
    emailEnabled: reminders.emailEnabled === true,
    upcomingDays: Math.min(30, Math.max(1, Number(reminders.upcomingDays) || 7)),
    digestFrequency: ['none', 'weekly', 'monthly'].includes(reminders.digestFrequency) ? reminders.digestFrequency : 'weekly',
  };
}

function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

function nextRecurringDate(issue, runDate) {
  if (issue.recurrenceType === 'One-time') return '';
  let candidate = issue.nextAppearanceDate;
  const anchorDay = Number(issue.recurrenceAnchorDay) || Number(candidate?.slice(8, 10)) || 1;
  while (candidate && candidate <= runDate) {
    const date = new Date(`${candidate}T00:00:00Z`);
    if (issue.recurrenceType === 'Weekly') {
      date.setUTCDate(date.getUTCDate() + 7);
    } else if (issue.recurrenceType === 'Monthly') {
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth() + 1;
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      date.setUTCFullYear(year, month, Math.min(anchorDay, lastDay));
    } else {
      return '';
    }
    candidate = date.toISOString().slice(0, 10);
  }
  return candidate || '';
}

function digestMessage(issues, runDate, upcomingDays) {
  const open = issues.filter((issue) => !['Completed', 'Cancelled'].includes(issue.status));
  const overdue = open.filter((issue) => issue.next_deadline && issue.next_deadline < runDate).length;
  const dueToday = open.filter((issue) => issue.next_deadline === runDate).length;
  const dueSoon = open.filter((issue) => {
    const days = issue.next_deadline ? daysBetween(runDate, issue.next_deadline) : -1;
    return days > 0 && days <= upcomingDays;
  }).length;
  return `${open.length} current Issue${open.length === 1 ? '' : 's'}: ${overdue} overdue, ${dueToday} due today and ${dueSoon} due within ${upcomingDays} days.`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]);
}

async function sendEmailBatch({ recipient, displayName, notifications, eventDate }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!apiKey || !from) return { status: 'not_configured', error: 'Email delivery is not configured.' };

  const appUrl = process.env.APP_PUBLIC_URL || 'https://leapfrog7.github.io/secretariat-workflow-manager/';
  const textItems = notifications.map((item) => `- ${item.title}: ${item.message}`).join('\n');
  const htmlItems = notifications.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.message)}</li>`).join('');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Secretariat-Workflow-Manager/1.0',
      'Idempotency-Key': `swm-reminders-${eventDate}-${notifications[0].user_id}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `Official work reminders - ${eventDate}`,
      text: `Hello ${displayName || 'Officer'},\n\n${textItems}\n\nOpen the Issue register: ${appUrl}`,
      html: `<p>Hello ${escapeHtml(displayName || 'Officer')},</p><ul>${htmlItems}</ul><p><a href="${escapeHtml(appUrl)}">Open the Issue register</a></p>`,
    }),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}.`);
  return { status: 'sent', error: '' };
}

export async function runDailyAutomation() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const sql = neon(process.env.DATABASE_URL);
  const [{ run_date: runDate }] = await sql`SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS run_date`;
  const claimed = await sql`
    INSERT INTO public.automation_runs (run_date, status)
    VALUES (${runDate}::date, 'running')
    ON CONFLICT (run_date) DO UPDATE
      SET status = 'running', started_at = now(), completed_at = NULL, error = ''
      WHERE public.automation_runs.status = 'failed'
         OR (public.automation_runs.status = 'running' AND public.automation_runs.started_at < now() - interval '2 hours')
    RETURNING run_date
  `;
  if (!claimed.length) return { runDate, status: 'already_completed' };

  let reactivatedCount = 0;
  let notificationCount = 0;
  let emailCount = 0;
  try {
    const dueScheduled = await sql`
      SELECT workspace_id, id, payload
      FROM public.cloud_issues
      WHERE deleted_at IS NULL
        AND is_archived = false
        AND is_scheduled = true
        AND nullif(payload ->> 'nextAppearanceDate', '')::date <= ${runDate}::date
    `;

    const returned = [];
    for (const row of dueScheduled) {
      const existing = row.payload;
      const now = new Date().toISOString();
      const oneTime = existing.recurrenceType === 'One-time';
      const nextAppearanceDate = oneTime ? '' : nextRecurringDate(existing, runDate);
      const issue = {
        ...existing,
        status: 'Pending',
        dateClosed: '',
        isScheduled: false,
        recurrenceType: oneTime ? '' : existing.recurrenceType,
        nextAppearanceDate,
        recurrenceAnchorDay: oneTime ? null : existing.recurrenceAnchorDay,
        lastReactivatedAt: now,
        updatedAt: now,
      };
      const updated = await sql`
        UPDATE public.cloud_issues
        SET payload = ${JSON.stringify(issue)}::jsonb,
            status = 'Pending', is_scheduled = false,
            updated_by = 'automation', updated_at = ${now}::timestamptz
        WHERE workspace_id = ${row.workspace_id}::uuid AND id = ${row.id}::uuid AND is_scheduled = true
        RETURNING id
      `;
      if (!updated.length) continue;
      const milestoneId = randomUUID();
      const milestone = {
        id: milestoneId,
        issueId: row.id,
        status: 'Pending',
        assignedOfficerId: issue.assignedOfficerId || '',
        assignedOfficerName: '',
        note: 'Returned to the current register on its scheduled date.',
        recordedAt: now,
        createdAt: now,
      };
      await sql`
        INSERT INTO public.cloud_issue_items (workspace_id, issue_id, item_type, id, payload, created_by, updated_by, created_at, updated_at)
        VALUES (${row.workspace_id}::uuid, ${row.id}::uuid, 'milestone', ${milestoneId}::uuid, ${JSON.stringify(milestone)}::jsonb, 'automation', 'automation', ${now}::timestamptz, ${now}::timestamptz)
      `;
      returned.push({ workspace_id: row.workspace_id, id: row.id, title: issue.shortTitle || 'Scheduled Issue' });
      reactivatedCount += 1;
    }

    const [members, activeIssues] = await Promise.all([
      sql`
        SELECT m.workspace_id, m.user_id, p.email, p.display_name, coalesce(s.payload, '{}'::jsonb) AS settings
        FROM public.workspace_members m
        JOIN public.profiles p ON p.user_id = m.user_id AND p.status = 'active'
        LEFT JOIN public.cloud_user_settings s ON s.workspace_id = m.workspace_id AND s.user_id = m.user_id
        WHERE m.status = 'active'
      `,
      sql`
        SELECT workspace_id, id, status, next_deadline, payload
        FROM public.cloud_issues
        WHERE deleted_at IS NULL AND is_archived = false AND is_scheduled = false
      `,
    ]);
    const issuesByWorkspace = new Map();
    for (const issue of activeIssues) {
      const items = issuesByWorkspace.get(issue.workspace_id) || [];
      items.push(issue);
      issuesByWorkspace.set(issue.workspace_id, items);
    }
    const returnedByWorkspace = new Map();
    for (const issue of returned) {
      const items = returnedByWorkspace.get(issue.workspace_id) || [];
      items.push(issue);
      returnedByWorkspace.set(issue.workspace_id, items);
    }

    const weekday = new Date(`${runDate}T00:00:00Z`).getUTCDay();
    const monthDay = Number(runDate.slice(8, 10));
    for (const member of members) {
      const preferences = normalizePreferences(member.settings);
      const issues = issuesByWorkspace.get(member.workspace_id) || [];
      const candidates = [];
      for (const issue of returnedByWorkspace.get(member.workspace_id) || []) {
        candidates.push({ issueId: issue.id, type: 'scheduled_returned', title: 'Issue returned to the register', message: issue.title, dueDate: null, dedupe: `returned:${issue.id}:${runDate}` });
      }
      for (const issue of issues) {
        if (!issue.next_deadline || ['Completed', 'Cancelled'].includes(issue.status)) continue;
        const days = daysBetween(runDate, issue.next_deadline);
        const title = issue.payload?.shortTitle || 'Issue deadline';
        if (days < 0) candidates.push({ issueId: issue.id, type: 'deadline_overdue', title: 'Issue overdue', message: `${title} was due on ${issue.next_deadline}.`, dueDate: issue.next_deadline, dedupe: `overdue:${issue.id}:${issue.next_deadline}` });
        else if (days === 0) candidates.push({ issueId: issue.id, type: 'deadline_due', title: 'Issue due today', message: title, dueDate: issue.next_deadline, dedupe: `due:${issue.id}:${issue.next_deadline}` });
        else if (days <= preferences.upcomingDays) candidates.push({ issueId: issue.id, type: 'deadline_upcoming', title: 'Upcoming Issue deadline', message: `${title} is due in ${days} day${days === 1 ? '' : 's'}.`, dueDate: issue.next_deadline, dedupe: `upcoming:${issue.id}:${issue.next_deadline}` });
      }
      const weekly = preferences.digestFrequency === 'weekly' && weekday === 1;
      const monthly = preferences.digestFrequency === 'monthly' && monthDay === 1;
      if (weekly || monthly) {
        const type = weekly ? 'weekly_digest' : 'monthly_digest';
        candidates.push({ issueId: null, type, title: weekly ? 'Weekly Issue digest' : 'Monthly Issue digest', message: digestMessage(issues, runDate, preferences.upcomingDays), dueDate: null, dedupe: `${type}:${runDate}` });
      }

      for (const candidate of candidates) {
        if (!preferences.inAppEnabled && !preferences.emailEnabled) continue;
        const inserted = await sql`
          INSERT INTO public.cloud_notifications (
            workspace_id, user_id, issue_id, notification_type, title, message, event_date, due_date,
            dedupe_key, in_app, email_requested, email_status
          ) VALUES (
            ${member.workspace_id}::uuid, ${member.user_id}, ${candidate.issueId}::uuid, ${candidate.type}, ${candidate.title}, ${candidate.message},
            ${runDate}::date, ${candidate.dueDate}::date, ${candidate.dedupe}, ${preferences.inAppEnabled}, ${preferences.emailEnabled},
            ${preferences.emailEnabled ? 'pending' : 'not_requested'}
          )
          ON CONFLICT (workspace_id, user_id, dedupe_key) DO NOTHING
          RETURNING id, user_id, title, message
        `;
        if (inserted.length) {
          notificationCount += 1;
        }
      }
    }

    const emailNotifications = await sql`
      SELECT n.id, n.user_id, n.title, n.message, n.event_date::text, p.email, p.display_name
      FROM public.cloud_notifications n
      JOIN public.profiles p ON p.user_id = n.user_id AND p.status = 'active'
      WHERE n.email_requested = true
        AND n.email_status IN ('pending', 'failed', 'not_configured')
        AND n.created_at >= now() - interval '7 days'
      ORDER BY n.event_date, n.created_at
    `;
    const emailGroups = new Map();
    for (const notification of emailNotifications) {
      const groupKey = `${notification.user_id}:${notification.event_date}`;
      const group = emailGroups.get(groupKey) || [];
      group.push(notification);
      emailGroups.set(groupKey, group);
    }
    for (const notifications of emailGroups.values()) {
      let delivery;
      try {
        delivery = await sendEmailBatch({ recipient: notifications[0].email, displayName: notifications[0].display_name, notifications, eventDate: notifications[0].event_date });
        if (delivery.status === 'sent') emailCount += 1;
      } catch (error) {
        delivery = { status: 'failed', error: error.message || 'Email delivery failed.' };
      }
      const ids = notifications.map((notification) => notification.id);
      await sql`
        UPDATE public.cloud_notifications
        SET email_status = ${delivery.status}, email_error = ${delivery.error}
        WHERE id = ANY(${ids}::uuid[])
      `;
    }

    const result = { runDate, status: 'completed', reactivatedCount, notificationCount, emailCount };
    await sql`
      UPDATE public.automation_runs
      SET status = 'completed', completed_at = now(), reactivated_count = ${reactivatedCount},
          notification_count = ${notificationCount}, email_count = ${emailCount}, result = ${JSON.stringify(result)}::jsonb
      WHERE run_date = ${runDate}::date
    `;
    return result;
  } catch (error) {
    await sql`
      UPDATE public.automation_runs SET status = 'failed', completed_at = now(), error = ${String(error.message || error).slice(0, 1000)}
      WHERE run_date = ${runDate}::date
    `;
    throw error;
  }
}
