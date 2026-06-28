"""
migrate_product_schema.py — ONE-TIME migration for Task 18 / Sprint-A Fix #4
=============================================================================
Fixes existing DB documents that were written through the unvalidated
admin_create_product / admin_update_product endpoints before Task 18.

PROBLEMS this fixes
  1. price stored as float rupees (e.g. 49.0) with no price_paise
     → create_order_core now reads price_paise; these products still produce ₹0 orders
  2. image stored instead of image_url
     → API reads now return image_url; these products would have no image in the app
  3. offer_price / offerPrice stored instead of mrp_paise

DO NOT RUN without reviewing the dry-run output first.

Usage
  # Dry run (prints what would change, touches nothing):
  DRY_RUN=1 python migrate_product_schema.py

  # Live run (writes to DB):
  python migrate_product_schema.py
"""

import asyncio
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

DRY_RUN = os.environ.get("DRY_RUN", "0") == "1"

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


def _to_paise(val) -> int | None:
    """Convert a rupee float/int to paise int."""
    try:
        return int(float(val) * 100) if val is not None else None
    except (ValueError, TypeError):
        return None


async def migrate():
    products = await db.products.find({}).to_list(100_000)
    needs_fix = []

    for p in products:
        pid = p.get("id", str(p.get("_id")))
        updates = {}
        unsets = {}

        # ── 1. price → price_paise ──────────────────────────────────────────
        if "price_paise" not in p and "price" in p:
            paise = _to_paise(p["price"])
            if paise is not None:
                updates["price_paise"] = paise
                unsets["price"] = ""
                print(f"[price]     {pid}  {p.get('name','?')!r:40s}  "
                      f"price={p['price']} → price_paise={paise}")

        # ── 2. image → image_url ────────────────────────────────────────────
        if "image_url" not in p and "image" in p:
            updates["image_url"] = p["image"]
            unsets["image"] = ""
            print(f"[image]     {pid}  {p.get('name','?')!r:40s}  "
                  f"image → image_url='{p['image'][:60]}'")
        elif "image_url" in p and "image" in p:
            # Both present — drop the stale alias
            unsets["image"] = ""
            print(f"[dup-image] {pid}  {p.get('name','?')!r:40s}  "
                  f"dropping duplicate 'image' key")

        # ── 3. offer_price / offerPrice → mrp_paise ─────────────────────────
        for legacy_key in ("offer_price", "offerPrice", "original_price"):
            if "mrp_paise" not in p and legacy_key in p:
                paise = _to_paise(p[legacy_key])
                if paise is not None:
                    updates["mrp_paise"] = paise
                    unsets[legacy_key] = ""
                    print(f"[mrp]       {pid}  {p.get('name','?')!r:40s}  "
                          f"{legacy_key}={p[legacy_key]} → mrp_paise={paise}")
                break

        if updates or unsets:
            needs_fix.append((pid, p.get("name"), updates, unsets))

    print(f"\n{'DRY RUN — ' if DRY_RUN else ''}Found {len(needs_fix)} products needing migration "
          f"out of {len(products)} total.\n")

    if not needs_fix:
        print("Nothing to do — all products already use canonical schema.")
        return

    if DRY_RUN:
        print("DRY_RUN=1  — no writes performed.")
        return

    confirm = input(f"Apply {len(needs_fix)} updates to '{os.environ['DB_NAME']}'? [yes/no]: ")
    if confirm.strip().lower() != "yes":
        print("Aborted.")
        return

    fixed = 0
    for pid, name, updates, unsets in needs_fix:
        op = {}
        if updates:
            op["$set"] = updates
        if unsets:
            op["$unset"] = unsets
        result = await db.products.update_one({"id": pid}, op)
        if result.modified_count:
            fixed += 1

    print(f"\nMigration complete — {fixed}/{len(needs_fix)} documents updated.")


if __name__ == "__main__":
    asyncio.run(migrate())
