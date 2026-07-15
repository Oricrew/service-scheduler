alter table appointments
add column same_day_reminder_sent_at timestamptz;

create index appointments_same_day_reminder_pending_idx on appointments (
  organization_id,
  confirmed_start_at
)
where
  status = 'confirmed'
  and same_day_reminder_sent_at is null;
