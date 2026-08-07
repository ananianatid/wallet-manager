---
target: Graphique d’évolution Statistiques — semaine, mois, trimestre, année, tout
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-07T10-14-24Z
slug: src-app-tabs-statistics-index-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | La période est visible, mais l’échelle et les valeurs exactes des barres ne le sont pas. |
| 2 | Match System / Real World | 3/4 | Revenus et dépenses correspondent au modèle mental financier, mais le graphique reste abstrait. |
| 3 | User Control and Freedom | 3/4 | La navigation et le choix de période sont présents, sans contrôle du niveau de détail. |
| 4 | Consistency and Standards | 3/4 | Les couleurs métier sont cohérentes, mais la légende n’est pas explicitement matérialisée. |
| 5 | Error Prevention | 3/4 | Les périodes sont correctement bornées, mais une longue période peut produire une lecture dense. |
| 6 | Recognition Rather Than Recall | 2/4 | L’utilisateur doit se souvenir que vert = revenus et rouge = dépenses. |
| 7 | Flexibility and Efficiency | 3/4 | Les cinq granularités existent, mais le graphique ne propose ni zoom ni détail à la demande. |
| 8 | Aesthetic and Minimalist Design | 3/4 | Composition sobre et cohérente, mais les barres et labels perdent en lisibilité sur les périodes longues. |
| 9 | Error Recovery | 2/4 | L’état vide est présent, mais il n’explique pas comment récupérer ou changer la période. |
| 10 | Help and Documentation | 2/4 | « Revenus vs dépenses » aide un peu, mais il manque une légende et une indication de lecture. |
| **Total** |  | **27/40** | Bonne base opérationnelle, lisibilité analytique encore moyenne. |

## Design Specificity Verdict

Le graphique est bien ancré dans le produit par ses périodes financières, ses libellés français et ses couleurs Revenus/Dépenses. Il reste toutefois assez interchangeable dans sa forme : deux barres côte à côte dans une carte, sans échelle, légende visuelle ni valeur au point de données.

Le détecteur Impeccable n’a trouvé aucune anomalie mécanique sur `statistics/index.tsx`, `statistics.ts` et `labeled-donut-chart.tsx`. Ce résultat est propre techniquement, mais il ne couvre pas les problèmes de compréhension analytique.

## Overall Impression

La direction est correcte : la carte s’adapte maintenant aux périodes et conserve une lecture simple. Le principal manque est la précision. Le graphique montre une tendance, mais ne permet pas encore de répondre rapidement à « combien ? », « quand ? » et « lequel des deux domine ? ».

## What’s Working

- La granularité suit le contexte : jours pour semaine/mois, mois pour trimestre/année/tout.
- Le contraste vert/rouge distingue immédiatement revenus et dépenses.
- Le graphique reste contenu dans une carte secondaire, derrière la carte de synthèse et le sélecteur de période.

## Priority Issues

### [P1] Légende insuffisante et dépendance à la couleur

**Pourquoi c’est important :** le texte « Revenus vs dépenses » ne dit pas quelle couleur correspond à quelle série. Les utilisateurs daltoniens ou ceux qui parcourent rapidement le graphique doivent deviner.

**Correction :** ajouter une légende compacte avec deux pastilles, « Revenus » et « Dépenses », et conserver les libellés textuels. Ajouter une description accessible au conteneur avec la période et les totaux.

**Commande suggérée :** `$impeccable clarify` puis `$impeccable polish`.

### [P1] Absence d’échelle et de valeurs exactes

**Pourquoi c’est important :** la hauteur relative des barres permet de comparer, mais pas de connaître le montant. Deux valeurs proches ou une petite dépense deviennent difficiles à distinguer.

**Correction :** ajouter une échelle légère ou une ligne de repère, et rendre chaque groupe de barres accessible avec son revenu, sa dépense et son total. Sur mobile, un appui pourrait afficher le détail du point sélectionné.

**Commande suggérée :** `$impeccable audit` puis `$impeccable polish`.

### [P1] Densité excessive pour les mois et les longues périodes

**Pourquoi c’est important :** un mois peut afficher jusqu’à 31 groupes et « Tout » peut en afficher beaucoup plus. Le défilement horizontal est présent, mais son affordance est faible et les barres deviennent difficiles à comparer.

**Correction :** conserver les 7 jours pour Semaine, mais pour Mois regrouper par semaine ou afficher un sous-ensemble lisible avec détail à la sélection. Pour Tout, limiter l’historique visible ou ajouter un contrôle d’intervalle.

**Commande suggérée :** `$impeccable adapt` puis `$impeccable optimize`.

### [P2] Labels temporels inégaux selon la période

**Pourquoi c’est important :** Semaine affiche seulement les jours de la semaine, tandis que Mois affiche quelques numéros et les périodes longues affichent des mois. Les labels ne donnent pas toujours assez de contexte.

**Correction :** afficher « lun. 3 », « mar. 4 », etc. pour Semaine ; afficher des repères réguliers pour Mois ; conserver « janv. », « févr. » pour les séries mensuelles. Le titre doit conserver la plage exacte sélectionnée.

**Commande suggérée :** `$impeccable clarify`.

### [P2] État vide trop passif

**Pourquoi c’est important :** « Aucune activité sur la période » informe mais n’aide pas à agir.

**Correction :** ajouter une phrase courte qui indique de changer de période ou d’ajouter une transaction, sans introduire un bouton d’action inutile.

**Commande suggérée :** `$impeccable clarify`.

## Persona Red Flags

- **Alex, utilisateur avancé :** ne peut pas lire une valeur exacte sans quitter le graphique ni obtenir un détail au point de données ; les longues périodes exigent trop de défilement.
- **Jordan, première utilisation :** voit deux couleurs mais aucune légende visuelle explicite ; il peut interpréter rouge comme « mauvais résultat » plutôt que comme dépenses.
- **Sam, sensibilité aux contrastes/couleurs :** la compréhension repose encore trop sur vert et rouge, malgré les libellés de section.

## Minor Observations

- Le titre « Revenus vs dépenses » pourrait préciser que les frais de transfert sont inclus dans les dépenses affichées.
- L’axe ne montre pas l’unité monétaire, alors que l’application gère plusieurs devises et conversions.
- Les barres à zéro occupent l’espace mais n’expliquent pas visuellement l’absence d’activité ; un état neutre plus explicite améliorerait la lecture.

## Questions to Consider

- Le graphique doit-il répondre d’abord à « tendance » ou à « montant exact » ? Cela détermine si l’on privilégie échelle/valeurs ou interaction au toucher.
- Pour « Tout », veux-tu vraiment afficher toute l’historique, ou une fenêtre glissante avec un choix d’intervalle ?
- Pour un mois, la lecture quotidienne est-elle plus utile qu’un regroupement par semaine ?
