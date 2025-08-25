/**
 * Enhanced Robust Clipboard with improved error handling and fallback strategies
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
    attemptedMethods: string[];
    timeTaken: number;
  };
}

/**
 * Enhanced clipboard copy with comprehensive fallbacks
 */
export const copyToClipboardEnhanced = async (text: string): Promise<ClipboardResult> => {
  const startTime = Date.now();
  const debugInfo = {
    isSecureContext: window.isSecureContext,
    hasClipboardApi: !!navigator.clipboard,
    hasFocus: document.hasFocus(),
    userAgent: navigator.userAgent,
    attemptedMethods: [] as string[],
    timeTaken: 0,
    permissions: undefined as string | undefined
  };

  console.log('📋 ENHANCED CLIPBOARD COPY START:', {
    textLength: text.length,
    secureContext: debugInfo.isSecureContext,
    hasApi: debugInfo.hasClipboardApi,
    hasFocus: debugInfo.hasFocus
  });

  // Strategy 1: Modern Clipboard API
  if (debugInfo.hasClipboardApi && debugInfo.isSecureContext) {
    debugInfo.attemptedMethods.push('clipboard-api');
    
    try {
      console.log('📋 TRYING CLIPBOARD API...');
      await navigator.clipboard.writeText(text);
      
      debugInfo.timeTaken = Date.now() - startTime;
      console.log('✅ CLIPBOARD API SUCCESS:', { timeTaken: debugInfo.timeTaken });
      
      return {
        success: true,
        method: 'clipboard-api',
        debugInfo
      };
    } catch (error) {
      console.warn('⚠️ CLIPBOARD API FAILED:', error);
      
      // Try to get permission info
      if ('permissions' in navigator) {
        try {
          const permission = await navigator.permissions.query({ name: 'clipboard-write' as PermissionName });
          debugInfo.permissions = permission.state;
        } catch (permError) {
          debugInfo.permissions = 'unavailable';
        }
      }
    }
  }

  // Strategy 2: execCommand fallback with multiple approaches
  debugInfo.attemptedMethods.push('execCommand');
  
  const execResult = await tryExecCommandStrategies(text);
  if (execResult.success) {
    debugInfo.timeTaken = Date.now() - startTime;
    console.log('✅ EXECCOMMAND SUCCESS:', { timeTaken: debugInfo.timeTaken });
    
    return {
      ...execResult,
      debugInfo
    };
  }

  // Strategy 3: Manual copy as last resort
  debugInfo.attemptedMethods.push('manual');
  debugInfo.timeTaken = Date.now() - startTime;
  
  console.log('📋 SHOWING MANUAL COPY MODAL');
  showEnhancedManualCopyModal(text);
  
  return {
    success: false,
    method: 'manual',
    error: 'Automatic copy failed - manual copy modal shown',
    debugInfo
  };
};

/**
 * Try multiple execCommand strategies
 */
const tryExecCommandStrategies = async (text: string): Promise<ClipboardResult> => {
  const strategies = [
    () => copyWithTextarea(text),
    () => copyWithInput(text),
    () => copyWithContentEditable(text),
    () => copyWithSelection(text)
  ];

  for (let i = 0; i < strategies.length; i++) {
    console.log(`📋 TRYING EXECCOMMAND STRATEGY ${i + 1}/${strategies.length}`);
    
    try {
      const result = await strategies[i]();
      if (result.success) {
        console.log(`✅ EXECCOMMAND STRATEGY ${i + 1} SUCCESS`);
        return result;
      }
    } catch (error) {
      console.warn(`⚠️ EXECCOMMAND STRATEGY ${i + 1} FAILED:`, error);
    }
  }

  return {
    success: false,
    method: 'execCommand',
    error: 'All execCommand strategies failed'
  };
};

/**
 * Strategy 1: Textarea approach
 */
