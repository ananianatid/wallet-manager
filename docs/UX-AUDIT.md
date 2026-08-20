# Audit UX — Wallet

## Lecture du produit

Wallet est un gestionnaire financier local-first pour une personne qui consulte son téléphone en mobilité, souvent sans réseau. Sa valeur n'est pas seulement de compter les opérations : elle consiste à répondre rapidement à trois questions :

1. Combien puis-je dépenser sans compromettre mes échéances ?
2. Où se trouve réellement mon argent ?
3. Que dois-je préparer ou enregistrer ensuite ?

Le moteur SQLite, les soldes dérivés, les transferts, les devises, les budgets, les objectifs, l'épargne automatique, les récurrences et les sauvegardes chiffrées couvrent bien ce modèle. La confidentialité locale et la possibilité de récupération sont des éléments de confiance, pas des fonctionnalités décoratives.

## Forces confirmées

- Le montant « à dépenser sans risque » relie le solde réel aux échéances futures.
- La saisie accepte les opérations passées et futures, les transferts, les frais et les conversions.
- Les comptes affichent le disponible, les réservations et l'exclusion du total.
- Les données sont locales, exportables et restaurables avec une protection explicite.
- Les états de chargement, d'erreur, de vide et les libellés d'accessibilité sont déjà traités dans les composants communs.

## Frictions observées

- La navigation primaire mélangeait une analyse avancée (Statistiques) avec les tâches quotidiennes, alors que les fonctions de préparation étaient cachées dans Réglages.
- Budgets, objectifs, épargne et récurrences forment un même système mental — les engagements futurs — mais étaient répartis entre plusieurs pages sans point d'entrée commun.
- L'accueil devait porter simultanément la décision immédiate, les actions rapides, les budgets, les plans, l'historique, les échéances et la configuration initiale ; cette richesse augmente le défilement et dilue le prochain geste.
- Réglages mélangeait organisation financière, planification, sécurité, données et préférences. Il fonctionnait comme un inventaire, pas comme un espace de configuration hiérarchisé.
- Les statistiques sont utiles pour comprendre une variation, mais ne doivent pas être le premier choix de navigation d'une application utilisée pour enregistrer et décider.

## Architecture retenue

| Destination | Question principale | Contenu prioritaire |
|---|---|---|
| Accueil | Que puis-je faire maintenant ? | Dépensable sans risque, actions rapides, pression à venir, mouvements récents |
| Transactions | Qu'est-ce qui s'est passé ? | Période, recherche, filtres, historique, ajout |
| Plans | Que dois-je préparer ? | Budgets, objectifs, épargne, récurrences, accès aux analyses |
| Comptes | Où est l'argent ? | Soldes disponibles, groupes, détails et gestion |
| Réglages | Comment l'application fonctionne-t-elle ? | Catégories, sécurité, données, apparence, devises, confidentialité |

Les statistiques restent une destination réelle et routable, mais secondaire : elles sont ouvertes depuis Plans lorsqu'une comparaison aide à ajuster un budget ou une stratégie.

## Principes d'implémentation

- Un espace primaire = une intention utilisateur stable.
- Une information chiffrée importante doit afficher son périmètre et ouvrir une action utile.
- Les listes restent pleine largeur et séparées ; les cartes sont réservées aux décisions ou aux synthèses.
- La navigation conserve les attentes Android : cinq destinations compactes, cibles de 48 dp, retour système et insets respectés.
- Aucun chiffre, service ou promesse n'est ajouté sans source dans les données locales.
