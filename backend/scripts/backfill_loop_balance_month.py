#!/usr/bin/env python3
"""
Sprint A.5 Fix 1 — One-time backfill: loop_balance_month for existing users.

Purpose:
  Users with loop_balance_paise > 0 but no loop_balance_month field were
  created before this patch. The new burn_loop_coins() filter reads
  loop_balance_month; without it those users are invisible to the burn job.

Strategy:
  Set loop_balance_month to loop_last_bill_month if available (month of the
  user's last known credit). Fallback: current calendar month (safe choice;
  coins survive until the next genuine month-end rather than being immediately
  wiped because we don't know their true credit month).

Idempotent: running twice writes the same value — no harm.
Dry-run:    default mode. Use --apply to write to DB.

Usage:
  DRY RUN:  python3 backfill_loop_balance_month.py
  APPLY:    python3 backfill_loop_balance_month.py --apply
  CONFIRM:  db.users.countDocuments({loop_balance_paise:{$gt:0}, loop_balance_month:{$exists:false}})
  Expected after apply: 0
"""
import os
import sys
import asyncio
import argparse
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from database import db


async def backfill_loop_balance_month(dry_run: bool = True) -> dict:
    now = datetime.utcnow()
    # Fallback: current calendar month (NOT a past date).
    # Coins tagged with current month survive until the real month-end,
    # preventing accidental wipe of valid balances whose true month is unknown.
    default_month = now.strftime("%Y-%m")  # e.g. "2026-06"

    cursor = db.users.find(
        {
            "loop_balance_paise": {"$gt": 0},
            "loop_balance_month": {"$exists": False},
        },
        {"_id": 1, "id": 1, "loop_last_bill_month": 1, "loop_balance_paise": 1},
    )

    matched = 0
    modified = 0
    updates = []

    async for user in cursor:
        matched += 1
        last_bill = user.get("loop_last_bill_month")
        target_month = last_bill if last_bill else default_month

        if dry_run:
            print(
                f"[DRY] user_id={user.get('id', user['_id'])}  "
                f"lbp={user['loop_balance_paise']}  "
                f"loop_last_bill_month={last_bill!r}  "
                f"-> set loop_balance_month={target_month!r}"
            )
        else:
            updates.append(
                db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"loop_balance_month": target_month}},
                )
            )
            # Flush in batches of 100
            if len(updates) >= 100:
                results = await asyncio.gather(*updates)
                modified += sum(r.modified_count for r in results)
                updates = []

    # Flush remaining
    if updates and not dry_run:
        results = await asyncio.gather(*updates)
        modified += sum(r.modified_count for r in results)

    summary = {"matched": matched, "modified": modified, "dry_run": dry_run}
    print(
        f"\n[SUMMARY] matched={matched}  modified={modified}  "
        f"dry_run={dry_run}  fallback_month={default_month}"
    )
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Backfill loop_balance_month for users missing the field."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Write changes to DB (default is dry-run)",
    )
    args = parser.parse_args()
    dry_run = not args.apply
    if not dry_run:
        print("[APPLY mode] Writing to database...")
    else:
        print("[DRY RUN mode] No changes will be written.")
    asyncio.run(backfill_loop_balance_month(dry_run=dry_run))
