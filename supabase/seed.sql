-- ============================================================
-- Fhdan Fleet Hub — Demo Seed Data
-- Run AFTER schema.sql and AFTER creating auth users
-- ============================================================
-- NOTE: Create auth users first via:
--   Supabase Dashboard → Authentication → Users → Add User
--   OR use the setup script below.
--
-- Demo emails and passwords:
--   admin@fhdan.co.za      / Admin2026!    (system_admin)
--   manager@fhdan.co.za    / Manager2026!  (manager)
--   finance@fhdan.co.za    / Finance2026!  (finance_officer)
--   sales@fhdan.co.za      / Sales2026!    (sales_agent)
--   fleet@fhdan.co.za      / Fleet2026!    (fleet_coordinator)
--   driver@fhdan.co.za     / Driver2026!   (driver)
--
-- After creating auth users, update their roles:
--   UPDATE public.profiles SET role = 'system_admin' WHERE email = 'admin@fhdan.co.za';
--   UPDATE public.profiles SET role = 'manager', full_name = 'Sipho Nkosi' WHERE email = 'manager@fhdan.co.za';
--   UPDATE public.profiles SET role = 'finance_officer', full_name = 'Lerato Dlamini' WHERE email = 'finance@fhdan.co.za';
--   UPDATE public.profiles SET role = 'sales_agent', full_name = 'Thabo Molefe' WHERE email = 'sales@fhdan.co.za';
--   UPDATE public.profiles SET role = 'fleet_coordinator', full_name = 'Priya Govender' WHERE email = 'fleet@fhdan.co.za';
--   UPDATE public.profiles SET role = 'driver', full_name = 'Ahmed Hassan' WHERE email = 'driver@fhdan.co.za';
-- ============================================================

-- Clients
INSERT INTO public.clients (id, email, full_name, phone, client_type, status, country, payment_terms_days, preferred_currency, tax_zone)
VALUES
  ('11111111-0001-0000-0000-000000000001', 'john.smith@example.com', 'John Smith', '+27 82 345 6789', 'individual', 'active', 'South Africa', 30, 'ZAR', 'standard'),
  ('11111111-0002-0000-0000-000000000001', 'sarah.jones@example.co.uk', 'Sarah Jones', '+44 7700 900123', 'individual', 'active', 'United Kingdom', 14, 'GBP', 'foreign'),
  ('11111111-0003-0000-0000-000000000001', 'bookings@safari-tours.co.za', 'Safari Tours Group', '+27 11 234 5678', 'corporate', 'active', 'South Africa', 30, 'ZAR', 'standard'),
  ('11111111-0004-0000-0000-000000000001', 'procurement@sa-tourism.gov.za', 'SA Tourism Department', '+27 12 444 5678', 'government', 'active', 'South Africa', 60, 'ZAR', 'exempt'),
  ('11111111-0005-0000-0000-000000000001', 'm.patel@luxetravel.ae', 'Mohammed Al-Patel', '+971 50 234 5678', 'individual', 'active', 'UAE', 0, 'AED', 'foreign')
ON CONFLICT (id) DO NOTHING;

-- Update company names
UPDATE public.clients SET company_name = 'Safari Tours Group Pty Ltd', vat_number = '4123456789' WHERE id = '11111111-0003-0000-0000-000000000001';
UPDATE public.clients SET company_name = 'SA Tourism Department' WHERE id = '11111111-0004-0000-0000-000000000001';

