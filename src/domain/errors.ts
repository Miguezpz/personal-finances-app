/**
 * Domain errors (contracts/domain-engine.ts). Thrown by the pure engine in src/domain.
 * Messages are developer-facing; the UI maps the error class to a translated message.
 */

abstract class DomainError extends Error {
  protected constructor(name: string, message: string) {
    super(message);
    this.name = name;
  }
}

/** Weights (bps) that don't sum to 10000, are out of range, or a negative total to split. */
export class InvalidWeightsError extends DomainError {
  constructor(message: string) {
    super("InvalidWeightsError", message);
  }
}

/** No distribution rule is in effect for the date of an income that must be split. */
export class RuleNotConfiguredError extends DomainError {
  constructor(message = "No distribution rule is configured for this date") {
    super("RuleNotConfiguredError", message);
  }
}

/** A money value that is not a safe integer number of cents (e.g. a float). */
export class InvalidMoneyError extends DomainError {
  constructor(message: string) {
    super("InvalidMoneyError", message);
  }
}

/** A malformed IsoDate / PeriodKey or an impossible calendar date. */
export class InvalidDateError extends DomainError {
  constructor(message: string) {
    super("InvalidDateError", message);
  }
}
