const API_BASE = '/api';

export const api = {
  async getClasses() {
    const res = await fetch(`${API_BASE}/classes`);
    return res.json();
  },

  async getTerms() {
    const res = await fetch(`${API_BASE}/terms`);
    return res.json();
  },

  async setCurrentTerm(termId) {
    const res = await fetch(`${API_BASE}/terms/set-current`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term_id: termId })
    });
    return res.json();
  },

  async getUsers() {
    const res = await fetch(`${API_BASE}/users`);
    return res.json();
  },

  async getCurriculum(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/curriculum?${query}`);
    return res.json();
  },

  async getLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/logs?${query}`);
    return res.json();
  },

  async createLog(logData) {
    const res = await fetch(`${API_BASE}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    });
    return res.json();
  },

  async deleteLog(id) {
    const res = await fetch(`${API_BASE}/logs/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  async getAdminDashboard() {
    const res = await fetch(`${API_BASE}/admin/dashboard`);
    return res.json();
  }
};
