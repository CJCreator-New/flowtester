import { isCheckRoute, matchRoute, PATHS } from './router';

/**
 * Where the runner's phase puts the person, when they're on one of the check-up's addresses.
 * `popped`: the address was reached by Back or Forward; a finished check-up's address would only
 * bounce to the report, so that goes to the new check-up instead. Otherwise 'done' stays put.
 * Back or Forward onto another step of a running check-up does not snap forward either: it goes to
 * the new check-up, where the Resume card waits.
 */
export function addressForPhase(phase: string | undefined, pathname: string, popped = false): string | null {
  if (!isCheckRoute(matchRoute(pathname))) return null;
  const own = (address: string) => (popped && address !== pathname ? PATHS.new : address);
  switch (phase) {
    case 'scanning':
      return own(PATHS.scan);
    case 'awaiting-review':
      return own(PATHS.plan);
    case 'testing':
      return own(PATHS.testing);
    case 'done':
      // PATHS.new is not a check address, so replacing to it cannot loop; Forward onto it is left alone.
      return popped ? PATHS.new : null;
    default:
      return null;
  }
}
