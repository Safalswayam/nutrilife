"""
Telegram Notifier — NutriLife Admin Alerts
==========================================
Sends automatic notifications to the @NUTRILIFEDIET admin channel
whenever a user registers (email or Google OAuth).

Setup:
1. Add your bot as Admin to @NUTRILIFEDIET channel with Post Messages permission
2. Set TELEGRAM_BOT_TOKEN in your .env file
3. Set TELEGRAM_CHAT_ID in your .env file (use @NUTRILIFEDIET or the numeric chat ID)
"""

import os
import threading
import urllib.request
import urllib.parse
import json
from html import escape
from datetime import datetime


def _get_telegram_config():
    """Read Telegram config lazily so env load order never breaks notifier."""
    bot_token = (os.getenv("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (os.getenv("TELEGRAM_CHAT_ID") or "").strip()
    return bot_token, chat_id


# ── Core sender (runs in background thread so it never slows down the API) ────
def _send(text: str) -> None:
    """Internal: POST message to Telegram. Called in a daemon thread."""
    try:
        bot_token, chat_id = _get_telegram_config()
        if not bot_token or not chat_id:
            print("[Telegram] Skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing")
            return

        base_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = json.dumps({
            "chat_id": chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }).encode("utf-8")

        req = urllib.request.Request(
            base_url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=8) as resp:
            result = json.loads(resp.read())
            if not result.get("ok"):
                print(f"[Telegram] API error: {result}")
            else:
                print(f"[Telegram] Notification sent ✓")

    except Exception as e:
        # Never crash the main app — just log
        print(f"[Telegram] Failed to send notification: {e}")


def send_async(text: str) -> None:
    """Send a Telegram message in a background thread (non-blocking)."""
    t = threading.Thread(target=_send, args=(text,), daemon=True)
    t.start()


# ── Notification templates ────────────────────────────────────────────────────

def notify_new_user_email(user_id: int, name: str, email: str, gender: str = None,
                           age: int = None, ip: str = None) -> None:
    """Called when a user registers with email + password."""
    now = datetime.now().strftime("%d %b %Y, %I:%M %p")

    lines = [
        "🆕 <b>New User Registered</b>",
        "━━━━━━━━━━━━━━━━━━",
        f"👤 <b>Name:</b> {escape(str(name))}",
        f"📧 <b>Email:</b> {escape(str(email))}",
        f"🔐 <b>Method:</b> Email & Password",
        f"🆔 <b>User ID:</b> #{user_id}",
    ]

    if gender:
        lines.append(f"⚧️ <b>Gender:</b> {escape(gender.capitalize())}")
    if age:
        lines.append(f"🎂 <b>Age:</b> {age}")
    if ip:
        lines.append(f"🌐 <b>IP:</b> {escape(str(ip))}")

    lines += [
        f"🕐 <b>Time:</b> {now} IST",
        "━━━━━━━━━━━━━━━━━━",
        "📊 <i>NutriLife Admin Panel</i>",
    ]

    send_async("\n".join(lines))


def notify_new_user_google(user_id: int, name: str, email: str,
                            profile_image: str = None, ip: str = None) -> None:
    """Called when a user registers via Google OAuth."""
    now = datetime.now().strftime("%d %b %Y, %I:%M %p")

    lines = [
        "🆕 <b>New User Registered</b>",
        "━━━━━━━━━━━━━━━━━━",
        f"👤 <b>Name:</b> {escape(str(name))}",
        f"📧 <b>Email:</b> {escape(str(email))}",
        f"🔑 <b>Method:</b> Google OAuth",
        f"🆔 <b>User ID:</b> #{user_id}",
    ]

    if ip:
        lines.append(f"🌐 <b>IP:</b> {escape(str(ip))}")

    lines += [
        f"🕐 <b>Time:</b> {now} IST",
        "━━━━━━━━━━━━━━━━━━",
        "📊 <i>NutriLife Admin Panel</i>",
    ]

    send_async("\n".join(lines))


def notify_new_subscription(user_id: int, name: str, email: str,
                             plan: str, amount: float, transaction_id: str) -> None:
    """Called when a user subscribes to a premium plan."""
    now = datetime.now().strftime("%d %b %Y, %I:%M %p")

    lines = [
        "💳 <b>New Subscription!</b>",
        "━━━━━━━━━━━━━━━━━━",
        f"👤 <b>Name:</b> {escape(str(name))}",
        f"📧 <b>Email:</b> {escape(str(email))}",
        f"🆔 <b>User ID:</b> #{user_id}",
        f"📦 <b>Plan:</b> {escape(str(plan))}",
        f"💰 <b>Amount:</b> ₹{amount}",
        f"🧾 <b>Transaction:</b> {escape(str(transaction_id))}",
        f"🕐 <b>Time:</b> {now} IST",
        "━━━━━━━━━━━━━━━━━━",
        "📊 <i>NutriLife Admin Panel</i>",
    ]

    send_async("\n".join(lines))


def notify_feedback(content: str, name: str = "Anonymous", email: str = "Not provided") -> None:
    """Called when someone submits the feedback widget."""
    now = datetime.now().strftime("%d %b %Y, %I:%M %p")

    lines = [
        "💬 <b>New Feedback Received!</b>",
        "━━━━━━━━━━━━━━━━━━",
        f"👤 <b>From:</b> {escape(str(name))}",
        f"📧 <b>Email:</b> {escape(str(email))}",
        "",
        f"📝 <b>Message:</b>",
        f"<i>{escape(str(content))}</i>",
        "",
        f"🕐 <b>Time:</b> {now} IST",
        "━━━━━━━━━━━━━━━━━━",
        "📊 <i>NutriLife Admin Panel</i>",
    ]

    send_async("\n".join(lines))


def notify_server_start() -> None:
    """Called once when the FastAPI server starts."""
    now = datetime.now().strftime("%d %b %Y, %I:%M %p")
    text = (
        "✅ <b>NutriLife Server Started</b>\n"
        "━━━━━━━━━━━━━━━━━━\n"
        f"🕐 <b>Time:</b> {now} IST\n"
        "🚀 API is live and accepting requests\n"
        "━━━━━━━━━━━━━━━━━━\n"
        "📊 <i>NutriLife Admin Panel</i>"
    )
    send_async(text)
