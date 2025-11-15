/**
 * Enhanced Robust Clipboard Utility
 * Handles clipboard operations with comprehensive fallback strategies and debugging
 */

interface ClipboardResult {
  success: boolean;
  error?: string;
  method?: 'clipboard-api' | 'execCommand' | 'manual';
  debugInfo?: {
    isSecureContext: boolean;
    hasClipboardApi: boolean;
    hasFocus: boolean;
    userAgent: string;
    permissions?: string;
  };
}

interface ClipboardPermissionStatus {
  hasPermission: boolean;
  canRequestPermission: boolean;
  error?: string;
}

interface ClipboardDebugInfo {
  isSecureContext: boolean;
  hasClipboardApi: boolean;
  hasFocus: boolean;
  userAgent: string;
  permissions?: string;
}

/**
 * Detect browser type and version
 */
const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  const isChrome = /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
  const isSafari = /Safari/.test(ua) && /Apple Computer/.test(navigator.vendor);
  const isFirefox = /Firefox/.test(ua);
  const isEdge = /Edg/.test(ua);
  
  return {
    isChrome,
    isSafari,
    isFirefox,
    isEdge,
    userAgent: ua,
    isMobile: /Mobile|Android|iPhone|iPad/.test(ua)
  };
};

/**
 * Check if Clipboard API is available and secure context
 */
export const isClipboardApiAvailable = (): boolean => {
  const available = (
    typeof navigator !== 'undefined' &&
    'clipboard' in navigator &&
    typeof navigator.clipboard.writeText === 'function' &&
    window.isSecureContext
  );
  
  console.log('🔍 CLIPBOARD API CHECK:', {
    hasNavigator: typeof navigator !== 'undefined',
    hasClipboard: 'clipboard' in navigator,
    hasWriteText: typeof navigator?.clipboard?.writeText === 'function',
    isSecureContext: window.isSecureContext,
    available
  });
  
  return available;
};

/**
 * Check clipboard permissions with detailed logging
 */
export const checkClipboardPermissions = async (): Promise<ClipboardPermissionStatus> => {
  if (!isClipboardApiAvailable()) {
    return { hasPermission: false, canRequestPermission: false, error: 'Clipboard API not available' };
  }

  try {
    if ('permissions' in navigator) {
      const permission = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName });
      console.log('🔐 CLIPBOARD PERMISSIONS:', {
        state: permission.state,
        hasPermission: permission.state === 'granted',
        canRequest: permission.state === 'prompt'
      });
      
      return {
        hasPermission: permission.state === 'granted',
        canRequestPermission: permission.state === 'prompt'
      };
    }

    return { hasPermission: true, canRequestPermission: true };
  } catch (error) {
    console.warn('⚠️ CLIPBOARD PERMISSIONS CHECK FAILED:', error);
    return { hasPermission: true, canRequestPermission: true };
  }
};

/**
 * Check if page has focus
 */
export const isPageFocused = (): boolean => {
  const focused = document.hasFocus();
  console.log('👁️ PAGE FOCUS CHECK:', { focused });
  return focused;
};

/**
 * Enhanced fallback clipboard copy using execCommand with multiple strategies
 */
const copyUsingExecCommand = (text: string): ClipboardResult => {
  console.log('📋 TRYING EXECCOMMAND METHOD');
  
  try {
    // Strategy 1: Standard textarea approach
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    textarea.style.width = '1px';
    textarea.style.height = '1px';

    document.body.appendChild(textarea);
    
    // Focus and select
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    
    // Give browser time to process
    setTimeout(() => {}, 10);
    
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);

    console.log('📋 EXECCOMMAND RESULT:', { successful });

    if (successful) {
      return { success: true, method: 'execCommand' };
    } else {
      // Strategy 2: Try with different element
      return copyUsingInputElement(text);
    }
  } catch (error) {
    console.error('💥 EXECCOMMAND ERROR:', error);
    return { 
      success: false, 
      error: `execCommand error: ${error instanceof Error ? error.message : 'unknown'}`,
      method: 'execCommand'
    };
  }
};

/**
 * Alternative execCommand strategy using input element
 */
