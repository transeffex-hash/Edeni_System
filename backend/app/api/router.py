from fastapi import APIRouter

from backend.app.api.routes import auth, users, inventory, sales, ledger, notifications, admin, reports, public, branches, customers

api_router = APIRouter(prefix="/api")

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(sales.router, prefix="/sales", tags=["sales"])
api_router.include_router(ledger.router, prefix="/ledger", tags=["ledger"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(public.router, prefix="/public", tags=["public"])
api_router.include_router(branches.router, prefix="/branches", tags=["branches"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
