-- ================================================================
-- 4Core ERP — Schema PostgreSQL para Supabase
-- Execute no SQL Editor do Supabase (Database → SQL Editor → New query)
-- ================================================================

-- ---------------------------------------------------------------
-- Tabela: users  (autenticação interna do ERP)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(100)  NOT NULL,
    email         VARCHAR(100)  NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ           DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email);
CREATE        INDEX IF NOT EXISTS ix_users_id    ON users (id);

-- ---------------------------------------------------------------
-- Tabela: contracts  (contratos cadastrados manualmente)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contracts (
    id                 SERIAL        PRIMARY KEY,
    client_name        VARCHAR(180)  NOT NULL,
    asaas_customer_id  VARCHAR(80),
    title              VARCHAR(180)  NOT NULL,
    status             VARCHAR(30)   DEFAULT 'ativo',
    value              FLOAT,
    start_date         DATE,
    end_date           DATE,
    notes              TEXT,
    file_name          VARCHAR(255),
    file_path          VARCHAR(500),
    created_at         TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_contracts_asaas_customer_id ON contracts (asaas_customer_id);

-- ---------------------------------------------------------------
-- Tabela: orders  (pedidos fechados / faturamento)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL        PRIMARY KEY,
    client_name     VARCHAR(180)  NOT NULL,
    contract_id     INTEGER,
    description     TEXT          NOT NULL DEFAULT '',
    status          VARCHAR(30)   DEFAULT 'fechado',
    value           FLOAT         NOT NULL DEFAULT 0,
    closed_at       DATE,
    delivery_date   DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ   DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- Observações
-- ---------------------------------------------------------------
-- • RLS não precisa ser ativado: o backend conecta via connection
--   string direta como superuser (postgres), bypassando RLS.
-- • O SERIAL cria automaticamente a sequence para o auto-increment.
-- • Rode este script apenas uma vez. IF NOT EXISTS garante idempotência.
