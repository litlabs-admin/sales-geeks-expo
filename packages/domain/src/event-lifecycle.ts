export type LifecycleState = "pre_event" | "event_day" | "post_event_archive";

const allowedTransitions: Record<LifecycleState, LifecycleState[]> = {
  pre_event: ["event_day"],
  event_day: ["post_event_archive"],
  post_event_archive: []
};

export class InvalidLifecycleTransitionError extends Error {
  readonly code = "INVALID_LIFECYCLE_TRANSITION";

  constructor(from: LifecycleState, to: LifecycleState) {
    super(`Cannot transition event from ${from} to ${to}`);
  }
}

export function canTransition(from: LifecycleState, to: LifecycleState) {
  return allowedTransitions[from].includes(to);
}

export function assertCanTransition(from: LifecycleState, to: LifecycleState) {
  if (!canTransition(from, to)) {
    throw new InvalidLifecycleTransitionError(from, to);
  }
}
