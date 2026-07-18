"""Thin Redis JSON cache. Degrades to a no-op when Redis is unreachable."""
import os
import json
import hashlib

try:
    import redis as _redis_lib
except ImportError:
    _redis_lib = None

REDIS_URL = (os.getenv("REDIS_URL") or "redis://localhost:6379/0").strip()

_client = None
_checked = False


def _get_client():
    global _client, _checked
    if _checked:
        return _client
    _checked = True
    if _redis_lib is None:
        print("⚠ redis package not installed — caching disabled")
        return None
    try:
        c = _redis_lib.Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        c.ping()
        _client = c
        print(f"✓ Redis cache connected ({REDIS_URL.split('@')[-1]})")
    except Exception as e:
        print(f"⚠ Redis unavailable ({e}) — caching disabled")
        _client = None
    return _client


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
        return None


def cache_set(key: str, value, ttl_seconds: int):
    c = _get_client()
    if not c:
        return
    try:
        c.setex(key, ttl_seconds, json.dumps(value, default=str))
    except Exception as e:
        print(f"cache set error ({key}): {e}")


def cache_delete(*keys):
    c = _get_client()
    if not c or not keys:
        return
    try:
        c.delete(*keys)
    except Exception as e:
        print(f"cache delete error: {e}")


def dashboard_key(user_id, day) -> str:
    return f"nutrilife:dash:{user_id}:{day}"


def invalidate_dashboard(user_id):
    """Writes only affect today's dashboard aggregate."""
    from datetime import date
    cache_delete(dashboard_key(user_id, date.today()))
