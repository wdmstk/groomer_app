-- customers テーブル
CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    user_id uuid REFERENCES auth.users(id),
    full_name text NOT NULL,
    address text,
    phone_number text,
    email text UNIQUE,
    line_id text UNIQUE,
    how_to_know text,
    rank text DEFAULT '通常',
    tags text[]
);

-- service_menus テーブル
CREATE TABLE service_menus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    name text NOT NULL,
    category text,
    price numeric NOT NULL,
    duration integer NOT NULL,
    tax_rate numeric DEFAULT 0.1,
    tax_included boolean DEFAULT true,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    notes text
);

-- pets テーブル
CREATE TABLE pets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    customer_id uuid NOT NULL REFERENCES customers(id),
    name text NOT NULL,
    breed text,
    gender text,
    date_of_birth date,
    weight numeric,
    vaccine_date date,
    chronic_diseases text[],
    notes text
);

-- staffs テーブル
CREATE TABLE staffs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    full_name text NOT NULL,
    email text UNIQUE,
    user_id uuid REFERENCES auth.users(id),
    role text NOT NULL DEFAULT 'staff'
);

-- appointment_groups テーブル
CREATE TABLE appointment_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    store_id uuid NOT NULL REFERENCES stores(id),
    customer_id uuid NOT NULL REFERENCES customers(id),
    source text NOT NULL DEFAULT 'manual'
);

-- appointments テーブル
CREATE TABLE appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    customer_id uuid NOT NULL REFERENCES customers(id),
    group_id uuid REFERENCES appointment_groups(id),
    pet_id uuid NOT NULL REFERENCES pets(id),
    staff_id uuid NOT NULL REFERENCES staffs(id),
    start_time timestamptz NOT NULL,
    end_time timestamptz NOT NULL,
    menu text NOT NULL,
    duration integer NOT NULL,
    status text DEFAULT '予約済',
    notes text
);

-- appointment_menus テーブル
CREATE TABLE appointment_menus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    appointment_id uuid NOT NULL REFERENCES appointments(id),
    menu_id uuid NOT NULL REFERENCES service_menus(id),
    menu_name text NOT NULL,
    price numeric NOT NULL,
    duration integer NOT NULL,
    tax_rate numeric DEFAULT 0.1,
    tax_included boolean DEFAULT true
);

-- visits テーブル
CREATE TABLE visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    customer_id uuid NOT NULL REFERENCES customers(id),
    appointment_id uuid REFERENCES appointments(id),
    staff_id uuid NOT NULL REFERENCES staffs(id),
    visit_date timestamptz NOT NULL,
    menu text NOT NULL,
    total_amount numeric NOT NULL,
    notes text
);

-- visit_menus テーブル
CREATE TABLE visit_menus (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    visit_id uuid NOT NULL REFERENCES visits(id),
    menu_id uuid NOT NULL REFERENCES service_menus(id),
    menu_name text NOT NULL,
    price numeric NOT NULL,
    duration integer NOT NULL,
    tax_rate numeric DEFAULT 0.1,
    tax_included boolean DEFAULT true
);

-- payments テーブル
CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    appointment_id uuid NOT NULL REFERENCES appointments(id),
    customer_id uuid NOT NULL REFERENCES customers(id),
    visit_id uuid REFERENCES visits(id),
    status text DEFAULT '未払い',
    method text DEFAULT '現金',
    subtotal_amount numeric NOT NULL,
    tax_amount numeric NOT NULL,
    discount_amount numeric DEFAULT 0,
    total_amount numeric NOT NULL,
    paid_at timestamptz,
    notes text
);

-- medical_records テーブル
CREATE TABLE medical_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    pet_id uuid NOT NULL REFERENCES pets(id),
    staff_id uuid NOT NULL REFERENCES staffs(id),
    record_date timestamptz NOT NULL,
    menu text NOT NULL,
    duration integer,
    shampoo_used text,
    skin_condition text,
    behavior_notes text,
    photos text[],
    caution_notes text
);
