-- ============================================================
-- INDEX TRIGRAM POUR LA RECHERCHE GLOBALE (PostgreSQL)
-- À exécuter une seule fois sur la base de production
-- Prérequis : PostgreSQL 9.1+ avec extension pg_trgm
-- ============================================================

-- Activer l'extension trigram
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Centres de formation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tc_name_trgm
    ON training_center USING GIN (name gin_trgm_ops);

-- Agréments centres
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ca_number_trgm
    ON center_accreditation USING GIN (accreditation_number gin_trgm_ops);

-- Agréments formations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tra_title_trgm
    ON training_accreditation USING GIN (title gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tra_number_trgm
    ON training_accreditation USING GIN (accreditation_number gin_trgm_ops);

-- Activités de formation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ta_ville_trgm
    ON training_activity USING GIN (ville gin_trgm_ops);

-- Formateur·trices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trainer_lastname_trgm
    ON trainer USING GIN (last_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trainer_firstname_trgm
    ON trainer USING GIN (first_name gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trainer_email_trgm
    ON trainer USING GIN (email gin_trgm_ops);

-- Thématiques
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_theme_label_trgm
    ON theme USING GIN (label gin_trgm_ops);

-- Types de phytolicence
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lt_code_trgm
    ON license_type USING GIN (code gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lt_label_trgm
    ON license_type USING GIN (label gin_trgm_ops);

-- Organismes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organism_name_trgm
    ON organism USING GIN (name gin_trgm_ops);

-- Centres pilotes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pilot_center_name_trgm
    ON pilot_center USING GIN (name gin_trgm_ops);
