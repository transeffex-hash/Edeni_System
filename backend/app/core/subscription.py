from datetime import date, timedelta

from backend.app.models.entities import Business

# Days after subscription_end_date during which the business can still log in
# and sees a renewal warning. After this, access is blocked until the admin extends.
GRACE_DAYS = 7


def subscription_status(business: Business, today: date | None = None) -> tuple[str, int | None]:
    """Return (status, days) where status is one of:
    - "active":  no end date set, or end date is in the future (days = days left)
    - "grace":   end date passed but within GRACE_DAYS (days = grace days left)
    - "expired": end date passed and grace period over (days = None)
    """
    today = today or date.today()
    end = business.subscription_end_date
    if end is None or end >= today:
        return "active", ((end - today).days if end else None)
    grace_end = end + timedelta(days=GRACE_DAYS)
    if today <= grace_end:
        return "grace", (grace_end - today).days
    return "expired", None


def is_subscription_blocked(business: Business) -> bool:
    return subscription_status(business)[0] == "expired"
