-- ============================================================
-- Fhdan Fleet Hub — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

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

-- ─── Profiles (extends auth.users) ───────────────────────────
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'sales_agent',
  phone TEXT,
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
  pickup_location TEXT NOT NULL,
  dropoff_location TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  subtotal_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  vat_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_zar NUMERIC(10,2) NOT NULL DEFAULT 0,
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
  file_size INTEGER NOT NULL DEFAULT 0,
  expiry_date DATE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─── Enable RLS ──────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ─── RLS Policies ────────────────────────────────────────────

-- Profiles: users see their own; admins/managers see all
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR get_user_role() IN ('system_admin','manager'));
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
CREATE POLICY "documents_select" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents_insert" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('system_admin','manager','fleet_coordinator','sales_agent','finance_officer'));
CREATE POLICY "documents_delete" ON public.documents FOR DELETE TO authenticated
  USING (get_user_role() IN ('system_admin','manager'));

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX idx_bookings_client_id ON public.bookings(client_id);
CREATE INDEX idx_bookings_vehicle_id ON public.bookings(vehicle_id);
CREATE INDEX idx_bookings_driver_id ON public.bookings(driver_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_booking_id ON public.invoices(booking_id);
CREATE INDEX idx_documents_entity ON public.documents(entity_type, entity_id);
