import {
  ErrorCodes,
  errorWithCode,
  GENERIC_MESSAGE,
  technicalErrorMessage,
  userMessage,
} from "./user-message";

describe("userMessage", () => {
  it("renvoie le message générique par défaut", () => {
    expect(userMessage(undefined)).toBe(GENERIC_MESSAGE);
    expect(userMessage(null)).toBe(GENERIC_MESSAGE);
  });

  it("renvoie le message générique pour une chaîne", () => {
    expect(userMessage("raw message")).toBe(GENERIC_MESSAGE);
  });

  it("renvoie le message générique pour une valeur non-Error", () => {
    expect(userMessage({ bizarre: true })).toBe(GENERIC_MESSAGE);
    expect(userMessage(42)).toBe(GENERIC_MESSAGE);
  });

  it("utilise le fallback fourni", () => {
    expect(userMessage("n'importe quoi", "Fallback perso")).toBe("Fallback perso");
    expect(userMessage(undefined, "Fallback perso")).toBe("Fallback perso");
  });

  it("mappe DB_OPEN_FAILED vers un message rassurant", () => {
    const error = errorWithCode(ErrorCodes.DB_OPEN_FAILED, "SQLITE error: open failed");
    expect(userMessage(error)).toBe(
      "La base de données n'a pas pu être ouverte. Réessayez.",
    );
  });

  it("mappe RATE_UNAVAILABLE vers un message de réessai", () => {
    const error = errorWithCode(ErrorCodes.RATE_UNAVAILABLE, "network request failed");
    expect(userMessage(error)).toContain("Réessayez plus tard");
  });

  it("mappe BACKUP_INVALID et BACKUP_CORRUPT", () => {
    expect(userMessage(errorWithCode(ErrorCodes.BACKUP_INVALID, "x"))).toBe(
      "Ce fichier n'est pas une sauvegarde valide de Wallet.",
    );
    expect(userMessage(errorWithCode(ErrorCodes.BACKUP_CORRUPT, "x"))).toBe(
      "Cette sauvegarde est corrompue ou a été modifiée.",
    );
  });

  it("ignore un code inconnu et retombe sur le fallback", () => {
    const error = errorWithCode("UNKNOWN_CODE" as never, "message interne");
    expect(userMessage(error)).toBe(GENERIC_MESSAGE);
  });

  it("préfère le code aux patterns de message", () => {
    const error = errorWithCode(
      ErrorCodes.BACKUP_INVALID,
      "SQLITE error: no such table",
    );
    expect(userMessage(error)).toBe(
      "Ce fichier n'est pas une sauvegarde valide de Wallet.",
    );
  });

  it("affiche tel quel un message marqué userFacing", () => {
    const error = Object.assign(
      new Error("Les deux mots de passe ne correspondent pas."),
      { userFacing: true },
    );
    expect(userMessage(error)).toBe(
      "Les deux mots de passe ne correspondent pas.",
    );
  });

  it("conserve les messages métier connus sans exposer les erreurs inconnues", () => {
    expect(userMessage(new Error("Le nom du compte ne peut pas être vide."))).toBe(
      "Le nom du compte ne peut pas être vide.",
    );
    expect(userMessage(new Error("Solde disponible insuffisant. Disponible : 1 000."))).toBe(
      "Solde disponible insuffisant. Disponible : 1 000.",
    );
    expect(userMessage(new Error("Erreur interne du moteur de calcul"))).toBe(
      GENERIC_MESSAGE,
    );
  });

  it("masque les erreurs SQLite derrière un message interne", () => {
    const error = new Error("SQLITE error: no such table: transactions");
    expect(userMessage(error)).toBe(
      "Une erreur interne est survenue. Vos données sont intactes. Réessayez.",
    );
    expect(userMessage(new Error("no such column: amount"))).toBe(
      "Une erreur interne est survenue. Vos données sont intactes. Réessayez.",
    );
    expect(userMessage(new Error("database is locked"))).toBe(
      "Une erreur interne est survenue. Vos données sont intactes. Réessayez.",
    );
  });

  it("mappe les erreurs réseau vers un message de connectivité", () => {
    expect(userMessage(new Error("Network request failed"))).toBe(
      "Impossible de joindre le service. Vérifiez votre connexion internet.",
    );
    expect(userMessage(new Error("timeout de la requête"))).toBe(
      "Impossible de joindre le service. Vérifiez votre connexion internet.",
    );
  });

  it("mappe une réponse Frankfurter vers un message de réessai", () => {
    const error = new Error("Frankfurter a répondu avec un statut 503");
    expect(userMessage(error)).toBe(
      "Ce service ne répond pas pour le moment. Réessayez plus tard.",
    );
  });

  it("masque les messages techniques inconnus", () => {
    expect(userMessage(new Error("TypeError: Cannot read property 'x' of null"))).toBe(
      GENERIC_MESSAGE,
    );
  });
});

describe("technicalErrorMessage", () => {
  it("conserve le nom, le message et la cause d'une erreur", () => {
    const cause = new Error("file.create: Operation not permitted");
    const error = Object.assign(new TypeError("Unable to write backup"), { cause });

    expect(technicalErrorMessage(error)).toBe(
      "TypeError: Unable to write backup\nCause : file.create: Operation not permitted",
    );
  });

  it("conserve les erreurs qui ne sont pas des instances d'Error", () => {
    expect(technicalErrorMessage("raw export failure")).toBe("raw export failure");
    expect(technicalErrorMessage({ code: "EACCES" })).toBe('{"code":"EACCES"}');
  });
});
