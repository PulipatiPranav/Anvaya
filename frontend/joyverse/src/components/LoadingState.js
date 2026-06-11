import React from "react";

/**
 * Loading spinner with optional label. Uses shared .loading-state / .loading-spinner
 * classes from global.css — no local CSS needed.
 */
export function LoadingState({ label = "Loading…" }) {
  return (
    <div className="loading-state" role="status" aria-live="polite" aria-label={label}>
      <div className="loading-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

/**
 * Dismissable error banner. Uses .error-banner from global.css.
 */
export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="error-banner" role="alert" aria-live="assertive">
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss error"
          style={{
            marginLeft: "12px",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "inherit",
            fontWeight: "bold",
            fontSize: "1.1em",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

/**
 * Empty state placeholder. Uses .empty-state from global.css.
 */
export function EmptyState({ icon = "📭", title, description, action }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">{icon}</span>
      {title && <p style={{ fontWeight: 700, fontSize: "1.125rem", margin: 0 }}>{title}</p>}
      {description && <p style={{ margin: 0 }}>{description}</p>}
      {action}
    </div>
  );
}
