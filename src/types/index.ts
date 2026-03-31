export interface Casting {
  id: number
  project_name: string
  client_name: string
  client_company: string
  client_contact: string
  status: string
  source: string
  shoot_date_start: string
  shoot_date_end: string
  location: string
  medium: string
  project_type: string
  requirements: string
  priority: string
  budget_min: number | null
  budget_max: number | null
  assigned_to: string[]
  assigned_ids: number[]
  assigned_names: string | null
  custom_fields: string
  created_at: string
  updated_at: string
}

export interface Client {
  id: number
  name: string
  phone: string
  email: string
  company: string
  notes: string
  assigned_to: number | null
  created_at: string
  updated_at: string
}

export interface TeamMember {
  id: number
  name: string
  email: string
  phone: string
  role: string
  avatar_url: string
  active: boolean
  created_at: string
}

export interface Activity {
  id: number
  casting_id: number
  user_id: number
  user_name: string
  action: string
  type: 'CREATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'COMMENTED' | 'UPDATED' | 'DELETED' | 'NOTE'
  details: string
  created_at: string
}

export interface Comment {
  id: number
  casting_id: number
  user_id: number
  user_name: string
  content: string
  created_at: string
}

export interface PipelineStage {
  id: number
  name: string
  color: string
  order: number
}

export interface LeadSource {
  id: number
  name: string
}

export interface CustomField {
  id: number
  name: string
  field_type: 'text' | 'dropdown' | 'date' | 'number' | 'file'
  group: 'contact_info' | 'project_info' | 'financials' | 'custom'
  options?: string
  required: boolean
}

export interface Role {
  id: number
  name: string
  permissions: string[]
}

export interface Permission {
  id: string
  name: string
}

export interface DashboardStats {
  total_castings: number
  active_castings: number
  total_revenue: number
  total_clients: number
  pipeline: { [key: string]: number }
  trend: { month: string; count: number }[]
  activities: Activity[]
  team_workload: { name: string; count: number }[]
}

export interface SearchResult {
  castings: Casting[]
  clients: Client[]
  team: TeamMember[]
}
