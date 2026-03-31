const BASE = import.meta.env.VITE_API_URL || ''

export const api = {
  get: (path: string) => fetch(`${BASE}/api${path}`).then(r => r.json()),
  post: (path: string, body: object) => fetch(`${BASE}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json()),
  put: (path: string, body: object) => fetch(`${BASE}/api${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(r => r.json()),
  del: (path: string) => fetch(`${BASE}/api${path}`, { method: 'DELETE' }).then(r => r.json()),
}
