// Content Security Policy component for enhanced security
import { useEffect } from 'react';

interface CSPConfig {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'connect-src'?: string[];
  'font-src'?: string[];
  'object-src'?: string[];
  'media-src'?: string[];
  'child-src'?: string[];
}

const defaultCSPConfig: CSPConfig = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"], // Required for Vite dev mode
  'style-src': ["'self'", "'unsafe-inline'"], // Required for Tailwind CSS
  'img-src': ["'self'", "data:", "https:", "blob:"],
  'connect-src': ["'self'", "https://nfmfcpcwyavutntnrxqq.supabase.co", "wss://nfmfcpcwyavutntnrxqq.supabase.co"],
  'font-src': ["'self'", "https:", "data:"],
  'object-src': ["'none'"],
  'media-src': ["'self'"],
  'child-src': ["'self'"]
};

export const ContentSecurityPolicy: React.FC<{ config?: CSPConfig }> = ({ 
  config = defaultCSPConfig 
}) => {
  useEffect(() => {
    // Generate CSP string from config
    const cspString = Object.entries(config)
      .map(([directive, values]) => `${directive} ${values.join(' ')}`)
      .join('; ');

    // Create or update CSP meta tag
    let cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]') as HTMLMetaElement;
    
    if (!cspMeta) {
      cspMeta = document.createElement('meta');
      cspMeta.setAttribute('http-equiv', 'Content-Security-Policy');
      document.head.appendChild(cspMeta);
    }
    
    cspMeta.setAttribute('content', cspString);
    
    console.log('🔐 Content Security Policy applied:', cspString);
  }, [config]);

  return null; // This component doesn't render anything
};