import axios from 'axios';

// In a native app, relative paths like '/api' won't work.
// We use an environment variable or a fallback to handle this.
const API_URL = (import.meta as any).env?.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export default api;
