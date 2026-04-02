-- =========================================================
-- SCHEMA FIXES (idempotent)
-- =========================================================
ALTER TABLE training_accreditation
    ALTER COLUMN center_accreditation_id DROP NOT NULL;

-- =========================================================
-- LICENSE TYPES
-- =========================================================
INSERT INTO license_type (code, label, description, archived, created_at, updated_at)
VALUES
    ('NP', 'NP', 'Distribution / Conseil - Produits non professionnels', false, now(), now()),
    ('P1', 'P1', 'Assistant usage professionnel', false, now(), now()),
    ('P2', 'P2', 'Usage professionnel', false, now(), now()),
    ('P3', 'P3', 'Distribution - Conseil', false, now(), now()),
    ('PS', 'PS', 'Usage professionnel spécifique', false, now(), now())
ON CONFLICT ON CONSTRAINT uk_license_type_code DO NOTHING;



-- =========================================================
-- THEMES
-- Idempotent basé sur label
-- =========================================================
INSERT INTO theme (label, description, archived, created_at, updated_at)
VALUES
    ('Communication', 'Communication autour de l’utilisation des PPP', false, now(), now()),
    ('Législation', 'Cadre légal lié aux produits phytopharmaceutiques', false, now(), now())
ON CONFLICT (label) DO NOTHING;



-- =========================================================
-- SUB THEMES
-- Idempotent via (theme_id, label)
-- On ne dépend PAS des IDs fixes
-- =========================================================

INSERT INTO sub_theme (theme_id, label, description, archived, created_at, updated_at)
VALUES
    (
      (SELECT id FROM theme WHERE label = 'Communication'),
      'Communication sur les lieux de vente',
      'Communication sur les lieux de vente de PPP à usage pro ou non-pro',
      false, now(), now()
    ),
    (
      (SELECT id FROM theme WHERE label = 'Communication'),
      'Conseils de communication proactive',
      'Conseils de communication envers les publics exposés (passants, riverains, collègues)',
      false, now(), now()
    ),
    (
      (SELECT id FROM theme WHERE label = 'Communication'),
      'Échanges entre titulaires',
      'Échanges (consignes, règles, informations) entre titulaires P1, P2 et P3',
      false, now(), now()
    )
ON CONFLICT (theme_id, label) DO NOTHING;


INSERT INTO sub_theme (theme_id, label, description, archived, created_at, updated_at)
VALUES
    (
      (SELECT id FROM theme WHERE label = 'Législation'),
      'Utilisation et stockage des PPP',
      'Règles d’utilisation et de stockage des produits phytopharmaceutiques',
      false, now(), now()
    ),
    (
      (SELECT id FROM theme WHERE label = 'Législation'),
      'Gestion des emballages et effluents',
      'Gestion des emballages, effluents phytosanitaires et déchets',
      false, now(), now()
    ),
    (
      (SELECT id FROM theme WHERE label = 'Législation'),
      'Espaces publics et groupes vulnérables',
      'Protection des espaces publics et groupes vulnérables',
      false, now(), now()
    ),
    (
      (SELECT id FROM theme WHERE label = 'Législation'),
      'Impacts du non-respect de la législation',
      'Produits non autorisés, résidus, conditionnalité, résistances',
      false, now(), now()
    )
ON CONFLICT (theme_id, label) DO NOTHING;



-- =========================================================
-- USERS
-- =========================================================

-- Ajout colonne si pas encore existante (sécurisé)
ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS force_password_change boolean NOT NULL DEFAULT false;

-- Insert admin (idempotent)
INSERT INTO app_user (email, password_hash, role, active, force_password_change, created_at)
VALUES (
  'admin@b12.local',
  '$2b$10$PQ4lXQRmSak.s53Tnw/YOeMFnKIxorVez6L9RppaY48ZUHRKmnlH6',
  'ADMIN',
  true,
  false,
  now()
)
ON CONFLICT (email)
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  active = EXCLUDED.active,
  force_password_change = EXCLUDED.force_password_change;
ALTER TABLE license_type
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(180);

ALTER TABLE theme
  ADD COLUMN IF NOT EXISTS updated_by VARCHAR(180);
ALTER TABLE license_type
  ADD COLUMN IF NOT EXISTS created_by varchar(255),
  ADD COLUMN IF NOT EXISTS updated_by varchar(255);
update license_type
set updated_by = null
where updated_by like 'com.b12.security.JwtUserPrincipal@%';
ALTER TABLE training_center
  ADD COLUMN IF NOT EXISTS hq_street       varchar(180),
  ADD COLUMN IF NOT EXISTS hq_number       varchar(30),
  ADD COLUMN IF NOT EXISTS hq_postal_code  varchar(20),
  ADD COLUMN IF NOT EXISTS hq_city         varchar(120),
  ADD COLUMN IF NOT EXISTS hq_province     varchar(120);
