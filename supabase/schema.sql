-- ============================================================
-- Fhdan Fleet Hub — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Enums
CREATE TYPE user_role AS ENUM ('system_admin','manager','finance_officer','sales_agent','fleet_coordinator','driver');
CREATE TYPE client_type AS ENUM ('individual','corporate','government');
CREATE TYPE client_status AS ENUM ('active','inactive','blacklisted');
CREATE TYPE currency_code AS ENUM ('ZAR','USD','EUR','GBP','AED');
CREATE TYPE tax_zone AS ENUM ('standard','exempt','foreign');
CREATE TYPE vehicle_status AS ENUM ('available','booked','maintenance','inactive');
CREATE TYPE vehicle_category AS ENUM ('sedan','suv','luxury','minibus','bus','van','pickup');
CREATE TYPE drive_mode AS ENUM ('chauffeur','self_drive','both');
CREATE TYPE fuel_type AS ENUM ('petrol','diesel','electric','hybrid');
CREATE TYPE driver_status AS ENUM ('available','on_trip','off_duty','suspended');
CREATE TYPE license_code AS ENUM ('B','C','C1','EB','PDP');
CREATE TYPE booking_status AS ENUM ('quote','pending_deposit','confirmed','active','completed','cancelled','no_show');
CREATE TYPE booking_type AS ENUM ('chauffeur','self_drive');
CREATE TYPE invoice_status AS ENUM ('draft','sent','paid','overdue','cancelled','void');
CREATE TYPE payment_method AS ENUM ('eft','cash','card','crypto','other');
CREATE TYPE entity_type AS ENUM ('client','driver','vehicle');
CREATE TYPE document_type AS ENUM ('passport','rsa_id','drivers_license','pdp','vehicle_registration','insurance','roadworthy','other');
CREATE TYPE maintenance_status AS ENUM ('scheduled','in_progress','completed','cancelled');
CREATE TYPE audit_action AS ENUM ('INSERT','UPDATE','DELETE');
CREATE TYPE notification_channel AS ENUM ('telegram','callmebot','email','sms','in_app');
CREATE TYPE notification_status AS ENUM ('queued','sent','failed','skipped');

-- ─── Profiles (extends auth.users) ───────────────────────────
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'sales_agent',
  phone TEXT,
  telegram_chat_id TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Clients ─────────────────────────────────────────────────
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  id_number TEXT,
  client_type client_type NOT NULL DEFAULT 'individual',
  status client_status NOT NULL DEFAULT 'active',
  company_name TEXT,
  vat_number TEXT,
  tax_zone tax_zone NOT NULL DEFAULT 'standard',
  preferred_currency currency_code NOT NULL DEFAULT 'ZAR',
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  address TEXT,
  city TEXT,
  country TEXT NOT NULL DEFAULT 'South Africa',
  rapid_profile_source TEXT NOT NULL DEFAULT 'manual',
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Vehicles ────────────────────────────────────────────────
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration TEXT NOT NULL UNIQUE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT NOT NULL,
  category vehicle_category NOT NULL,
  fuel_type fuel_type NOT NULL DEFAULT 'petrol',
  seating_capacity INTEGER NOT NULL DEFAULT 4,
  drive_modes drive_mode NOT NULL DEFAULT 'both',
  status vehicle_status NOT NULL DEFAULT 'available',
  daily_rate_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  chauffeur_rate_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  odometer_km INTEGER NOT NULL DEFAULT 0,
  last_service_date DATE,
  next_service_due_km INTEGER,
  insurance_expiry DATE,
  roadworthy_expiry DATE,
  gps_tracker_id TEXT,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Drivers ─────────────────────────────────────────────────
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  id_number TEXT,
  license_code license_code NOT NULL DEFAULT 'EB',
  pdp_expiry DATE,
  status driver_status NOT NULL DEFAULT 'available',
  total_trips INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Bookings ────────────────────────────────────────────────
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES public.clients(id),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id),
  driver_id UUID REFERENCES public.drivers(id),
  assigned_by UUID REFERENCES public.profiles(id),
  booking_type booking_type NOT NULL DEFAULT 'chauffeur',
  status booking_status NOT NULL DEFAULT 'quote',
  pickup_datetime TIMESTAMPTZ NOT NULL,
  dropoff_datetime TIMESTAMPTZ NOT NULL,
  arrival_datetime TIMESTAMPTZ,
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  subtotal_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  voucher_number TEXT UNIQUE,
  voucher_pdf_path TEXT,
  invoice_pdf_path TEXT,
  special_requirements TEXT,
  internal_notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Invoices ────────────────────────────────────────────────
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  status invoice_status NOT NULL DEFAULT 'draft',
  subtotal_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_due_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  payments_received NUMERIC(10,2) NOT NULL DEFAULT 0,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Payments ────────────────────────────────────────────────
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  amount_zar NUMERIC(10,2) NOT NULL,
  payment_method payment_method NOT NULL DEFAULT 'eft',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Documents ───────────────────────────────────────────────
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type entity_type NOT NULL,
  entity_id UUID NOT NULL,
  document_type document_type NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  storage_bucket TEXT NOT NULL DEFAULT 'document-vault',
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  checksum_sha256 TEXT,
  expiry_date DATE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  notes TEXT,
  encrypted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Maintenance Windows ────────────────────────────────────
