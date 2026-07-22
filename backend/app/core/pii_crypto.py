import base64
import hashlib
import hmac
import os
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from backend.app.core.config import settings


def _derive_aes_key() -> bytes:
    """Derive a 32-byte AES key from the configured secret.

    Why derivation?
    - We want to accept a human-provided secret (env var / secret manager)
    - AESGCM requires exactly 16/24/32 bytes. We standardize on 32.

    Implementation detail:
    - We use SHA-256 on the UTF-8 bytes of the secret.
    - For higher-security deployments you could swap this for a KDF (HKDF/scrypt).
    """

    secret = settings.pii_encryption_key.encode("utf-8")
    return hashlib.sha256(secret).digest()


def _hmac_key() -> bytes:
    """Returns a bytes key used for HMAC hashing of PII.

    HMAC hashes are useful for:
    - Lookup (e.g. login by email)
    - Uniqueness constraints (unique email per system)

    We *do not* store plaintext PII in the DB, and we avoid needing to decrypt to compare.
    """

    return settings.pii_hmac_key.encode("utf-8")


def pii_hash(value: str) -> str:
    """Create a deterministic, non-reversible hash for a PII value.

    Notes:
    - This is used for equality matches (WHERE email_hash = ...)
    - This is not encryption and cannot be reversed.
    - We normalize by stripping and lowercasing.
    """

    normalized = value.strip().lower().encode("utf-8")
    digest = hmac.new(_hmac_key(), normalized, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii")


def pii_encrypt(value: Optional[str]) -> Optional[str]:
    """Encrypt a PII field with AES-GCM.

    Returns a string that contains:
    - nonce (12 bytes)
    - ciphertext+tag

    The output is URL-safe base64 so it can be stored in a String column.
    """

    if value is None:
        return None

    plaintext = value.encode("utf-8")
    key = _derive_aes_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data=None)
    packed = nonce + ciphertext
    return base64.urlsafe_b64encode(packed).decode("ascii")


def pii_decrypt(value: Optional[str]) -> Optional[str]:
    """Decrypt a PII field stored by `pii_encrypt`."""

    if value is None:
        return None

    packed = base64.urlsafe_b64decode(value.encode("ascii"))
    nonce = packed[:12]
    ciphertext = packed[12:]

    key = _derive_aes_key()
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, associated_data=None)
    return plaintext.decode("utf-8")
