"""
Google OAuth Authentication Service
====================================
Handles Google OAuth 2.0 authentication and user management
"""

import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from google.oauth2 import id_token
from google.auth.transport import requests
import mysql.connector
from fastapi import HTTPException


class GoogleAuthService:
    """Service for Google OAuth authentication"""
    
    def __init__(self, get_db_func, google_client_id: str = None):
        """
        Initialize Google Auth Service
        
        Args:
            get_db_func: Database connection function
            google_client_id: Google OAuth client ID (from environment)
        """
        self.get_db = get_db_func
        self.google_client_id = google_client_id or os.getenv("GOOGLE_CLIENT_ID")
        
        if not self.google_client_id:
            print("Warning: GOOGLE_CLIENT_ID not configured")
    
    def verify_google_token(self, credential: str) -> Dict[str, Any]:
        """
        Verify Google ID token and extract user info
        
        Args:
            credential: Google ID token from frontend
            
        Returns:
            Dict containing user information from Google
            
        Raises:
            HTTPException: If token verification fails
        """
        try:
            # Verify the token
            idinfo = id_token.verify_oauth2_token(
                credential, 
                requests.Request(), 
                self.google_client_id
            )
            
            # Verify the issuer
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise ValueError('Wrong issuer.')
            
            # Extract user information
            return {
                'google_id': idinfo['sub'],
                'email': idinfo['email'],
                'name': idinfo.get('name', ''),
                'picture': idinfo.get('picture'),
                'email_verified': idinfo.get('email_verified', False)
            }
            
        except ValueError as e:
            raise HTTPException(
                status_code=401,
                detail=f"Invalid Google token: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=401,
                detail=f"Google authentication failed: {str(e)}"
            )
    
    def find_user_by_google_id(self, google_id: str) -> Optional[Dict[str, Any]]:
        """
        Find user by Google ID
        
        Args:
            google_id: Google user ID
            
        Returns:
            User dict if found, None otherwise
        """
        conn = self.get_db()
        cur = conn.cursor(dictionary=True)
        
        try:
            cur.execute("""
                SELECT id, email, name, google_id, profile_image, 
                       gender, age, height, weight, activity_level, 
                       metabolism_type, goal, is_premium, 
                       subscription_expires_at, auth_provider
                FROM users
                WHERE google_id = %s
            """, (google_id,))
            
            return cur.fetchone()
            
        finally:
            cur.close()
            conn.close()
    
    def find_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Find user by email
        
        Args:
            email: User email
            
        Returns:
            User dict if found, None otherwise
        """
        conn = self.get_db()
        cur = conn.cursor(dictionary=True)
        
        try:
            cur.execute("""
                SELECT id, email, name, google_id, profile_image,
                       auth_provider
                FROM users
                WHERE email = %s
            """, (email,))
            
            return cur.fetchone()
            
        finally:
            cur.close()
            conn.close()
    
    def create_google_user(self, google_user_info: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create new user from Google authentication
        
        Args:
            google_user_info: User info from Google
            
        Returns:
            Created user dict
        """
        conn = self.get_db()
        cur = conn.cursor(dictionary=True)
        
        try:
            # Generate a random password hash (not used for Google auth)
            random_password = secrets.token_urlsafe(32)
            password_hash = hashlib.sha256(random_password.encode()).hexdigest()
            
            cur.execute("""
                INSERT INTO users 
                (email, password_hash, name, google_id, profile_image, 
                 auth_provider, is_active, created_at)
                VALUES (%s, %s, %s, %s, %s, 'google', TRUE, NOW())
            """, (
                google_user_info['email'],
                password_hash,
                google_user_info['name'],
                google_user_info['google_id'],
                google_user_info.get('picture')
            ))
            
            conn.commit()
            user_id = cur.lastrowid
            
            # Fetch the created user
            cur.execute("""
                SELECT id, email, name, google_id, profile_image,
                       gender, age, height, weight, activity_level,
                       metabolism_type, goal, is_premium,
                       subscription_expires_at, auth_provider
                FROM users
                WHERE id = %s
            """, (user_id,))
            
            return cur.fetchone()
            
        finally:
            cur.close()
            conn.close()
    
    def link_google_account(self, user_id: int, google_user_info: Dict[str, Any]) -> bool:
        """
        Link Google account to existing user
        
        Args:
            user_id: Existing user ID
            google_user_info: Google user information
            
        Returns:
            Boolean indicating success
        """
        conn = self.get_db()
        cur = conn.cursor()
        
        try:
            cur.execute("""
                UPDATE users
                SET google_id = %s,
                    profile_image = COALESCE(profile_image, %s),
                    auth_provider = 'google',
                    updated_at = NOW()
                WHERE id = %s
            """, (
                google_user_info['google_id'],
                google_user_info.get('picture'),
                user_id
            ))
            
            conn.commit()
            return cur.rowcount > 0
            
        finally:
            cur.close()
            conn.close()
    
    def generate_session_token(self, user_id: int, ip_address: str = None, 
                               user_agent: str = None) -> str:
        """
        Generate session token for authenticated user
        
        Args:
            user_id: User ID
            ip_address: Client IP address
            user_agent: Client user agent
            
        Returns:
            Session token string
        """
        token = secrets.token_urlsafe(64)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        expires_at = datetime.now() + timedelta(days=30)
        
        conn = self.get_db()
        cur = conn.cursor()
        
        try:
            cur.execute("""
                INSERT INTO sessions 
                (user_id, token_hash, expires_at, ip_address, user_agent, created_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
            """, (user_id, token_hash, expires_at, ip_address, user_agent))
            
            conn.commit()
            return token
            
        finally:
            cur.close()
            conn.close()
    
    def authenticate_with_google(self, credential: str, ip_address: str = None,
                                 user_agent: str = None) -> Tuple[str, Dict[str, Any], bool]:
        """
        Complete Google OAuth authentication flow
        
        Args:
            credential: Google ID token
            ip_address: Client IP
            user_agent: Client user agent
            
        Returns:
            Tuple of (session_token, user_dict, is_new_user)
        """
        # Verify Google token
        google_user_info = self.verify_google_token(credential)
        
        # Check if user exists by Google ID
        user = self.find_user_by_google_id(google_user_info['google_id'])
        is_new_user = False
        
        if not user:
            # Check if user exists by email
            existing_user = self.find_user_by_email(google_user_info['email'])
            
            if existing_user:
                # User exists with email but not linked to Google
                if existing_user.get('auth_provider') == 'email' and not existing_user.get('google_id'):
                    # Link Google account to existing user
                    self.link_google_account(existing_user['id'], google_user_info)
                    user = self.find_user_by_email(google_user_info['email'])
                else:
                    # Email already exists with different provider
                    raise HTTPException(
                        status_code=409,
                        detail="Email already registered with different authentication method"
                    )
            else:
                # Create new user
                user = self.create_google_user(google_user_info)
                is_new_user = True
        
        # Generate session token
        token = self.generate_session_token(user['id'], ip_address, user_agent)
        
        # Remove sensitive data
        user_response = {k: v for k, v in user.items() if k != 'password_hash'}
        
        return token, user_response, is_new_user


# Example usage in FastAPI:
"""
from google_auth_service import GoogleAuthService
from models_auth import GoogleAuthRequest, AuthTokenResponse

# Initialize service
google_auth_service = GoogleAuthService(get_db)

@app.post("/api/auth/google", response_model=AuthTokenResponse)
async def google_login(
    request: GoogleAuthRequest,
    req: Request
):
    try:
        # Get client info
        ip_address = req.client.host
        user_agent = req.headers.get("user-agent", "")
        
        # Authenticate
        token, user, is_new = google_auth_service.authenticate_with_google(
            request.credential,
            ip_address,
            user_agent
        )
        
        return AuthTokenResponse(
            token=token,
            user=user,
            is_new_user=is_new
        )
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Authentication failed: {str(e)}"
        )
"""
