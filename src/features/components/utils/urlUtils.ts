
// Enhanced desktop preview URL with stronger desktop forcing
export const getDesktopPreviewUrl = (component: any, config: any) => {
  const baseUrl = component[config.previewField] || component.link;
  if (!baseUrl) return baseUrl;
  try {
    const url = new URL(baseUrl);

    // Force desktop parameters - comprehensive approach
    url.searchParams.set('elementor-preview', '1');
    url.searchParams.set('preview', 'true');
    url.searchParams.set('preview_nonce', Date.now().toString());
    url.searchParams.set('ver', Date.now().toString());
    url.searchParams.set('viewport', 'desktop');
    url.searchParams.set('device', 'desktop');
    url.searchParams.set('mode', 'desktop');
    url.searchParams.set('responsive', 'desktop');
    url.searchParams.set('breakpoint', 'desktop');
    url.searchParams.set('width', '1400');
    url.searchParams.set('elementor_device', 'desktop');
    url.searchParams.set('elementor_preview_mode', 'desktop');
    url.searchParams.set('elementor_width', '1400');
    url.searchParams.set('force_desktop', '1');
    url.searchParams.set('desktop_mode', '1');
    url.searchParams.set('no_responsive', '1');
    url.searchParams.set('disable_mobile', '1');

    // Remove mobile-specific parameters
    url.searchParams.delete('preview_id');
    url.searchParams.delete('mobile');
    url.searchParams.delete('tablet');
    url.searchParams.delete('elementor_device_mobile');
    url.searchParams.delete('elementor_device_tablet');
    return url.toString();
  } catch {
    return `${baseUrl}?elementor-preview=1&device=desktop&viewport=desktop&width=1400&force_desktop=1&no_responsive=1`;
  }
};

// Enhanced preview URL for modal - FORCE DESKTOP VERSION
export const getPreviewUrl = (component: any, config: any) => {
  const baseUrl = component[config.previewField] || component.link;
  if (!baseUrl) return baseUrl;
  try {
    const url = new URL(baseUrl);

    // Apply same desktop forcing for modal preview
    url.searchParams.set('elementor-preview', '1');
    url.searchParams.set('preview', 'true');
    url.searchParams.set('viewport', 'desktop');
    url.searchParams.set('device', 'desktop');
    url.searchParams.set('mode', 'desktop');
    url.searchParams.set('responsive', 'desktop');
    url.searchParams.set('breakpoint', 'desktop');
    url.searchParams.set('width', '1400');
    url.searchParams.set('elementor_device', 'desktop');
    url.searchParams.set('force_desktop', '1');
    url.searchParams.set('desktop_mode', '1');
    url.searchParams.set('no_responsive', '1');
    url.searchParams.set('disable_mobile', '1');

    // Remove mobile parameters
    url.searchParams.delete('mobile');
    url.searchParams.delete('tablet');
    url.searchParams.delete('elementor_device_mobile');
    url.searchParams.delete('elementor_device_tablet');
    return url.toString();
  } catch {
    return `${baseUrl}?elementor-preview=1&device=desktop&viewport=desktop&width=1400&force_desktop=1&no_responsive=1`;
  }
};
