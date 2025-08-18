
// Preline UI initialization and utilities
import type { IStaticMethods } from "preline/preline";

declare global {
  interface Window {
    HSStaticMethods: IStaticMethods;
  }
}

export const initPreline = async () => {
  if (typeof window !== "undefined") {
    const { HSStaticMethods } = await import("preline/preline");
    
    // Make HSStaticMethods available globally
    window.HSStaticMethods = HSStaticMethods;
    
    // Initialize Preline components
    HSStaticMethods.autoInit();
  }
};

export const reinitPreline = () => {
  if (typeof window !== "undefined" && window.HSStaticMethods) {
    window.HSStaticMethods.autoInit();
  }
};

// Helper to refresh Preline components after route changes
export const refreshPrelineComponents = () => {
  if (typeof window !== "undefined" && window.HSStaticMethods) {
    // Small delay to ensure DOM is updated
    setTimeout(() => {
      window.HSStaticMethods.autoInit();
    }, 100);
  }
};
