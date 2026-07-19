"""Thin Redis JSON cache. Degrades to a no-op when Redis is unreachable."""
import os
import json
import time
import hashlib

try:
    import redis as _redis_lib
except ImportError:
    _redis_lib = None

REDIS_URL = (os.getenv("REDIS_URL") or "redis://localhost:6379/0").strip()

# Seconds to wait before re-attempting a failed connection. Without this the
# first transient failure (Redis still booting, brief network blip) would
# disable caching for the whole life of the process.
_RETRY_COOLDOWN_SECONDS = 30

_client = None
_last_attempt = 0.0
_warned = False


def _get_client():
    global _client, _last_attempt, _warned
    if _client is not None:
        return _client
    if _redis_lib is None:
        if not _warned:
            _warned = True
            print("redis package not installed - caching disabled")
        return None
    # Back off between attempts so a hard-down Redis doesn't add a connect
    # timeout to every single request.
    now = time.monotonic()
    if _last_attempt and (now - _last_attempt) < _RETRY_COOLDOWN_SECONDS:
        return None
    _last_attempt = now
    try:
        c = _redis_lib.Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        c.ping()
        _client = c
        _warned = False
        print(f"Redis cache connected ({REDIS_URL.split('@')[-1]})")
    except Exception as e:
        _client = None
        if not _warned:
            _warned = True
            print(f"Redis unavailable ({e}) - caching disabled, retrying every {_RETRY_COOLDOWN_SECONDS}s")
    return _client


def _drop_client():
    """Force a reconnect on the next call after an operational error."""
    global _client
    _client = None


def make_key(prefix: str, *parts) -> str:
    digest = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:32]
    return f"nutrilife:{prefix}:{digest}"


def cache_get(key: str):
    c = _get_client()
    if not c:
        return None
    try:
        raw = c.get(key)
        if raw is None:
            return None
        print(f"cache HIT {key}")
        return json.loads(raw)
    except Exception as e:
        print(f"cache get error ({key}): {e}")
        _drop_client()
        return None


def cache_set(key: str, value, ttl_seconds: int):
    c = _get_client()
    if not c:
        return
    try:
        c.setex(key, ttl_seconds, json.dumps(value, default=str))
    except Exception as e:
        print(f"cache set error ({key}): {e}")
        _drop_client()


def cache_delete(*keys):
    c = _get_client()
    if not c or not keys:
        return
    try:
        c.delete(*keys)
    except Exception as e:
        print(f"cache delete error: {e}")
        _drop_client()


# ── Dashboard cache ────────────────────────────────────────────────────────
# Keys carry a per-user version stamp. Invalidation bumps the version rather
# than deleting the key, so a slow in-flight read that computed the old
# version writes to a key nobody will read again (it just expires) instead of
# resurrecting stale data after the delete. Without this, a dashboard read
# that started before a meal-log write could re-cache pre-write totals for
# the full TTL.

def _dash_version_key(user_id) -> str:
    return f"nutrilife:dashver:{user_id}"


def _dash_version(user_id) -> str:
    c = _get_client()
    if not c:
        return "0"
    try:
        return c.get(_dash_version_key(user_id)) or "0"
    except Exception as e:
        print(f"cache version read error: {e}")
        _drop_client()
        return "0"


def dashboard_key(user_id, day) -> str:
    return f"nutrilife:dash:{user_id}:{day}:v{_dash_version(user_id)}"


def invalidate_dashboard(user_id):
    """Bump the user's dashboard version so cached entries stop being read."""
    c = _get_client()
    if not c:
        return
    try:
        c.incr(_dash_version_key(user_id))
    except Exception as e:
        print(f"cache invalidate error: {e}")
        _drop_client()
