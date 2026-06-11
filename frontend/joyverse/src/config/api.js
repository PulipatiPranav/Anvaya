/**
 * Centralised API base URL.
 * Override at build time by setting REACT_APP_API_URL in .env.
 * Default falls back to localhost for local development.
 */
export const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4000";
export const ML_BASE  = process.env.REACT_APP_ML_URL  || "http://127.0.0.1:5000";