-- Vehicles
INSERT INTO public.vehicles (id, registration, make, model, year, color, category, fuel_type, seating_capacity, drive_modes, status, daily_rate_zar, chauffeur_rate_zar, odometer_km)
VALUES
  ('22222222-0001-0000-0000-000000000001', 'CA 123-456', 'Toyota', 'Fortuner', 2023, 'White', 'suv', 'diesel', 7, 'both', 'available', 1200.00, 1800.00, 45000),
  ('22222222-0002-0000-0000-000000000001', 'CA 789-012', 'Mercedes-Benz', 'E-Class', 2023, 'Obsidian Black', 'luxury', 'petrol', 4, 'chauffeur', 'available', 2500.00, 3500.00, 28000),
  ('22222222-0003-0000-0000-000000000001', 'GP 321-654', 'Toyota', 'Quantum', 2022, 'White', 'minibus', 'diesel', 14, 'chauffeur', 'booked', 1800.00, 2400.00, 92000),
  ('22222222-0004-0000-0000-000000000001', 'WC 456-789', 'BMW', '5 Series', 2024, 'Alpine White', 'luxury', 'petrol', 5, 'both', 'available', 2200.00, 3200.00, 12000),
  ('22222222-0005-0000-0000-000000000001', 'NW 654-321', 'Ford', 'Ranger', 2022, 'Silver', 'pickup', 'diesel', 5, 'self_drive', 'maintenance', 900.00, 0.00, 110000),
  ('22222222-0006-0000-0000-000000000001', 'CA 111-222', 'Toyota', 'Hiace', 2021, 'White', 'van', 'diesel', 12, 'chauffeur', 'available', 1600.00, 2200.00, 78000)
ON CONFLICT (id) DO NOTHING;

-- Drivers
INSERT INTO public.drivers (id, full_name, phone, email, license_code, pdp_expiry, status, total_trips)
VALUES
  ('33333333-0001-0000-0000-000000000001', 'Ahmed Hassan', '+27 82 111 2222', 'driver@fhdan.co.za', 'EB', '2026-08-15', 'available', 234),
  ('33333333-0002-0000-0000-000000000001', 'Lucky Sithole', '+27 83 333 4444', 'lucky@fhdan.co.za', 'C', '2025-12-31', 'on_trip', 189),
  ('33333333-0003-0000-0000-000000000001', 'Deon Botha', '+27 84 555 6666', 'deon@fhdan.co.za', 'EB', '2026-03-20', 'available', 412),
  ('33333333-0004-0000-0000-000000000001', 'Themba Khumalo', '+27 76 777 8888', NULL, 'C1', '2026-11-01', 'off_duty', 67)
ON CONFLICT (id) DO NOTHING;

-- Bookings
INSERT INTO public.bookings (id, booking_reference, client_id, vehicle_id, driver_id, booking_type, status, pickup_datetime, dropoff_datetime, pickup_location, dropoff_location, currency, subtotal_zar, discount_amount, deposit_amount, vat_zar, total_zar)
VALUES
  ('44444444-0001-0000-0000-000000000001', 'FHD-2026-100001',
   '11111111-0001-0000-0000-000000000001', '22222222-0002-0000-0000-000000000001', '33333333-0001-0000-0000-000000000001',
   'chauffeur', 'active',
   NOW() - INTERVAL '2 hours', NOW() + INTERVAL '4 hours',
   'Cape Town International Airport', 'V&A Waterfront Hotel',
   'ZAR', 3500.00, 0.00, 1750.00, 525.00, 4025.00),

  ('44444444-0002-0000-0000-000000000001', 'FHD-2026-100002',
   '11111111-0003-0000-0000-000000000001', '22222222-0003-0000-0000-000000000001', '33333333-0002-0000-0000-000000000001',
   'chauffeur', 'active',
   NOW() - INTERVAL '6 hours', NOW() + INTERVAL '8 hours',
   'OR Tambo International Airport', 'Sandton Convention Centre',
   'ZAR', 2400.00, 0.00, 1200.00, 360.00, 2760.00),

  ('44444444-0003-0000-0000-000000000001', 'FHD-2026-100003',
   '11111111-0005-0000-0000-000000000001', '22222222-0004-0000-0000-000000000001', NULL,
   'self_drive', 'pending_deposit',
   NOW() + INTERVAL '48 hours', NOW() + INTERVAL '72 hours',
   'Fhdan Tourism Office, Cape Town', 'Fhdan Tourism Office, Cape Town',
   'ZAR', 6600.00, 600.00, 3000.00, 900.00, 6900.00),

  ('44444444-0004-0000-0000-000000000001', 'FHD-2026-100004',
   '11111111-0002-0000-0000-000000000001', '22222222-0001-0000-0000-000000000001', '33333333-0003-0000-0000-000000000001',
   'chauffeur', 'confirmed',
   NOW() + INTERVAL '24 hours', NOW() + INTERVAL '36 hours',
   'Cape Town CBD Marriott', 'Stellenbosch Wine Estate',
   'ZAR', 1800.00, 0.00, 900.00, 270.00, 2070.00),

  ('44444444-0005-0000-0000-000000000001', 'FHD-2026-100005',
   '11111111-0004-0000-0000-000000000001', '22222222-0006-0000-0000-000000000001', '33333333-0003-0000-0000-000000000001',
   'chauffeur', 'completed',
   NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days',
   'Parliament Buildings, Cape Town', 'Cape Town International Airport',
   'ZAR', 2200.00, 0.00, 2200.00, 0.00, 2200.00),

  ('44444444-0006-0000-0000-000000000001', 'FHD-2026-100006',
   '11111111-0001-0000-0000-000000000001', '22222222-0001-0000-0000-000000000001', NULL,
   'self_drive', 'pending_deposit',
   NOW() + INTERVAL '72 hours', NOW() + INTERVAL '96 hours',
   'Fhdan Tourism Office', 'Fhdan Tourism Office',
   'ZAR', 2400.00, 0.00, 1200.00, 360.00, 2760.00)
