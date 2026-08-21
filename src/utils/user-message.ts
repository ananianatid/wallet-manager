export const ErrorCodes = {
  DB_OPEN_FAILED: "DB_OPEN_FAILED",
  RATE_UNAVAILABLE: "RATE_UNAVAILABLE",
  BACKUP_INVALID: "BACKUP_INVALID",
  BACKUP_CORRUPT: "BACKUP_CORRUPT",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export function errorWithCode(code: ErrorCode, message: string): Error {
  const error = new Error(message);
  error.name = "CodedError";
  (error as Error & { code: string }).code = code;
  return error;
}

export const GENERIC_MESSAGE = "Une erreur est survenue. Réessayez.";
const INTERNAL_MESSAGE = "Une erreur interne est survenue. Vos données sont intactes. Réessayez.";
const CONNECTIVITY_MESSAGE = "Impossible de joindre le service. Vérifiez votre connexion internet.";
const RETRY_LATER_MESSAGE = "Ce service ne répond pas pour le moment. Réessayez plus tard.";

const SQLITE_PATTERNS = [
  /^SQLITE/i,
  /no such table/i,
  /no such column/i,
  /foreign key constraint/i,
  /constraint failed/i,
  /not unique/i,
  /database is locked/i,
  /cannot alter table/i,
];

const NETWORK_PATTERNS = [
  /network request failed/i,
  /failed to fetch/i,
  /fetch failed/i,
  /timeout/i,
  /aborted/i,
];

const USER_FACING_PATTERNS = [
  /^Le nom (?:du compte|du groupe|de la catégorie|de l'objectif) ne peut pas être vide\.$/i,
  /^(?:Une catégorie|Un groupe) .*porte déjà ce nom\.$/i,
  /^(?:Compte|Catégorie|Objectif|Groupe de comptes) introuvable(?: après création)?\.$/i,
  /^(?:Le|La|Les|Un|Une) (?:montant|date|frais|taux|pourcentage|limite|intervalle|catégorie|compte|solde|nom)\b.*\.$/i,
  /^(?:Une catégorie est requise|Un compte de destination est requis|Le compte de destination doit|Le compte de transfert est introuvable)\b.*\.$/i,
  /^(?:Cet objectif est clôturé|Libérez d'abord les réservations|Saisissez le total débité|Solde disponible insuffisant)\b.*\.?$/i,
  /^L'import attend la devise de référence\b.*\.$/i,
];

/**
 * Exposes the technical details needed to diagnose a local failure.
 * Keep this out of normal user-facing flows; it is intentionally verbose.
 */
export function technicalErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message || error.name || "Erreur inconnue";
    const details = error.name && error.name !== "Error"
      ? `${error.name}: ${message}`
      : message;
    const cause = (error as Error & { cause?: unknown }).cause;
    return cause == null
      ? details
      : `${details}\nCause : ${technicalErrorMessage(cause)}`;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : String(error);
  } catch {
    return String(error);
  }
}

function codeMessage(code: string): string | null {
  switch (code) {
    case ErrorCodes.DB_OPEN_FAILED:
      return "La base de données n'a pas pu être ouverte. Réessayez.";
    case ErrorCodes.RATE_UNAVAILABLE:
      return RETRY_LATER_MESSAGE;
    case ErrorCodes.BACKUP_INVALID:
      return "Ce fichier n'est pas une sauvegarde valide de Wallet.";
    case ErrorCodes.BACKUP_CORRUPT:
      return "Cette sauvegarde est corrompue ou a été modifiée.";
    default:
      return null;
  }
}

export function userMessage(error: unknown, fallback = GENERIC_MESSAGE): string {
  if (error === null || error === undefined) {
    return fallback;
  }
  if (typeof error === "string") {
    return fallback;
  }
  if (!(error instanceof Error)) {
    return fallback;
  }
  const code = (error as Error & { code?: string }).code;
  if (code) {
    const mapped = codeMessage(code);
    if (mapped) {
      return mapped;
    }
  }
  if ((error as Error & { userFacing?: boolean }).userFacing) {
    return error.message;
  }
  const message = error.message ?? "";
  if (SQLITE_PATTERNS.some((pattern) => pattern.test(message))) {
    return INTERNAL_MESSAGE;
  }
  if (NETWORK_PATTERNS.some((pattern) => pattern.test(message))) {
    return CONNECTIVITY_MESSAGE;
  }
  if (/^Frankfurter a répondu/i.test(message)) {
    return RETRY_LATER_MESSAGE;
  }
  if (USER_FACING_PATTERNS.some((pattern) => pattern.test(message))) {
    return message;
  }
  return fallback;
}