const copyWithTextarea = (text: string): ClipboardResult => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-999999px';
  textarea.style.top = '-999999px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);
  
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    
    // Give browser time to process
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    
    return {
      success,
      method: 'execCommand'
    };
  } catch (error) {
    document.body.removeChild(textarea);
    throw error;
  }
};

/**
 * Strategy 2: Input approach
 */
const copyWithInput = (text: string): ClipboardResult => {
  const input = document.createElement('input');
  input.value = text;
  input.style.position = 'fixed';
  input.style.left = '-999999px';
  input.style.top = '-999999px';
  input.style.opacity = '0';

  document.body.appendChild(input);
  
  try {
    input.focus();
    input.select();
    
    const success = document.execCommand('copy');
    document.body.removeChild(input);
    
    return {
      success,
      method: 'execCommand'
    };
  } catch (error) {
    document.body.removeChild(input);
    throw error;
  }
};

/**
 * Strategy 3: ContentEditable approach
 */
const copyWithContentEditable = (text: string): ClipboardResult => {
  const div = document.createElement('div');
  div.contentEditable = 'true';
  div.style.position = 'fixed';
  div.style.left = '-999999px';
  div.style.top = '-999999px';
  div.style.opacity = '0';
  div.textContent = text;

  document.body.appendChild(div);
  
  try {
    div.focus();
    
    // Select all content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(div);
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    const success = document.execCommand('copy');
    document.body.removeChild(div);
    
    return {
      success,
      method: 'execCommand'
    };
  } catch (error) {
    document.body.removeChild(div);
    throw error;
  }
};

/**
 * Strategy 4: Selection API approach
 */
const copyWithSelection = (text: string): ClipboardResult => {
  const span = document.createElement('span');
  span.textContent = text;
  span.style.position = 'fixed';
  span.style.left = '-999999px';
  span.style.top = '-999999px';
  span.style.whiteSpace = 'pre';

  document.body.appendChild(span);
  
  try {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNode(span);
    selection?.removeAllRanges();
    selection?.addRange(range);
    
    const success = document.execCommand('copy');
    document.body.removeChild(span);
    selection?.removeAllRanges();
    
    return {
      success,
      method: 'execCommand'
    };
  } catch (error) {
    document.body.removeChild(span);
    throw error;
  }
};

/**
 * Enhanced manual copy modal with better UX
 */
