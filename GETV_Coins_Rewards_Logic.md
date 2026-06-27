# GETV Coins — Rewards Logic Specification

**Product:** GrocerEase App  
**Version:** v1.0  
**Last Updated:** June 28, 2026

---

## Overview

GETV Coins is a loyalty rewards currency within the GrocerEase ecosystem. Coins are credited monthly based on cable TV and broadband bill registrations, activated upon completing those recharges, and redeemable across product categories once the user hits defined monthly spending tiers.

**1 GETV Coin = ₹1**

---

## 1. Monthly Credit

Every calendar month, **1,000 GETV coins** are credited to a user's wallet, provided:
- The user has registered their cable TV bill and broadband bill with GrocerEase.

Coins are credited automatically at the start of each month after registration.

---

## 2. Activation Condition

Credited coins remain **inactive** until the user completes both recharges for that month:

| Recharge Type | Example Spend |
|---|---|
| Cable TV (HDTV) recharge | ₹400 |
| Broadband billing | ₹600 |
| **Total required** | **Both recharges must be completed** |

Once both recharges are done, all 1,000 credited coins are **activated** and available in the wallet for potential redemption.

> The split between cable and broadband can vary — what matters is that **both recharges are completed** in the month.

---

## 3. Redemption Tiers

Activated coins can only be **spent** once the user crosses a monthly spending threshold within the GrocerEase app ecosystem. Spending is cumulative across all product categories within a calendar month.

| Monthly Spend (GrocerEase App) | GETV Coins Redeemable |
|---|---|
| ≥ ₹7,000 | 250 GETV coins |
| ≥ ₹13,000 | 500 GETV coins |
| ≥ ₹25,000 | 1,000 GETV coins |

- Spending can be **across different product categories** and at **different intervals** within the same calendar month.
- The user unlocks the corresponding coin limit once their cumulative spend crosses the tier threshold.
- Tiers are **not cumulative** — crossing ₹13,000 means the user can redeem up to 500 coins total, not 250 + 500.

---

## 4. Six-Month High-Spend Bonus

Users who spend **₹70,000 or more within 6 months from the date of their first purchase** on GrocerEase will receive an **electronic gadget worth up to ₹2,000** as a reward.

- The 6-month window starts from the user's **first purchase date** — it is a fixed window, not rolling.
- Total spend is cumulative across all product categories within this window.

---

## 5. Auto-Credit Suspension Rule

If a user **does not complete their cable TV and/or broadband recharges for 2 consecutive months**, the automatic monthly credit of 1,000 GETV coins to that user's account is **suspended**.

- Credit automatically resumes the month after the user actively recharges again.
- Any previously credited and activated coins in the wallet are unaffected by suspension.

---

## Summary Flow

```
Register Cable TV + Broadband Bills
        ↓
1,000 GETV coins credited to wallet (every month)
        ↓
Complete monthly Cable TV + Broadband recharges
        ↓
Coins ACTIVATED in wallet
        ↓
Spend within GrocerEase app ecosystem
        ↓
Reach spending tier → Redeem coins

  ₹7,000 spent  → redeem up to 250 coins
  ₹13,000 spent → redeem up to 500 coins
  ₹25,000 spent → redeem up to 1,000 coins

Bonus: ₹70,000 within 6 months of first purchase → gadget worth up to ₹2,000
```

---

## Edge Cases & Rules Summary

| Scenario | Outcome |
|---|---|
| User registered but didn't recharge this month | Coins credited but remain inactive; cannot be redeemed |
| User recharges but doesn't hit ₹7,000 spend | Coins activated but no redemption allowed |
| User hits ₹25,000 spend but coins inactive | Cannot redeem until both recharges are completed |
| 2 consecutive months with no recharges | Auto-credit suspended |
| User resumes recharging after suspension | Auto-credit resumes from next month automatically |
| User spends ₹70,000 after the 6-month window closes | Not eligible for gadget bonus |
