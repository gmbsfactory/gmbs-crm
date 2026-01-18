/**
 * GMBS Portal SDK
 * 
 * SDK for CRM integration with GMBS Portal service
 */

export interface SubscriptionStatus {
  active: boolean
  status: 'trial' | 'active' | 'cancelled' | 'expired'
  plan: 'basic' | 'pro' | 'enterprise'
  limits: {
    artisans: number
  }
  usage: {
    artisans: number
  }
  features: string[]
}

export interface GenerateTokenParams {
  artisanId: string
  interventionId?: string
  metadata?: {
    name?: string
    email?: string
    phone?: string
    company?: string
    [key: string]: unknown
  }
}

export interface GenerateTokenResponse {
  token: string
  portal_url: string
  expires_at: string
  created_at: string
}

export interface Submission {
  id: string
  type: 'photo' | 'report' | 'document'
  crm_artisan_id: string
  crm_intervention_id?: string
  data: Record<string, unknown>
  storage_paths: string[]
  synced_to_crm: boolean
  created_at: string
}

export interface GetSubmissionsResponse {
  submissions: Submission[]
  count: number
  has_more: boolean
}

export interface MarkSyncedResponse {
  success: boolean
  marked_count: number
}

export interface SDKConfig {
  keyId?: string
  secret?: string
  baseUrl?: string
}

export class GMBSPortalSDK {
  private keyId: string
  private secret: string
  private baseUrl: string

  constructor(config?: SDKConfig) {
    this.keyId = config?.keyId || process.env.GMBS_PORTAL_KEY_ID || ''
    this.secret = config?.secret || process.env.GMBS_PORTAL_SECRET || ''
    this.baseUrl = config?.baseUrl || process.env.GMBS_PORTAL_BASE_URL || 'https://portal.gmbs.io/api/v1'
    
    if (!this.keyId || !this.secret) {
      console.warn('GMBS Portal SDK: Missing credentials. Set GMBS_PORTAL_KEY_ID and GMBS_PORTAL_SECRET.')
    }
  }

  /**
   * Check if credentials are configured
   */
  isConfigured(): boolean {
    return !!(this.keyId && this.secret)
  }

  /**
   * Internal request method with authentication
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('GMBS Portal SDK not configured. Set GMBS_PORTAL_KEY_ID and GMBS_PORTAL_SECRET.')
    }

    const url = `${this.baseUrl}${endpoint}`
    
    const res = await fetch(url, {
      ...options,
      headers: {
        'X-GMBS-Key-Id': this.keyId,
        'X-GMBS-Secret': this.secret,
        'X-GMBS-Timestamp': Date.now().toString(),
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    
    const data = await res.json()
    
    if (!res.ok) {
      const error = new Error(data.error || `API Error: ${res.status}`) as Error & { 
        status: number
        code: string 
      }
      error.status = res.status
      error.code = data.code || 'UNKNOWN_ERROR'
      throw error
    }
    
    return data
  }

  /**
   * Check subscription status and usage
   */
  async checkSubscription(): Promise<SubscriptionStatus> {
    return this.request<SubscriptionStatus>('/subscription/status')
  }

  /**
   * Generate a portal link for an artisan
   */
  async generatePortalLink(params: GenerateTokenParams): Promise<GenerateTokenResponse> {
    return this.request<GenerateTokenResponse>('/tokens', {
      method: 'POST',
      body: JSON.stringify({
        crm_artisan_id: params.artisanId,
        crm_intervention_id: params.interventionId,
        metadata: params.metadata
      })
    })
  }

  /**
   * Get submissions to sync (pull model)
   */
  async getSubmissions(options?: {
    since?: string
    unsynced?: boolean
    limit?: number
  }): Promise<GetSubmissionsResponse> {
    const params = new URLSearchParams()
    if (options?.since) params.set('since', options.since)
    if (options?.unsynced !== undefined) params.set('unsynced', String(options.unsynced))
    if (options?.limit) params.set('limit', String(options.limit))
    
    const query = params.toString() ? `?${params}` : ''
    return this.request<GetSubmissionsResponse>(`/submissions${query}`)
  }

  /**
   * Mark submissions as synced to CRM
   */
  async markSubmissionsSynced(ids: string[]): Promise<MarkSyncedResponse> {
    return this.request<MarkSyncedResponse>('/submissions/mark-synced', {
      method: 'POST',
      body: JSON.stringify({ ids })
    })
  }
}

// Export singleton for simple usage
let defaultSDK: GMBSPortalSDK | null = null

export function getPortalSDK(): GMBSPortalSDK {
  if (!defaultSDK) {
    defaultSDK = new GMBSPortalSDK()
  }
  return defaultSDK
}

export default GMBSPortalSDK