const showEnhancedManualCopyModal = (text: string): void => {
  // Remove any existing modal
  const existingModal = document.getElementById('manual-copy-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'manual-copy-modal';
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
    z-index: 99999;
    font-family: system-ui, -apple-system, sans-serif;
  `;
  
  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    padding: 32px;
    border-radius: 12px;
    max-width: 700px;
    max-height: 80vh;
    overflow: hidden;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
  `;
  
  const title = document.createElement('h2');
  title.textContent = '📋 Cópia Manual Necessária';
  title.style.cssText = 'margin: 0 0 16px 0; font-size: 24px; font-weight: 700; color: #1f2937;';
  
  const instructions = document.createElement('p');
  const instructionsText = 'Seu navegador bloqueou a cópia automática. Por favor, selecione todo o texto abaixo e copie manualmente: ';
  instructions.textContent = instructionsText;
  
  // Create keyboard shortcuts as separate elements
  const ctrlAKey = document.createElement('kbd');
  ctrlAKey.textContent = 'Ctrl+A';
  ctrlAKey.style.cssText = 'background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px;';
  
  const cmdAKey = document.createElement('kbd');
  cmdAKey.textContent = 'Cmd+A';
  cmdAKey.style.cssText = 'background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px;';
  
  const ctrlCKey = document.createElement('kbd');
  ctrlCKey.textContent = 'Ctrl+C';
  ctrlCKey.style.cssText = 'background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px;';
  
  const cmdCKey = document.createElement('kbd');
  cmdCKey.textContent = 'Cmd+C';
  cmdCKey.style.cssText = 'background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 12px;';
  
  // Append text and keys safely
  instructions.appendChild(document.createTextNode(instructionsText));
  instructions.appendChild(ctrlAKey);
  instructions.appendChild(document.createTextNode(' (or '));
  instructions.appendChild(cmdAKey);
  instructions.appendChild(document.createTextNode(') then '));
  instructions.appendChild(ctrlCKey);
  instructions.appendChild(document.createTextNode(' (or '));
  instructions.appendChild(cmdCKey);
  instructions.appendChild(document.createTextNode(')'));
  
  instructions.style.cssText = 'margin: 0 0 20px 0; color: #6b7280; line-height: 1.6;';
  
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.cssText = `
    width: 100%;
    height: 300px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 12px;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
    resize: vertical;
    background: #f9fafb;
    color: #374151;
    margin-bottom: 20px;
  `;
  
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';
  
  const selectAllButton = document.createElement('button');
  selectAllButton.textContent = 'Selecionar Tudo';
  selectAllButton.style.cssText = `
    padding: 10px 20px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;
  `;
  selectAllButton.onmouseover = () => selectAllButton.style.background = '#2563eb';
  selectAllButton.onmouseout = () => selectAllButton.style.background = '#3b82f6';
  
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Fechar';
  closeButton.style.cssText = `
    padding: 10px 20px;
    background: #6b7280;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: background 0.2s;
  `;
  closeButton.onmouseover = () => closeButton.style.background = '#4b5563';
  closeButton.onmouseout = () => closeButton.style.background = '#6b7280';
  
  // Event handlers
  selectAllButton.onclick = () => {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, text.length);
  };
  
  const closeModal = () => document.body.removeChild(modal);
  closeButton.onclick = closeModal;
  modal.onclick = (e) => e.target === modal && closeModal();
  
  // Keyboard shortcuts
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escHandler);
    }
  });
  
  // Build modal
  buttonContainer.appendChild(selectAllButton);
  buttonContainer.appendChild(closeButton);
  
  content.appendChild(title);
  content.appendChild(instructions);
  content.appendChild(textarea);
  content.appendChild(buttonContainer);
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  // Auto-select the text
  setTimeout(() => {
    textarea.focus();
    textarea.select();
  }, 100);
};

/**
 * Get user-friendly error message
 */
export const getEnhancedClipboardErrorMessage = (error: any): { title: string; description: string } => {
  const browserInfo = {
    isSafari: /Safari/.test(navigator.userAgent) && /Apple Computer/.test(navigator.vendor),
    isFirefox: /Firefox/.test(navigator.userAgent),
    isMobile: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)
  };
  
  if (typeof error === 'string') {
    if (error.includes('not focused') || error.includes('focus')) {
      return {
        title: 'Página Não Focada',
        description: 'Por favor, clique na página primeiro e tente copiar novamente.'
      };
    }
    
    if (error.includes('permission') || error.includes('denied')) {
      return {
        title: 'Permissão de Área de Transferência Negada',
        description: browserInfo.isSafari 
          ? 'Safari requer interação direta do usuário. Tente clicar no botão copiar novamente.'
          : 'Por favor, permita acesso à área de transferência nas configurações do seu navegador.'
      };
    }
  }

  if (browserInfo.isSafari) {
    return {
      title: 'Limitação do Safari',
      description: 'Safari tem políticas rígidas de área de transferência. Um diálogo de cópia manual será mostrado se a cópia automática falhar.'
    };
  }

  if (browserInfo.isMobile) {
    return {
      title: 'Problema de Área de Transferência Mobile',
      description: 'Navegadores mobile têm suporte limitado à área de transferência. Um diálogo de cópia manual será mostrado.'
    };
  }

  return {
    title: 'Falha na Cópia',
    description: 'Cópia automática falhou. Um diálogo de cópia manual será mostrado para completar a operação.'
  };
};