CREATE TABLE public.maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  status maintenance_status NOT NULL DEFAULT 'scheduled',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  odometer_km INTEGER,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

-- ─── Incidents & Unified CRM Timeline ────────────────────────
CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  reported_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  status notification_status NOT NULL DEFAULT 'queued',
  recipient TEXT NOT NULL,
  template_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Immutable Audit Log ─────────────────────────────────────
CREATE TABLE public.audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID,
  action audit_action NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  old_data JSONB,
  new_data JSONB,
  request_jwt_role TEXT DEFAULT current_setting('request.jwt.claim.role', true),
  ip_address INET DEFAULT inet_client_addr()
);


-- ─── Auto-update updated_at ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vehicles_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_drivers_updated_at BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_maintenance_updated_at BEFORE UPDATE ON public.maintenance_windows FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Auto-create profile on signup ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'sales_agent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Helper: get current user role ──────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT CASE WHEN is_active THEN role ELSE NULL END FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_user_is_active()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(is_active, false) FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER AS $$
DECLARE
  row_id UUID;
BEGIN
  row_id := COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid);
  INSERT INTO public.audit_logs(table_name, record_id, action, changed_by, old_data, new_data)
  VALUES (TG_TABLE_NAME, row_id, TG_OP::audit_action, auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.client_360_history(p_client_id UUID)
RETURNS TABLE(event_at TIMESTAMPTZ, event_type TEXT, title TEXT, description TEXT) AS $$
  SELECT b.created_at, 'booking', b.booking_reference, b.pickup_location || ' → ' || b.dropoff_location
    FROM public.bookings b WHERE b.client_id = p_client_id
  UNION ALL
  SELECT i.created_at, 'invoice', i.invoice_number, i.status::text || ' · R ' || i.total_zar::text
    FROM public.invoices i WHERE i.client_id = p_client_id
  UNION ALL
  SELECT d.created_at, 'document', d.file_name, d.document_type::text
    FROM public.documents d WHERE d.entity_type = 'client' AND d.entity_id = p_client_id
  UNION ALL
  SELECT inc.created_at, 'incident', inc.title, COALESCE(inc.description, '')
    FROM public.incidents inc WHERE inc.client_id = p_client_id
  ORDER BY event_at DESC;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.ensure_vehicle_availability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.dropoff_datetime <= NEW.pickup_datetime THEN
    RAISE EXCEPTION 'Dropoff must be after pickup';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.vehicle_id = NEW.vehicle_id
      AND b.id <> NEW.id
      AND b.status NOT IN ('cancelled','no_show','completed')
      AND tstzrange(b.pickup_datetime, b.dropoff_datetime, '[)') && tstzrange(NEW.pickup_datetime, NEW.dropoff_datetime, '[)')
  ) THEN
    RAISE EXCEPTION 'Vehicle is already booked in this time window';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.maintenance_windows m
    WHERE m.vehicle_id = NEW.vehicle_id
      AND m.status IN ('scheduled','in_progress')
      AND tstzrange(m.starts_at, m.ends_at, '[)') && tstzrange(NEW.pickup_datetime, NEW.dropoff_datetime, '[)')
  ) THEN
    RAISE EXCEPTION 'Vehicle has scheduled maintenance in this time window';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_vehicle_availability
  BEFORE INSERT OR UPDATE OF vehicle_id, pickup_datetime, dropoff_datetime, status
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.ensure_vehicle_availability();

CREATE TRIGGER audit_profiles AFTER INSERT OR UPDATE OR DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_clients AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_vehicles AFTER INSERT OR UPDATE OR DELETE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_drivers AFTER INSERT OR UPDATE OR DELETE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_bookings AFTER INSERT OR UPDATE OR DELETE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_maintenance AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_windows FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_incidents AFTER INSERT OR UPDATE OR DELETE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ─── Enable RLS ──────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ────────────────────────────────────────────

-- Profiles: users see their own; admins/managers see all
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING ((id = auth.uid() OR get_user_role() IN ('system_admin','manager')) AND get_user_is_active());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_user_role() = 'system_admin');
CREATE POLICY "profiles_insert_admin" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'system_admin');

-- Clients: all authenticated users can read; restricted writes
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('system_admin','manager','sales_agent','fleet_coordinator'));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated
  USING (get_user_role() IN ('system_admin','manager','sales_agent'));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated
  USING (get_user_role() IN ('system_admin','manager'));

-- Vehicles: all can read; fleet_coordinator+ can write
CREATE POLICY "vehicles_select" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles_insert" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('system_admin','manager','fleet_coordinator'));
CREATE POLICY "vehicles_update" ON public.vehicles FOR UPDATE TO authenticated
  USING (get_user_role() IN ('system_admin','manager','fleet_coordinator'));
