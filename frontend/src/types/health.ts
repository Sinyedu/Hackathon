export interface HealthResponse {
  service: string
  status: string
}

export type ConnectionState = 'checking' | 'online' | 'offline'
