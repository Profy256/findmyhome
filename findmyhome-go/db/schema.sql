-- FindMyHome PostgreSQL Schema
-- Run once against a fresh Neon/Postgres database, or use: go run ./cmd/migrate
-- All statements are idempotent (IF NOT EXISTS / ON CONFLICT DO NOTHING).

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                     TEXT        NOT NULL,
    email                    TEXT        NOT NULL,
    phone                    TEXT        NOT NULL,
    password                 TEXT        NOT NULL,
    role                     TEXT        NOT NULL DEFAULT 'buyer',
    kyc_status               TEXT        NOT NULL DEFAULT 'none',
    blue_badge               BOOLEAN     NOT NULL DEFAULT FALSE,
    blue_badge_expires_at    TIMESTAMPTZ,
    fcm_token                TEXT,
    company_name             TEXT,
    registration_number      TEXT,
    seller_categories        JSONB,
    booking_enabled          BOOLEAN     NOT NULL DEFAULT FALSE,
    free_featured_slots      INT         NOT NULL DEFAULT 0,
    commission_rate_override DOUBLE PRECISION,
    google_id                TEXT,
    avatar                   TEXT,
    terms_agreed_at          TIMESTAMPTZ,
    remember_token           TEXT,
    deleted_at               TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique  ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique  ON users (phone)        WHERE deleted_at IS NULL;
CREATE        INDEX IF NOT EXISTS users_role_idx      ON users (role);
CREATE        INDEX IF NOT EXISTS users_deleted_at_idx ON users (deleted_at);

