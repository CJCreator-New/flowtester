import { describe, expect, it } from 'vitest';
import { consentRequestOf, EMPTY_FORM, EMPTY_SIGN_IN, resetSignInChoices } from '../src/lib/form';

describe('review the plan first is the default', () => {
  it('starts ticked, and dropping consent puts it back', () => {
    expect(EMPTY_FORM.reviewFirst).toBe(true);
    expect(resetSignInChoices({ ...EMPTY_FORM, signInConsent: true, reviewFirst: false }).reviewFirst).toBe(true);
  });
  it('consented start with the default does not skip review', () => {
    const form = { ...EMPTY_FORM, signInConsent: true, signIns: [{ ...EMPTY_SIGN_IN, username: 'a', password: 'b' }] };
    expect(consentRequestOf(form, undefined).skipReview).toBe(false);
  });
});
