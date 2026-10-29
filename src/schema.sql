-- Tables de Diop Motors (PostgreSQL). Peut être relancé sans risque : rien n'est effacé.

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  description TEXT        NOT NULL DEFAULT '',
  price       INTEGER     NOT NULL CHECK (price >= 0),
  stock       INTEGER     NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image       TEXT,
  featured    BOOLEAN     NOT NULL DEFAULT FALSE,
  active      BOOLEAN     NOT NULL DEFAULT TRUE,
  is_demo     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS listings (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind         TEXT        NOT NULL CHECK (kind IN ('moto', 'scooter')),
  title        TEXT        NOT NULL,
  brand        TEXT        NOT NULL,
  model        TEXT        NOT NULL,
  year         INTEGER     NOT NULL,
  mileage      INTEGER     NOT NULL,
  price        INTEGER     NOT NULL CHECK (price > 0),
  city         TEXT        NOT NULL,
  description  TEXT        NOT NULL,
  seller_name  TEXT        NOT NULL,
  seller_phone TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected', 'sold')),
  is_demo      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS listing_photos (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  filename   TEXT    NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_listings_status ON listings (status, approved_at);
CREATE INDEX IF NOT EXISTS idx_listings_phone  ON listings (seller_phone, status);
CREATE INDEX IF NOT EXISTS idx_photos_listing  ON listing_photos (listing_id, position);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (active, category);