ON CONFLICT (id) DO NOTHING;

-- Invoices
INSERT INTO public.invoices (id, invoice_number, booking_id, client_id, status, subtotal_zar, vat_zar, total_zar, balance_due_zar, payments_received, issued_date, due_date, paid_date)
VALUES
  ('55555555-0001-0000-0000-000000000001', 'FHD-INV-2026-00001',
   '44444444-0005-0000-0000-000000000001', '11111111-0004-0000-0000-000000000001',
   'paid', 2200.00, 0.00, 2200.00, 0.00, 2200.00,
   CURRENT_DATE - 7, CURRENT_DATE - 5, CURRENT_DATE - 6),

  ('55555555-0002-0000-0000-000000000001', 'FHD-INV-2026-00002',
   '44444444-0001-0000-0000-000000000001', '11111111-0001-0000-0000-000000000001',
   'sent', 3500.00, 525.00, 4025.00, 2275.00, 1750.00,
   CURRENT_DATE - 1, CURRENT_DATE + 29, NULL),

  ('55555555-0003-0000-0000-000000000001', 'FHD-INV-2026-00003',
   '44444444-0002-0000-0000-000000000001', '11111111-0003-0000-0000-000000000001',
   'sent', 2400.00, 360.00, 2760.00, 1560.00, 1200.00,
   CURRENT_DATE - 2, CURRENT_DATE + 28, NULL),

  ('55555555-0004-0000-0000-000000000001', 'FHD-INV-2026-00004',
   '44444444-0004-0000-0000-000000000001', '11111111-0002-0000-0000-000000000001',
   'draft', 1800.00, 270.00, 2070.00, 2070.00, 0.00,
   CURRENT_DATE, CURRENT_DATE + 14, NULL)
ON CONFLICT (id) DO NOTHING;

-- Payments
INSERT INTO public.payments (invoice_id, amount_zar, payment_method, payment_date, reference, notes)
VALUES
  ('55555555-0001-0000-0000-000000000001', 2200.00, 'eft', CURRENT_DATE - 6, 'EFT-20260511-001', NULL),
  ('55555555-0002-0000-0000-000000000001', 1750.00, 'card', CURRENT_DATE - 1, 'CARD-20260516-001', 'Deposit payment'),
  ('55555555-0003-0000-0000-000000000001', 1200.00, 'eft', CURRENT_DATE - 2, 'EFT-20260515-001', 'Deposit payment')
ON CONFLICT DO NOTHING;
