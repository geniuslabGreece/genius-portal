-- ─────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('admin', 'customer_admin', 'customer_user');
CREATE TYPE public.product_category AS ENUM ('software', 'hardware', 'erp', 'devices');
CREATE TYPE public.contract_source AS ENUM ('manual', 'import', 'softone_sync');
CREATE TYPE public.notification_type AS ENUM ('expiring_60', 'expiring_30', 'expiring_7', 'expired', 'general');

-- ─────────────────────────────────────────────────────────────
-- HELPER: updated_at trigger function
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- TABLE: customers
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  vat_number TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  address TEXT,
  account_manager_name TEXT,
  account_manager_email TEXT,
  account_manager_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- TABLE: customer_email_domains
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.customer_email_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  domain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_email_domains_customer ON public.customer_email_domains(customer_id);
CREATE INDEX idx_customer_email_domains_domain ON public.customer_email_domains(LOWER(domain));

-- ─────────────────────────────────────────────────────────────
-- TABLE: profiles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_customer ON public.profiles(customer_id);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- TABLE: user_roles (security-critical, separate table)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);

-- ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER: has_role (avoids RLS recursion)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Helper: get current user's customer_id
CREATE OR REPLACE FUNCTION public.current_user_customer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT customer_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────────────
-- TABLE: products
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category public.product_category NOT NULL,
  name TEXT NOT NULL,
  vendor TEXT,
  sku TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_category ON public.products(category);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- TABLE: contracts
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  contract_number TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'units',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  renewal_months INTEGER NOT NULL DEFAULT 12,
  source public.contract_source NOT NULL DEFAULT 'manual',
  notes TEXT,
  locked_from_sync BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_customer ON public.contracts(customer_id);
CREATE INDEX idx_contracts_product ON public.contracts(product_id);
CREATE INDEX idx_contracts_end_date ON public.contracts(end_date);

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────
-- TABLE: notifications
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_customer ON public.notifications(customer_id);
CREATE INDEX idx_notifications_contract ON public.notifications(contract_id);
CREATE INDEX idx_notifications_read ON public.notifications(customer_id, read);

-- ─────────────────────────────────────────────────────────────
-- ENABLE RLS on all tables
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: profiles
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "System can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: user_roles
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: customers
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can view their own customer"
  ON public.customers FOR SELECT
  USING (id = public.current_user_customer_id() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage customers"
  ON public.customers FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: customer_email_domains
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Admins can manage email domains"
  ON public.customer_email_domains FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their customer's domains"
  ON public.customer_email_domains FOR SELECT
  USING (customer_id = public.current_user_customer_id());

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: products (catalog visible to all authenticated)
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: contracts
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can view their customer's contracts"
  ON public.contracts FOR SELECT
  USING (customer_id = public.current_user_customer_id() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage contracts"
  ON public.contracts FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- RLS POLICIES: notifications
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "Users can view their customer's notifications"
  ON public.notifications FOR SELECT
  USING (customer_id = public.current_user_customer_id() OR public.is_admin(auth.uid()));

CREATE POLICY "Users can mark their notifications read"
  ON public.notifications FOR UPDATE
  USING (customer_id = public.current_user_customer_id());

CREATE POLICY "Admins can manage notifications"
  ON public.notifications FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- TRIGGER: handle_new_user — create profile + auto-link customer by email domain
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _domain TEXT;
  _customer_id UUID;
BEGIN
  -- Extract domain from email
  _domain := LOWER(SPLIT_PART(NEW.email, '@', 2));

  -- Look up customer by email domain
  SELECT customer_id INTO _customer_id
  FROM public.customer_email_domains
  WHERE LOWER(domain) = _domain
  LIMIT 1;

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url, customer_id, provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    _customer_id,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
  );

  -- Default role: customer_user (admins are promoted manually)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer_user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();