const copyUsingInputElement = (text: string): ClipboardResult => {
  try {
    console.log('📋 TRYING INPUT ELEMENT METHOD');
    
    const input = document.createElement('input');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.left = '-9999px';
    input.style.top = '-9999px';

    document.body.appendChild(input);
    input.focus();
    input.select();
    
    const successful = document.execCommand('copy');
    document.body.removeChild(input);

    console.log('📋 INPUT ELEMENT RESULT:', { successful });

    if (successful) {
      return { success: true, method: 'execCommand' };
    } else {
      return { 
        success: false, 
        error: 'Both textarea and input execCommand failed',
        method: 'execCommand'
      };
    }
  } catch (error) {
    return { 
      success: false, 
      error: `Input element error: ${error instanceof Error ? error.message : 'unknown'}`,
      method: 'execCommand'
    };
  }
};

/**
 * Main clipboard copy function with comprehensive fallbacks and debugging
 */
export const copyToClipboard = async (text: string): Promise<ClipboardResult> => {
  const browserInfo = getBrowserInfo();
  const debugInfo: ClipboardDebugInfo = {
    isSecureContext: window.isSecureContext,
    hasClipboardApi: isClipboardApiAvailable(),
    hasFocus: isPageFocused(),
    userAgent: browserInfo.userAgent
  };

  console.log('🔄 ENHANCED ROBUST CLIPBOARD: Starting copy operation');
  console.log('🔍 BROWSER INFO:', browserInfo);
  console.log('🔍 DEBUG INFO:', debugInfo);

  // Check if page has focus first
  if (!debugInfo.hasFocus) {
    console.warn('⚠️ PAGE NOT FOCUSED');
    return {
      success: false,
      error: 'Page is not focused. Please click on the page first and try again.',
      debugInfo
    };
  }

  // Strategy 1: Try Clipboard API first (if available)
  if (debugInfo.hasClipboardApi) {
    try {
      console.log('📋 TRYING CLIPBOARD API');
      
      // Check permissions first
      const permissionStatus = await checkClipboardPermissions();
      debugInfo.permissions = permissionStatus.hasPermission ? 'granted' : 'denied';
      
      console.log('🔐 PERMISSION STATUS:', permissionStatus);

      // Try the actual copy
      await navigator.clipboard.writeText(text);
      console.log('✅ CLIPBOARD API SUCCESS');
      
      return { 
        success: true, 
        method: 'clipboard-api',
        debugInfo
      };
      
    } catch (error) {
      console.warn('⚠️ CLIPBOARD API FAILED:', error);
      
      // Analyze the specific error
      if (error instanceof Error) {
        if (error.message.includes('not allowed') || error.message.includes('denied')) {
          console.log('📋 CLIPBOARD API DENIED, TRYING EXECCOMMAND');
          // Continue to execCommand fallback
        } else if (error.message.includes('permission')) {
          return {
            success: false,
            error: 'Permissão de área de transferência negada. Por favor, permita acesso à área de transferência nas configurações do seu navegador.',
            debugInfo
          };
        } else {
          console.log('📋 CLIPBOARD API ERROR, TRYING EXECCOMMAND');
          // Continue to execCommand fallback
        }
      }
    }
  } else {
    console.log('📋 CLIPBOARD API NOT AVAILABLE, USING EXECCOMMAND');
  }

  // Strategy 2: Fallback to execCommand with enhanced strategies
  console.log('📋 TRYING EXECCOMMAND FALLBACK');
  const execResult = copyUsingExecCommand(text);
  
  if (execResult.success) {
    console.log('✅ EXECCOMMAND SUCCESS');
    return {
      ...execResult,
      debugInfo
    };
  }

  console.error('💥 ALL AUTOMATIC METHODS FAILED');
  
  // Strategy 3: Manual instruction as last resort
  return {
    success: false,
    error: 'Não foi possível copiar automaticamente. Suas configurações de navegador ou segurança estão bloqueando o acesso à área de transferência.',
    method: 'manual',
    debugInfo
  };
};

/**
 * Get user-friendly error message based on the error type and browser
 */
