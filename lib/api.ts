// API utility for consistent endpoint handling
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || ""

// Validate API URL on app load (only in browser)
if (typeof window !== 'undefined' && !API_BASE_URL) {
  console.warn("[WARNING] NEXT_PUBLIC_API_URL is not set! API calls may fail. Please set it in .env.local")
}

export function getApiUrl(endpoint: string): string {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  
  if (!API_BASE_URL) {
    console.error("[ERROR] API_BASE_URL is not configured. Add NEXT_PUBLIC_API_URL to your .env.local file")
    // Return the endpoint as-is for Next.js API routes fallback
    return normalizedEndpoint
  }
  
  return `${API_BASE_URL}${normalizedEndpoint}`
}

export async function apiCall(
  endpoint: string,
  options?: RequestInit
): Promise<Response> {
  const url = getApiUrl(endpoint)
  
  console.log(`[API] Calling: ${url}`)
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })
    
    console.log(`[API] Response status: ${response.status}`)
    return response
  } catch (error) {
    console.error(`[API] Request failed for ${url}:`, error)
    throw error
  }
}

// Helper to parse API responses with better error handling
export async function parseApiResponse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type")
  
  // Check if response is JSON
  if (contentType?.includes("application/json")) {
    return await response.json()
  }
  
  // If not JSON, read as text and throw error
  const text = await response.text()
  console.error("[API] Expected JSON but got:", contentType)
  console.error("[API] Response body (first 500 chars):", text.substring(0, 500))
  
  throw new Error(
    `API returned non-JSON response (${contentType}). ` +
    `This usually means the backend is not running or the API URL is incorrect. ` +
    `Response: ${text.substring(0, 100)}...`
  )
}
