# Firestore Security Specification — Color Stack 3D (International USD + Gold Coins Economy)

## 1. Data Invariants

1. **Global Default-Deny Safety Net**: `match /{document=**} { allow read, write: if false; }` blocks all undeclared paths.
2. **PII Split Isolation (`/users` & `/withdrawRequests` vs `/referralCodes` & `/referrals` & `/globalScores`)**:
   - `/users/{uid}` contains `email` (PII) and is strictly readable ONLY by `isVerifiedUser(uid) || isAdmin()`.
   - `/withdrawRequests/{requestId}` contains `email` and `accountNumber` (RedotPay/Binance Pay ID, TRC20 wallet, or PayPal email) and is strictly readable ONLY by `existing().uid == request.auth.uid || isAdmin()`.
   - Public/relational lookup collections (`/referralCodes/{code}`, `/referrals/{invitedUid}`, `/globalScores/{userId}`) store ZERO PII.
3. **Dual Economy: USD Cents + Gold Coins (`500 Coins = $0.05 USD`)**:
   - All USD wallet amounts are stored in exact integer cents (`5` = `$0.05` daily bonus, `20` = `$0.20` referral bonus).
   - `coins` is an integer (`0 .. 50,000,000`).
   - On `/users/{uid}` `create`, user starts with Day-1 welcome reward (`balance == 5 && coins == 50 && lastDailyRewardAt == request.time`).
   - **24-Hour Daily Sign-In Bonus (`isDailyRewardClaimAction`)**: Owner increments `balance + 5` (`+$0.05`) and `coins + 50` ONLY when `incoming().lastDailyRewardAt == request.time` AND `(!('lastDailyRewardAt' in existing()) || request.time >= existing().lastDailyRewardAt + duration.value(24, 'h'))`.
   - **Gameplay Run Coin Sync (`isGameplayCoinSyncAction`)**: Owner can increment `coins` by `1 .. 250` per completed run without modifying `balance`, `invitesCount`, or immutable identity fields.
   - **Atomic Coin-to-USD Conversion (`isConvertCoinsAction`)**: Owner can exchange multiples of `500` coins into exact integer USD cents (`deltaCoins >= 500`, `deltaCoins % 500 == 0`, `incoming().balance == existing().balance + (deltaCoins / 100)`).
4. **Atomic Signup & Single-Use Referral Credit (`existsAfter` / `getAfter`)**:
   - Crediting a referrer (`invitesCount + 1`, `balance + 20` cents, `coins + 100`) on `/users/{referrerUid}` is ONLY permitted when `!exists(/referrals/$(request.auth.uid))` before the batch AND `existsAfter(/referrals/$(request.auth.uid))` with `referrerUid == uid` after the batch.
5. **Saved Preferred Payout Details (`isSavePayoutPreferencesAction`) & 50-Invite Withdrawal Gate**:
   - Users can save or clear their preferred withdrawal details (`savedPayoutMethod`, `savedPayoutAccount`, `savedPayoutName`) on `/users/{uid}`. All three fields must either be absent together or present together and pass `isValidAccountForProvider(savedPayoutMethod, savedPayoutAccount)` (supporting `RedotPay`, `BinancePay`, `USDT_TRC20`, `PayPal`, `JazzCash`, `Easypaisa`) without mutating `balance`, `coins`, or `invitesCount`.
   - Creating `/withdrawRequests/{requestId}` requires `status == 'pending'`, provider-specific account format validation, `invitesCount >= 50`, `get(/users/$(request.auth.uid)).data.invitesCount >= 50`, `get(/users/$(request.auth.uid)).data.balance == incoming().amount`, AND `getAfter(/users/$(request.auth.uid)).data.balance == 0` in the same atomic batch (optionally updating saved payout details simultaneously).
6. **Bootstrapped Verified Admin & Terminal State Locking**:
   - `isAdmin()` requires `request.auth != null && request.auth.token.email_verified == true && request.auth.token.email == 'bilalshafique1399@gmail.com'`.
   - Only `isAdmin()` can transition `/withdrawRequests/{requestId}.status` to `'approved'` or `'rejected'`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Self-Balance / Coin Minting (`create` `/users/{uid}` with `balance: 10000`, `coins: 999999`)** -> `PERMISSION_DENIED`.
2. **24-Hour Cooldown Bypass (`update` `/users/{uid}` claiming daily `+5` cents & `+50` coins 10 minutes after `lastDailyRewardAt`)** -> `PERMISSION_DENIED`.
3. **Coin-to-USD Exchange Inflation (`update` `/users/{uid}` deducting `500` coins while adding `+500` cents instead of `+5` cents)** -> `PERMISSION_DENIED`.
4. **Excessive Gameplay Coin Injection (`update` `/users/{uid}` adding `+10,000` coins in a single run above the `250` per-run cap)** -> `PERMISSION_DENIED`.
5. **PII Harvesting (`get` or `list` `/users` as non-owner non-admin, exposing email & `savedPayoutAccount`)** -> `PERMISSION_DENIED`.
6. **Unverified Admin Email Spoof (`email == 'bilalshafique1399@gmail.com'`, `email_verified: false`)** -> `PERMISSION_DENIED`.
7. **Arbitrary Referral Credit Injection (`update` `/users/{referrer}` without atomic new-signup `/referrals/{auth.uid}`)** -> `PERMISSION_DENIED`.
8. **Self-Referral Loop (`create` `/referrals/{uid}` with `referrerUid == uid`)** -> `PERMISSION_DENIED`.
9. **Premature International Withdrawal (`create` `/withdrawRequests` when `invitesCount == 12 < 50`)** -> `PERMISSION_DENIED`.
10. **Double-Spend Withdrawal (`create` `/withdrawRequests` without zeroing `/users/{uid}.balance` in same batch)** -> `PERMISSION_DENIED`.
11. **Malformed Saved Payout / `USDT_TRC20` or `JazzCash` Account (`update` `/users/{uid}` or `create` `/withdrawRequests` with invalid provider account format or partial saved fields, or mutating `balance` during payout preference save)** -> `PERMISSION_DENIED`.
12. **Cross-User Withdraw Scraping (`list` `/withdrawRequests` as regular user without `where('uid', '==', auth.uid)`)** -> `PERMISSION_DENIED`.
