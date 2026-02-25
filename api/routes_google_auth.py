"""
Google OAuth API Routes
========================
FastAPI routes for Google authentication

Add these to your main index.py
"""

from fastapi import APIRouter, HTTPException, Request, Depends
from google_auth_service import GoogleAuthService
from models_auth import GoogleAuthRequest, AuthTokenResponse, UserProfileUpdate
from index import require_auth, get_db

# Initialize router
google_auth_router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Initialize service (pass your get_db function)
google_auth_service = GoogleAuthService(get_db)


# =========================
# GOOGLE OAUTH ROUTES
# =========================

@google_auth_router.post("/google", response_model=AuthTokenResponse)
async def google_login(
    request: GoogleAuthRequest,
    req: Request
):
    """
    Authenticate user with Google OAuth
    
    Flow:
    1. Frontend gets Google ID token using Google Sign-In
    2. Sends token to this endpoint
    3. Backend verifies token with Google
    4. Creates/finds user in database
    5. Returns session token
    
    Request body:
    {
        "credential": "google_id_token_from_frontend"
    }
    
    Response:
    {
        "token": "session_token",
        "user": {...},
        "is_new_user": true/false
    }
    """
    try:
        # Get client information
        ip_address = req.client.host if req.client else None
        user_agent = req.headers.get("user-agent", "")
        
        # Authenticate with Google
        token, user, is_new = google_auth_service.authenticate_with_google(
            credential=request.credential,
            ip_address=ip_address,
            user_agent=user_agent
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


@google_auth_router.get("/me")
async def get_current_user_info(user: dict = Depends(require_auth)):
    """
    Get current authenticated user information
    
    Requires: Bearer token in Authorization header
    
    Returns: User profile data
    """
    return {
        "user": user
    }


@google_auth_router.put("/profile", response_model=dict)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    user: dict = Depends(require_auth)
):
    """
    Update user profile information
    
    Allows updating:
    - name
    - gender, age, height, weight
    - activity_level, metabolism_type, goal
    - daily_water_goal
    """
    try:
        conn = get_db()
        cur = conn.cursor()
        
        # Build dynamic UPDATE query
        update_fields = []
        values = []
        
        for field, value in profile_data.dict(exclude_unset=True).items():
            if value is not None:
                update_fields.append(f"{field} = %s")
                values.append(value)
        
        if not update_fields:
            return {"success": True, "message": "No changes to update"}
        
        # Add user_id for WHERE clause
        values.append(user['id'])
        
        query = f"""
            UPDATE users
            SET {', '.join(update_fields)}, updated_at = NOW()
            WHERE id = %s
        """
        
        cur.execute(query, values)
        conn.commit()
        
        cur.close()
        conn.close()
        
        return {
            "success": True,
            "message": "Profile updated successfully"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update profile: {str(e)}"
        )


# =========================
# FRONTEND INTEGRATION GUIDE
# =========================
"""
Frontend Google Sign-In Setup:
===============================

1. Install Google Sign-In library:
   npm install @react-oauth/google

2. Get Google Client ID:
   - Go to https://console.cloud.google.com
   - Create project / Select project
   - APIs & Services > Credentials
   - Create OAuth 2.0 Client ID
   - Add authorized origins: http://localhost:3000, your-domain.com
   - Copy Client ID

3. Add to .env.local:
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id_here

4. Backend .env:
   GOOGLE_CLIENT_ID=same_client_id

5. Wrap app with GoogleOAuthProvider:

   // app/layout.tsx
   import { GoogleOAuthProvider } from '@react-oauth/google';
   
   export default function RootLayout({ children }) {
     return (
       <html>
         <body>
           <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}>
             {children}
           </GoogleOAuthProvider>
         </body>
       </html>
     );
   }

6. Use in login page:

   // app/login/page.tsx
   import { GoogleLogin } from '@react-oauth/google';
   import { useAuth } from '@/lib/auth-context';
   
   export default function LoginPage() {
     const { loginWithGoogle } = useAuth();
     
     return (
       <GoogleLogin
         onSuccess={async (credentialResponse) => {
           const result = await loginWithGoogle(credentialResponse.credential!);
           if (result.success) {
             router.push('/');
           }
         }}
         onError={() => {
           console.error('Google Login Failed');
         }}
       />
     );
   }

7. Update auth-context.tsx:

   const loginWithGoogle = async (credential: string) => {
     try {
       const response = await fetch(`${API_URL}/api/auth/google`, {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ credential }),
       });
       
       const data = await response.json();
       
       if (!response.ok) {
         return { success: false, error: data.detail };
       }
       
       localStorage.setItem("nutrilife_token", data.token);
       setToken(data.token);
       setUser(data.user);
       
       return { success: true, is_new_user: data.is_new_user };
     } catch (error) {
       return { success: false, error: "Google login failed" };
     }
   };

8. Install backend dependency:
   pip install google-auth google-auth-oauthlib google-auth-httplib2

9. Test the flow:
   - Click "Sign in with Google" button
   - Select Google account
   - Backend verifies token
   - Creates/finds user
   - Returns session token
   - Redirect to dashboard
"""
