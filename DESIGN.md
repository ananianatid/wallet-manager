---
name: Wallet
description: Finance Personal OS — un outil calme pour comprendre, enregistrer et maîtriser son argent.
colors:
  background: "#F5F5F2"
  surface: "#FFFFFF"
  text: "#181916"
  muted: "#85877F"
  line: "#E6E6E0"
  accent: "#26352D"
  accent-soft: "#E2EBE4"
  positive: "#4C6656"
  negative: "#B75C52"
rounded:
  small: "12px"
  medium: "18px"
  large: "26px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
---

# Finance Personal OS

## Philosophie

Wallet doit sembler calme, intelligent et maîtrisé. La clarté passe avant la quantité d’informations, la hiérarchie avant la décoration et la confiance reste humaine, jamais anxiogène.

L’application est en mode **Operate** : elle doit aider à comprendre une situation financière en quelques secondes, puis rendre l’action utile évidente. Les données restent locales, les chiffres viennent de SQLite et l’interface ne fabrique aucune tendance.

## Couleur

Le fond chaud `#F5F5F2` évite la froideur d’un blanc intégral. Le vert botanique profond `#26352D` est la signature et porte les actions principales ainsi que la carte patrimoine. La surface douce `#E2EBE4` accueille les insights sans créer d’alerte.

Les couleurs sémantiques restent discrètes : `#4C6656` pour les revenus et les évolutions positives, `#B75C52` pour les alertes, dépassements et situations problématiques. Une dépense normale reste dans la couleur de texte principale.

Le mode sombre conserve la même identité avec une dérivation contrastée. Le choix d’accent historique est conservé uniquement pour lire les anciennes préférences ; il ne change plus la palette du produit.

## Typographie

La famille prioritaire est Inter lorsqu’un fichier local vérifié est embarqué. Le fallback Android est la famille système sans-serif. Les montants utilisent des chiffres tabulaires.

- Hero : 34–38 px, poids 700, tracking serré.
- Montant principal : 46 px, poids 700, tracking serré.
- Section : 18 px, poids 700.
- Corps : 15 px, interligne 21 px.
- Métadonnée : 12 px, silencieuse mais contrastée.

Les titres sont peu nombreux. Un montant important est grand parce que le reste de l’écran sait rester discret.

## Formes, surfaces et profondeur

- Petits contrôles : rayon 12 px.
- Sections et cartes secondaires : rayon 18 px.
- Carte patrimoine et grands panneaux : rayon 26 px.
- Bordure : 1 px `#E6E6E0`, jamais de contour noir épais.
- Ombre : aucune par défaut ; uniquement pour le FAB, les menus et les panneaux flottants.
- Une surface est définie par sa couleur, son espace et sa séparation avant toute élévation.

Les listes utilisent une lecture pleine largeur avec des séparateurs fins. Les cartes ne deviennent pas des mini-dashboards et une carte secondaire porte une seule information principale.

## Accueil

Le premier écran suit cet ordre :

1. contexte du jour ;
2. carte **Patrimoine disponible** avec montant actuel, évolution ou prévision après échéances ;
3. budgets et plans utiles ;
4. activité récente ;
5. premiers réglages uniquement lorsqu’ils sont nécessaires.

La carte patrimoine conserve le calcul « disponible sans risque » existant. La formulation explique le périmètre au lieu de présenter une prévision comme un solde brut.

## Actions et navigation

La navigation Android expose cinq espaces :

`Accueil · Activité · Planification · Statistiques · Comptes`

Le bouton central `+` ouvre un menu d’ajout avec `Dépense`, `Revenu`, `Transfert` et `Épargne`. Le menu est un panneau inférieur accessible, avec une action par libellé et icône cohérente. Réglages est accessible depuis Comptes.

Toutes les cibles tactiles font au moins 48 dp, la navigation respecte les insets système et le retour Android, et l’ouverture du clavier ne masque pas le contenu utile.

## Transactions

Une ligne est immédiatement lisible :

`icône · nom · catégorie/date · montant`

Le nom domine, la catégorie et la date sont secondaires, le montant est aligné et tabulaire. Une dépense normale n’est pas rouge ; le négatif est réservé à une information demandant une décision.

## Responsive et accessibilité

- Téléphone : marge latérale 16 dp, une colonne, navigation inférieure.
- Tablette : passage progressif à deux colonnes lorsque l’espace le permet.
- Contraste vérifié en clair et sombre, sans dépendre de la couleur seule.
- États de chargement, vide, erreur, succès, focus et désactivation explicites.
- Respect de la taille de texte système et de la réduction des animations.

## À éviter

Gradients flashy, glassmorphism, néons, ombres lourdes, bordures épaisses, rouge sur chaque dépense, couleurs différentes par catégorie, cinq boutons permanents, dashboards saturés et gamification excessive.

## Règle fondamentale

Chaque élément doit aider l’utilisateur à mieux comprendre ou contrôler son argent. Sinon, il doit être simplifié, déplacé ou supprimé.
