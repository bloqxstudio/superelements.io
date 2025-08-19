// Security utility functions

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(content: string): string {
  // Create a temporary div to parse HTML and return only text content
  const tempDiv = document.createElement('div');
  tempDiv.textContent = content; // This automatically escapes HTML
  return tempDiv.textContent || ''; // Return sanitized text content
}

/**
 * Validate and sanitize error messages for display
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return sanitizeHtml(error);
  }
  
  if (error instanceof Error) {
    return sanitizeHtml(error.message);
  }
  
  if (error && typeof error === 'object' && 'message' in error) {
    return sanitizeHtml(String(error.message));
  }
  
  return 'An unexpected error occurred';
}

/**
 * Safe DOM manipulation - replaces innerHTML usage
 */
export function setTextContent(element: HTMLElement, content: string): void {
  element.textContent = content;
}

/**
 * Log security events for audit trail
 */
export function logSecurityEvent(eventType: string, eventData: Record<string, any>): void {
  const event = {
    timestamp: new Date().toISOString(),
    type: eventType,
    data: eventData,
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  // In production, this should send to your security monitoring system
  console.warn('[SECURITY EVENT]', event);
}

/**
 * Validate user permissions before sensitive operations
 */
export function validateUserPermission(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = {
    'free': 0,
    'pro': 1,
    'admin': 2
  };
  
  const userLevel = roleHierarchy[userRole as keyof typeof roleHierarchy] ?? 0;
  const requiredLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] ?? 0;
  
  return userLevel >= requiredLevel;
}