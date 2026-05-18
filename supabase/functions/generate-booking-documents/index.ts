import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);
  const { booking_id } = await req.json().catch(() => ({}));
  if (!booking_id) return json({ error: 'booking_id is required' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, clients(full_name,email,phone), vehicles(registration,make,model), drivers(full_name,phone)')
    .eq('id', booking_id)
    .single();
  if (error) return json({ error: error.message }, 500);

  const voucherNumber = booking.voucher_number || `VCH-${booking.booking_reference}`;
  const invoiceHtml = htmlDocument('Invoice', booking, voucherNumber);
  const voucherHtml = htmlDocument('Travel Voucher', booking, voucherNumber);
  const basePath = `${booking.booking_reference}`;

  await uploadText(supabase, `${basePath}/invoice.html`, invoiceHtml);
  await uploadText(supabase, `${basePath}/voucher.html`, voucherHtml);
  await supabase.from('bookings').update({ voucher_number: voucherNumber, invoice_pdf_path: `${basePath}/invoice.html`, voucher_pdf_path: `${basePath}/voucher.html` }).eq('id', booking_id);

  return json({ voucher_number: voucherNumber, invoice_path: `${basePath}/invoice.html`, voucher_path: `${basePath}/voucher.html` });
});

async function uploadText(supabase: ReturnType<typeof createClient>, path: string, text: string) {
  const { error } = await supabase.storage.from('generated-documents').upload(path, new Blob([text], { type: 'text/html' }), { upsert: true, contentType: 'text/html' });
  if (error) throw error;
}

function htmlDocument(title: string, booking: any, voucherNumber: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} ${booking.booking_reference}</title><style>body{font-family:Arial,sans-serif;color:#111}table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #ddd}.total{font-size:22px;font-weight:bold}</style></head><body><h1>Fhdan Tourism ${title}</h1><p>${voucherNumber}</p><table><tr><td>Booking</td><td>${booking.booking_reference}</td></tr><tr><td>Client</td><td>${booking.clients?.full_name}</td></tr><tr><td>Vehicle</td><td>${booking.vehicles?.registration} ${booking.vehicles?.make} ${booking.vehicles?.model}</td></tr><tr><td>Pickup</td><td>${booking.pickup_datetime} ${booking.pickup_location}</td></tr><tr><td>Dropoff</td><td>${booking.dropoff_datetime} ${booking.dropoff_location}</td></tr><tr><td>Total ZAR</td><td class="total">R ${booking.total_zar}</td></tr></table></body></html>`;
}
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }); }