export const getClipboardErrorMessage = (error: any): { title: string; description: string } => {
  const browserInfo = getBrowserInfo();
  
  if (typeof error === 'string') {
    if (error.includes('not focused')) {
      return {
        title: 'Page Not Focused',
        description: 'Please click on the page first and try copying again.'
      };
    }
    
    if (error.includes('permission') || error.includes('denied')) {
      return {
        title: 'Clipboard Access Blocked',
        description: browserInfo.isSafari 
          ? 'Safari requires user interaction. Try clicking the copy button again.'
          : 'Please allow clipboard access in your browser settings and try again.'
      };
    }
    
    if (error.includes('security settings')) {
      return {
        title: 'Security Settings',
        description: 'Your browser security settings are blocking clipboard access. Try using a different browser or adjusting your settings.'
      };
    }
  }

  if (error instanceof Error) {
    if (error.message.includes('not allowed')) {
      return {
        title: 'Acesso à Área de Transferência Negado',
        description: browserInfo.isSafari 
          ? 'Safari requer interação direta do usuário. Clique no botão copiar e tente novamente imediatamente.'
          : 'Seu navegador está bloqueando o acesso à área de transferência. Tente usar um navegador diferente ou verifique suas extensões.'
      };
    }
  }

  // Browser-specific fallback messages
  if (browserInfo.isSafari) {
    return {
      title: 'Problema do Safari',
      description: 'Safari tem políticas rígidas de área de transferência. Tente clicar no botão copiar novamente ou use um navegador diferente.'
    };
  }

  if (browserInfo.isMobile) {
    return {
      title: 'Problema Mobile',
      description: 'Navegadores mobile têm suporte limitado à área de transferência. Tente usar a versão desktop ou copie manualmente.'
    };
  }

  return {
    title: 'Falha na Cópia',
    description: 'Não foi possível copiar para a área de transferência. Tente novamente ou copie os dados manualmente.'
  };
};

/**
 * Show manual copy modal with the component data
 */
export const showManualCopyModal = (componentData: string): void => {
  console.log('📋 SHOWING MANUAL COPY MODAL');
  
  // Create modal elements
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: system-ui, -apple-system, sans-serif;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 8px;
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  `;
  
  const title = document.createElement('h3');
  title.textContent = 'Cópia Manual Necessária';
  title.style.cssText = 'margin: 0 0 16px 0; font-size: 18px; font-weight: 600;';
  
  const instructions = document.createElement('p');
  instructions.textContent = 'Seu navegador bloqueou a cópia automática. Por favor, selecione todo o texto abaixo e copie manualmente (Ctrl+C ou Cmd+C):';
  instructions.style.cssText = 'margin: 0 0 16px 0; color: #666;';
  
  const textarea = document.createElement('textarea');
  textarea.value = componentData;
  textarea.style.cssText = `
    width: 100%;
    height: 300px;
    font-family: monospace;
    font-size: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px;
    resize: vertical;
  `;
  
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Fechar';
  closeButton.style.cssText = `
    margin-top: 16px;
    padding: 8px 16px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;
  
  closeButton.onclick = () => document.body.removeChild(modal);
  modal.onclick = (e) => e.target === modal && document.body.removeChild(modal);
  
  content.appendChild(title);
  content.appendChild(instructions);
  content.appendChild(textarea);
  content.appendChild(closeButton);
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Auto-select the text
  setTimeout(() => {
    textarea.focus();
    textarea.select();
  }, 100);
};

/**
 * Get environment debug information
 */
const getEnvironmentDebugInfo = async (): Promise<ClipboardDebugInfo> => {
  const debugInfo: ClipboardDebugInfo = {
    isSecureContext: window.isSecureContext,
    hasClipboardApi: !!navigator.clipboard,
    hasFocus: document.hasFocus(),
    userAgent: navigator.userAgent
  };

  // Only add permissions if available
  if ('permissions' in navigator && navigator.permissions) {
    try {
      const permission = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName });
      debugInfo.permissions = permission.state;
    } catch (error) {
      debugInfo.permissions = 'unavailable';
    }
  }

  return debugInfo;
};
