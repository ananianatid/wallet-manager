WITH defaults(type, name, icon) AS (
  VALUES
    ('account', 'Compte courant', 'wallet-cards'),
    ('account', 'Épargne', 'piggy-bank'),
    ('account', 'Espèces', 'banknote'),
    ('account', 'Mobile Money', 'smartphone'),
    ('account', 'Autre', 'tag'),
    ('income', 'Salaire', 'banknote-arrow-up'),
    ('income', 'Virement reçu', 'banknote'),
    ('income', 'Cadeau', 'gift'),
    ('income', 'Remboursement', 'rotate-ccw'),
    ('income', 'Autre', 'tag'),
    ('expense', 'Nourriture', 'utensils'),
    ('expense', 'Transport', 'car-front'),
    ('expense', 'Logement', 'house'),
    ('expense', 'Factures', 'receipt-text'),
    ('expense', 'Santé', 'heart-pulse'),
    ('expense', 'Éducation', 'graduation-cap'),
    ('expense', 'Loisirs', 'gamepad-2'),
    ('expense', 'Shopping', 'shopping-bag'),
    ('expense', 'Autre', 'tag')
)
INSERT INTO sync_entities (workspace_id, entity_type, entity_id, version, payload)
SELECT w.id, 'categories', gen_random_uuid(), 1,
       jsonb_build_object('fields', jsonb_build_object('type', d.type, 'name', d.name, 'is_seed', 1, 'icon', d.icon), 'refs', '{}'::jsonb)
FROM workspaces w
CROSS JOIN defaults d
WHERE NOT EXISTS (
  SELECT 1 FROM sync_entities e
  WHERE e.workspace_id = w.id
    AND e.entity_type = 'categories'
    AND e.payload #>> '{fields,type}' = d.type
    AND e.payload #>> '{fields,name}' = d.name
);