CREATE POLICY "vehicles_delete" ON public.vehicles FOR DELETE TO authenticated
  USING (get_user_role() IN ('system_admin','manager'));

-- Drivers: all can read; fleet_coordinator+ can write
CREATE POLICY "drivers_select" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers_insert" ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('system_admin','manager','fleet_coordinator'));
CREATE POLICY "drivers_update" ON public.drivers FOR UPDATE TO authenticated
  USING (get_user_role() IN ('system_admin','manager','fleet_coordinator'));
CREATE POLICY "drivers_delete" ON public.drivers FOR DELETE TO authenticated
  USING (get_user_role() IN ('system_admin','manager'));

-- Bookings: drivers see own; others see all (role-filtered in app)
CREATE POLICY "bookings_select" ON public.bookings FOR SELECT TO authenticated
  USING (get_user_role() != 'driver' OR driver_id = (SELECT d.id FROM drivers d WHERE d.email = (SELECT email FROM profiles WHERE id = auth.uid()) LIMIT 1));
CREATE POLICY "bookings_insert" ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('system_admin','manager','sales_agent','fleet_coordinator'));
CREATE POLICY "bookings_update" ON public.bookings FOR UPDATE TO authenticated
  USING (get_user_role() IN ('system_admin','manager','sales_agent','fleet_coordinator'));
CREATE POLICY "bookings_delete" ON public.bookings FOR DELETE TO authenticated
  USING (get_user_role() IN ('system_admin','manager'));

-- Invoices & Payments: finance roles + admin/manager
CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('system_admin','manager','finance_officer'));
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated
  USING (get_user_role() IN ('system_admin','manager','finance_officer'));
CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('system_admin','manager','finance_officer'));

-- Documents: all can read own entity docs; restricted uploads
CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated
  USING (get_user_role() IN ('system_admin','manager','finance_officer','fleet_coordinator','sales_agent') OR uploaded_by = auth.uid());
CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('system_admin','manager','fleet_coordinator','sales_agent','finance_officer'));
CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
  USING (get_user_role() IN ('system_admin','manager'));



-- Maintenance, incidents, notifications, audit
CREATE POLICY "maintenance_select" ON public.maintenance_windows FOR SELECT TO authenticated USING (get_user_role() IN ('system_admin','manager','fleet_coordinator'));
CREATE POLICY "maintenance_write" ON public.maintenance_windows FOR ALL TO authenticated
  USING (get_user_role() IN ('system_admin','manager','fleet_coordinator'))
  WITH CHECK (get_user_role() IN ('system_admin','manager','fleet_coordinator'));
CREATE POLICY "incidents_select" ON public.incidents FOR SELECT TO authenticated USING (get_user_role() IN ('system_admin','manager','fleet_coordinator'));
CREATE POLICY "incidents_write" ON public.incidents FOR ALL TO authenticated
  USING (get_user_role() IN ('system_admin','manager','fleet_coordinator'))
  WITH CHECK (get_user_role() IN ('system_admin','manager','fleet_coordinator'));
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated USING (get_user_role() IN ('system_admin','manager','finance_officer','fleet_coordinator'));
CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated USING (get_user_role() IN ('system_admin','manager'));

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_bookings_client_id ON public.bookings(client_id);
CREATE INDEX idx_bookings_vehicle_id ON public.bookings(vehicle_id);
CREATE INDEX idx_bookings_driver_id ON public.bookings(driver_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX idx_documents_entity ON public.documents(entity_type, entity_id);
CREATE INDEX idx_maintenance_vehicle_range ON public.maintenance_windows USING gist (vehicle_id, tstzrange(starts_at, ends_at, '[)'));
CREATE INDEX idx_notifications_due ON public.notifications(status, scheduled_for);
CREATE UNIQUE INDEX idx_notifications_booking_template ON public.notifications(booking_id, channel, template_key, recipient);
CREATE INDEX idx_audit_logs_record ON public.audit_logs(table_name, record_id, changed_at DESC);
CREATE UNIQUE INDEX idx_bookings_vehicle_no_overlap ON public.bookings USING gist (vehicle_id, tstzrange(pickup_datetime, dropoff_datetime, '[)')) WHERE (status NOT IN ('cancelled','no_show','completed'));

-- ─── Supabase Storage Buckets & Policies ────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('document-vault', 'document-vault', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png','image/webp']::text[]),
  ('generated-documents', 'generated-documents', false, 10485760, ARRAY['application/pdf','text/html']::text[])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "document_vault_staff_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'document-vault' AND public.get_user_role() IN ('system_admin','manager','finance_officer','fleet_coordinator','sales_agent'));
CREATE POLICY "document_vault_staff_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'document-vault' AND public.get_user_role() IN ('system_admin','manager','finance_officer','fleet_coordinator','sales_agent'));
CREATE POLICY "generated_documents_staff_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'generated-documents' AND public.get_user_role() IN ('system_admin','manager','finance_officer','sales_agent','fleet_coordinator'));
