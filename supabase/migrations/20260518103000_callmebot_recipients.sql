-- Allow one notification per booking/template/channel/recipient so CALLMEBOT_RECIPIENTS
-- can queue the same alert for multiple WhatsApp numbers without upsert conflicts.
DROP INDEX IF EXISTS public.idx_notifications_booking_template;
CREATE UNIQUE INDEX idx_notifications_booking_template
  ON public.notifications(booking_id, channel, template_key, recipient);
