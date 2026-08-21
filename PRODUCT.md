# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Une personne qui suit ses finances au quotidien depuis son téléphone, souvent rapidement et hors connexion, avec des montants en francs CFA.

## Product Purpose

Wallet aide à savoir ce qui est disponible, où l'argent se trouve et quelles décisions financières arrivent ensuite. Le succès se mesure au temps nécessaire pour enregistrer une opération et à la confiance avec laquelle l'utilisateur peut décider quoi payer ou déplacer.

## Positioning

Wallet est un gestionnaire local-first avec cloud optionnel : par défaut les données financières restent sur l'appareil, le solde est dérivé des opérations réelles et la notion de « dépenses sûres » transforme l'historique en décision immédiate. Quand l'utilisateur le choisit, la synchronisation chiffrée rejoue les mêmes opérations sur ses autres appareils sans jamais bloquer l'usage hors ligne.

## Operating Context

L'utilisateur alterne entre une vue d'ensemble, la saisie rapide d'une transaction, la consultation d'un compte, la recherche dans l'historique et la préparation de dépenses futures. L'application doit rester lisible en mobilité, fonctionner sans réseau et utiliser un vocabulaire français direct. Le mode en ligne est progressif : pas de blocage au premier lancement, un indicateur discret dans la barre d'onglets, un banner contextuel quand une sync est en attente ou en conflit, et un pull-to-refresh qui ne masque jamais les données locales.

## Capabilities and Constraints

- Comptes, transactions (revenu, dépense, transfert), catégories et groupes de comptes.
- Budgets, objectifs, règles d'épargne, récurrences, statistiques et dépenses sûres.
- Recherche et filtres d'opérations, export et restauration de sauvegardes chiffrées.
- Verrouillage par PIN/biométrie, protection des captures et journal de diagnostics.
- Données locales SQLite, montants entiers en XOF/FCFA, devise de base configurable.
- Synchronisation cloud optionnelle (après vérification email), file d'attente hors ligne, centre de conflits explicite, pièces jointes MinIO.
- Expo SDK 57, Expo Router, React Native, Android prioritaire, cibles tactiles d'au moins 48 dp.
- Ne pas inventer de paiement ou de données financières externes.

## Brand Commitments

- Nom produit : Wallet.
- Interface en français, ton calme, précis et actionnable.
- La confidentialité locale-first et le contrôle de l'utilisateur doivent être compréhensibles sans jargon ; le cloud est expliqué comme une copie chiffrée optionnelle.
- Les couleurs sémantiques des revenus, dépenses et alertes restent distinctes de la couleur d'accent ; les états cloud utilisent warning/expense avec parcimonie.

## Evidence on Hand

- Schéma, dépôts SQLite et écrans présents dans `src/`.
- Parcours et règles métier documentés dans `docs/PLAN.md`.
- Actifs d'identité présents dans `assets/images/`.
- Aucun témoignage, benchmark ou chiffre externe à afficher : ne rien fabriquer.

## Product Principles

- Montrer la décision avant le détail.
- Rendre l'enregistrement d'une opération plus rapide que sa remise à plus tard.
- Toujours relier un chiffre à son périmètre et à sa prochaine action.
- Garder les données privées, locales et récupérables par une sauvegarde explicite ; le cloud ne remplace jamais la sauvegarde.
- Préférer une hiérarchie calme et une information dense mais respirable.
- Séparer les décisions quotidiennes des engagements futurs : l'accueil sert à décider et enregistrer, Plans sert à préparer et ajuster.
- Réserver la navigation primaire aux espaces visités fréquemment ; les analyses avancées restent accessibles au moment où elles éclairent une décision.
- Ne jamais bloquer une action locale pour cause réseau : sync en arrière-plan, offline d'abord, conflits expliqués sans jargon.

## Accessibility & Inclusion

- Cibles tactiles de 48 dp minimum et espacées.
- Contraste lisible en thèmes clair et sombre, sans dépendre de la couleur seule.
- Libellés d'accessibilité et états de chargement, vide, erreur et succès explicites.
- Respect du clavier, des insets système, du retour Android et de la réduction des animations.
