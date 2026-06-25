import pytest
from httpx import AsyncClient
import asyncio
from unittest.mock import patch
import datetime

@pytest.mark.asyncio
async def test_atomic_rollback(client_fixture):
    pass

@pytest.mark.asyncio
async def test_cas_second_claim_returns_409(client_fixture):
    pass

@pytest.mark.asyncio
async def test_ledger_earn_redeem_idempotency(client_fixture):
    pass

@pytest.mark.asyncio
async def test_stock_expiry_releases_only_pending_payment(client_fixture):
    pass