-- ── Personal Access Tokens (Sanctum-compatible) ────────────────────────────────
CREATE TABLE IF NOT EXISTS personal_access_tokens (
    id              BIGSERIAL   PRIMARY KEY,
    tokenable_type  TEXT        NOT NULL,
    tokenable_id    TEXT        NOT NULL,
    name            VARCHAR(255) NOT NULL,
    token           TEXT        NOT NULL,
    abilities       TEXT        NOT NULL DEFAULT '["*"]',
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS personal_access_tokens_token_unique
    ON personal_access_tokens (token);
CREATE INDEX IF NOT EXISTS personal_access_tokens_tokenable_idx
    ON personal_access_tokens (tokenable_type, tokenable_id);

-- ── Password Reset Tokens ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    email      TEXT        PRIMARY KEY,
    token      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Properties ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS properties (
    id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id                UUID        NOT NULL REFERENCES users(id),
    title                    TEXT        NOT NULL,
    description              TEXT        NOT NULL,
    price                    BIGINT      NOT NULL,
    location                 TEXT        NOT NULL,
    district                 TEXT,
    property_type            TEXT        NOT NULL,
    listing_type             TEXT        NOT NULL,
    bedrooms                 INT,
    bathrooms                INT,
    size                     TEXT,
    photos                   JSONB       NOT NULL DEFAULT '[]',
    amenities                JSONB,
    max_guests               INT,
    price_per_night          DOUBLE PRECISION,
    status                   TEXT        NOT NULL DEFAULT 'active',
    featured                 BOOLEAN     NOT NULL DEFAULT FALSE,
    featured_until           TIMESTAMPTZ,
    land_title_url           TEXT,
    land_title_cloudinary_id TEXT,
    land_title_lat           DOUBLE PRECISION,
    land_title_lng           DOUBLE PRECISION,
    land_title_verified      BOOLEAN     NOT NULL DEFAULT FALSE,
    deleted_at               TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS properties_seller_id_idx  ON properties (seller_id);
CREATE INDEX IF NOT EXISTS properties_status_idx     ON properties (status);
CREATE INDEX IF NOT EXISTS properties_deleted_at_idx ON properties (deleted_at);
CREATE INDEX IF NOT EXISTS properties_featured_idx   ON properties (featured) WHERE featured = TRUE;

-- ── KYC Documents ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS kyc_documents (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID        NOT NULL REFERENCES users(id),
    document_type        TEXT        NOT NULL,
    file_url             TEXT        NOT NULL,
    cloudinary_public_id TEXT        NOT NULL DEFAULT '',
    status               TEXT        NOT NULL DEFAULT 'pending',
    rejection_reason     TEXT,
    ai_confidence_score  INT,
    reviewed_by          UUID        REFERENCES users(id),
    reviewed_at          TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS kyc_documents_user_id_status_idx ON kyc_documents (user_id, status);
CREATE INDEX IF NOT EXISTS kyc_documents_status_idx         ON kyc_documents (status);

-- ── Leads ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id        UUID        NOT NULL REFERENCES users(id),
    seller_id       UUID        NOT NULL REFERENCES users(id),
    property_id     UUID        NOT NULL REFERENCES properties(id),
    contact_method  TEXT        NOT NULL,
    seller_notified BOOLEAN     NOT NULL DEFAULT FALSE,
    notified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leads_seller_id_idx                  ON leads (seller_id);
CREATE INDEX IF NOT EXISTS leads_buyer_property_method_idx      ON leads (buyer_id, property_id, contact_method);

-- ── Ratings ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id    UUID        NOT NULL REFERENCES users(id),
    seller_id   UUID        NOT NULL REFERENCES users(id),
    property_id UUID        REFERENCES properties(id),
    stars       SMALLINT    NOT NULL CHECK (stars BETWEEN 1 AND 5),
    review      TEXT,
    is_visible  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ratings_seller_id_visible_idx ON ratings (seller_id, is_visible);
CREATE INDEX IF NOT EXISTS ratings_buyer_seller_idx      ON ratings (buyer_id, seller_id);

-- ── Bookings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id             UUID        NOT NULL REFERENCES users(id),
    property_id          UUID        NOT NULL REFERENCES properties(id),
    checkin_date         DATE        NOT NULL,
    checkout_date        DATE        NOT NULL,
    guests               INT         NOT NULL,
    total_price          BIGINT      NOT NULL,
    platform_fee         BIGINT      NOT NULL,
    status               TEXT        NOT NULL DEFAULT 'pending',
    payment_status       TEXT        NOT NULL DEFAULT 'unpaid',
    pesapal_order_id     TEXT        UNIQUE,
    pesapal_tracking_id  TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bookings_property_status_idx  ON bookings (property_id, status);
CREATE INDEX IF NOT EXISTS bookings_buyer_id_idx         ON bookings (buyer_id);
CREATE INDEX IF NOT EXISTS bookings_payment_status_idx   ON bookings (payment_status);

-- ── Transactions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id             UUID        NOT NULL REFERENCES users(id),
    seller_id            UUID        NOT NULL REFERENCES users(id),
    property_id          UUID        NOT NULL REFERENCES properties(id),
    agreed_price         BIGINT      NOT NULL,
    buyer_confirmed      BOOLEAN     NOT NULL DEFAULT FALSE,
    seller_confirmed     BOOLEAN     NOT NULL DEFAULT FALSE,
    buyer_confirmed_at   TIMESTAMPTZ,
    seller_confirmed_at  TIMESTAMPTZ,
    completed_at         TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_buyer_seller_idx ON transactions (buyer_id, seller_id);
CREATE INDEX IF NOT EXISTS transactions_property_id_idx  ON transactions (property_id);

-- ── Commissions ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS commissions (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id         UUID        NOT NULL REFERENCES users(id),
    transaction_id    UUID        NOT NULL REFERENCES transactions(id),
    property_price    BIGINT      NOT NULL,
    commission_amount BIGINT      NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'pending',
    due_date          DATE        NOT NULL,
    paid_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commissions_seller_status_idx    ON commissions (seller_id, status);
CREATE INDEX IF NOT EXISTS commissions_transaction_id_idx   ON commissions (transaction_id);

-- ── Notifications ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    notifiable_type  TEXT        NOT NULL,
    notifiable_id    UUID        NOT NULL,
    type             TEXT        NOT NULL,
    data             JSONB       NOT NULL DEFAULT '{}',
    read_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_notifiable_idx  ON notifications (notifiable_type, notifiable_id);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx     ON notifications (read_at) WHERE read_at IS NULL;

-- ── Settings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id         BIGSERIAL   PRIMARY KEY,
    key        TEXT        NOT NULL UNIQUE,
    value      TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
    ('commission_rate',            '5'),
    ('commission_rate_company',    '3'),
    ('commission_due_days',        '14'),
    ('commission_block_threshold', '3'),
    ('booking_fee_rate',           '7'),
    ('blue_badge_price',           '300000')
ON CONFLICT (key) DO NOTHING;
