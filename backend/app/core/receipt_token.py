import hashlib
import hmac

from backend.app.core.config import settings

# Public receipt links are stateless: "<sale_id>.<signature>".
# The signature is an HMAC over the sale id using the server secret, so a link
# can't be guessed or forged, and receipts stay reachable indefinitely
# (customers may open them days later).


def _sign(sale_id: int) -> str:
    msg = f"receipt:{sale_id}".encode()
    return hmac.new(settings.jwt_secret.encode(), msg, hashlib.sha256).hexdigest()[:32]


def make_receipt_token(sale_id: int) -> str:
    return f"{sale_id}.{_sign(sale_id)}"


def parse_receipt_token(token: str) -> int | None:
    try:
        sid_str, sig = token.split(".", 1)
        sale_id = int(sid_str)
    except (ValueError, AttributeError):
        return None
    if not hmac.compare_digest(sig, _sign(sale_id)):
        return None
    return sale_id
