// Domain errors carry a stable `code` so the conversation layer can turn them
// into the right reply ("that time was just taken") instead of a generic failure.

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super('invalid_input', message);
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string, id: string) {
    super('not_found', `${what} ${id} was not found`);
  }
}

export class SlotUnavailableError extends DomainError {
  constructor(slotId: string) {
    super('slot_unavailable', `Slot ${slotId} is no longer available`);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super('conflict', message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string) {
    super('forbidden', message);
  }
}
