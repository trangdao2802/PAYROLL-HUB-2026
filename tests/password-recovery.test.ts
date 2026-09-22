import test from 'node:test';
import assert from 'node:assert/strict';
import { isPasswordRecoveryUrl } from '../src/lib/password-recovery';

test('recovery callback and reload destination open the password form', () => {
  assert.equal(isPasswordRecoveryUrl('https://example.com/#access_token=test&type=recovery'), true);
  assert.equal(isPasswordRecoveryUrl('https://example.com/?reset-password=1'), true);
  assert.equal(isPasswordRecoveryUrl('https://example.com/#error_code=otp_expired'), true);
});
test('ordinary navigation and ordinary sign in retain the app', () => {
  assert.equal(isPasswordRecoveryUrl('https://example.com/'), false);
  assert.equal(isPasswordRecoveryUrl('https://example.com/#type=signup&access_token=test'), false);
});
