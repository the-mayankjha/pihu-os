import { useLayoutStore } from '../layout/LayoutStore';
import { useSettingsStore } from '../../stores/settingsStore';

export function openMcpConfiguration(id: string) {
  sessionStorage.setItem('pihu-configure-mcp', id);
  useSettingsStore.getState().setActiveSidebarCategory('connections');
  const layout = useLayoutStore.getState();
  if (layout.widgets['marketplace-window']?.isOpen) layout.toggleWidget('marketplace-window');
  if (!layout.widgets['settings-window']?.isOpen) layout.toggleWidget('settings-window');
  window.dispatchEvent(new CustomEvent('pihu-configure-mcp', { detail: id }));
}

export function openMcpMarket() {
  const layout = useLayoutStore.getState();
  if (layout.widgets['settings-window']?.isOpen) layout.toggleWidget('settings-window');
  if (!layout.widgets['marketplace-window']?.isOpen) layout.toggleWidget('marketplace-window');
}
