---
name: Wallet
description: Une caisse de poche pour décider, enregistrer et garder le contrôle.
colors:
  indigo-night: "#0A1020"
  indigo-surface: "#111A2B"
  indigo-elevated: "#182541"
  lime-decision: "#D8F36A"
  indigo-action-light: "#263A77"
  coral-outflow: "#F87171"
  mint-inflow: "#4ADE80"
  paper-bg: "#F4F6F1"
  ink: "#16213A"
  sage-outline: "#99A8A0"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.lime-decision}"
    textColor: "{colors.indigo-night}"
    rounded: "{rounded.md}"
    height: "52px"
  navigation:
    backgroundColor: "{colors.indigo-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    height: "64px"
---

# Design System: Wallet

## Overview

**Creative North Star: « La caisse de poche »**

Wallet reprend la précision d'un carnet de caisse et la rapidité d'un reçu mobile money, mais les traduit en une interface Android calme et contemporaine. Les surfaces indigo forment le support de lecture ; le citron ne sert qu'à signaler une décision ou une action possible. Le coral et le mint décrivent les sorties et entrées réelles, jamais une décoration.

L'app est en mode Operate : la situation financière doit être comprise en quelques secondes, puis l'action la plus utile doit être évidente. La densité est assumée dans les listes et les chiffres, compensée par des espacements réguliers et une typographie compacte. Les composants privilégient la profondeur tonale aux effets de verre ou aux cartes décoratives.

**Key Characteristics:**

- Indigo profond, surfaces tonales, accent citron rare.
- Chiffres tabulaires et hiérarchie Android lisible.
- Décision « à dépenser sans risque » au premier plan.
- Navigation flottante mais conforme aux attentes Android, structurée autour de l'usage quotidien.

## Colors

La palette reste stable entre les modes clair et sombre : l'indigo structure, le citron décide, le mint crédite et le coral alerte.

### Primary

- **Citron décision** (#D8F36A): action primaire en sombre, sélection active et marqueur de possibilité.
- **Indigo action** (#263A77): action primaire en clair et surface d'action partagée.

### Tertiary

- **Mint entrée** (#4ADE80): revenus et amélioration du disponible.
- **Coral sortie** (#F87171): dépenses, frais et situations déficitaires.

### Neutral

- **Indigo nuit** (#0A1020): fond sombre et scène de lecture nocturne.
- **Indigo surface** (#111A2B): listes et zones de contenu.
- **Indigo élevé** (#182541): contrôle, champ et niveau de profondeur supérieur.
- **Papier végétal** (#F4F6F1): fond clair reposant.
- **Encre bleue** (#16213A): texte principal en clair.

### Named Rules

**La règle du citron rare.** L'accent citron appartient aux décisions et aux contrôles ; il ne colore pas chaque titre ni chaque section.

## Typography

**Display Font:** sans-serif-condensed système Android, avec sans-serif comme repli.
**Body Font:** Roboto système via les familles natives Android.
**Label Font:** même famille, chiffres tabulaires pour les montants et les dates.

**Character:** compacte, précise et humaine. Les titres sont courts et fermes ; les explications restent en phrase normale.

### Hierarchy

- **Display** (800, 34/40): titre du premier écran et annonce de contexte.
- **Title** (700, 22/28): titre d'écran secondaire et bloc d'identité.
- **Section** (700, 16/22): section de contenu et état principal.
- **Body** (400, 15/21): description, détail et aide.
- **Label** (600, 12/16): métadonnée, état et contrôle secondaire.
- **Amount** (800, 30/36): montants clés avec variantes compactes.

### Named Rules

**La règle du chiffre stable.** Les montants utilisent des chiffres tabulaires et ne sont jamais réduits à une couleur sans libellé.

## Layout

Les écrans mobiles utilisent une marge latérale de 16 dp, un rythme de 4/8/12/16/24/32 dp et des cibles de 48 dp minimum. Le premier écran suit l'ordre décision → actions rapides → pression future → historique. Les listes utilisent une lecture pleine largeur avec séparateurs fins plutôt qu'une grille de cartes imbriquées. La navigation reste en bas sur téléphone, avec les insets système intégrés.

## Elevation & Depth

La profondeur est principalement tonale : `background` → `surface` → `surfaceElevated` → surfaces accentuées. Les bordures servent à séparer et à rendre les contrôles identifiables. Une ombre courte peut accompagner le FAB, mais elle ne doit pas devenir une texture générale.

## Shapes

Les contrôles principaux utilisent 12 dp, les groupes de contenu 16 dp et la carte de décision 24 dp. Les icônes dans les listes sont des carrés légèrement arrondis, plus proches d'un ticket ou d'un repère de caisse que d'un badge circulaire. Les pills restent réservées aux états courts et aux sélections.

## Components

### Buttons

- **Shape:** 12 dp, hauteur 52 dp pour l'action principale.
- **Primary:** accent courant avec texte `onAccent`, poids 700.
- **Secondary:** surface élevée, contour `outline`, texte principal.
- **State:** opacité réduite à la pression ou lorsqu'il est désactivé.

### Cards / Containers

- **Decision card:** surface accentuée, 24 dp, montant principal puis projection après échéances.
- **Summary card:** même surface accentuée, bilan net en tête et détail revenus/dépenses dessous.
- **Lists:** surface simple, séparation fine, pas de carte dans une carte.

### Inputs / Fields

- **Style:** surface ou surface élevée, contour fin, 12 dp, hauteur minimum 48 dp.
- **Focus:** changement de contour et accent, jamais un halo décoratif.
- **Error:** message français actionnable sous le champ, avec couleur et rôle d'alerte.

### Navigation

La barre principale est une navigation Android pleine largeur visuellement flottante, avec cinq destinations : Accueil, Transactions, Plans, Comptes et Réglages. Les Statistiques restent accessibles depuis Plans comme outil d'analyse secondaire, plutôt que de concurrencer les tâches quotidiennes. L'état actif utilise une tonalité de l'accent ; le retour système et les insets restent prioritaires.

### Carte de décision

« À dépenser sans risque » juxtapose le disponible maintenant et le disponible après échéances. Elle est interactive, accessible, et ouvre le détail du calcul plutôt que de transformer une prévision en simple décoration.

## Do's and Don'ts

### Do:

- **Do** relier chaque nombre important à son périmètre et à une action.
- **Do** garder les revenus, dépenses et alertes lisibles sans dépendre de la couleur seule.
- **Do** privilégier la profondeur tonale, les séparateurs fins et une hiérarchie stable.
- **Do** vérifier le clair, le sombre, le clavier et les insets Android.

### Don't:

- **Don't** transformer chaque information en carte arrondie indépendante.
- **Don't** utiliser l'accent citron sur les éléments purement informatifs.
- **Don't** afficher de données, promesses ou tendances qui ne viennent pas de SQLite.
- **Don't** remplacer un libellé français par un pictogramme ambigu.
