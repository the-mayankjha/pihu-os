import React, { useEffect } from 'react';
import { Settings } from 'lucide-react';
import { useSettingsStore } from '../../../stores/settingsStore';
import { motion } from 'framer-motion';
import { GlassCard } from '../GlassCard/GlassCard';
import { useLayoutStore } from '../../../core/layout/LayoutStore';
import { useMusicStore } from '../../../stores/musicStore';
import widgetIcon from '../../../assets/widget.png';
import ytMusicIcon from '../../../assets/ytmusic.svg';
import taskIcon from '../../../assets/task.png';

export const Dock: React.FC = () => {
  const { toggleWidgetDrawer, isWidgetDrawerOpen, toggleWidget, widgets } = useLayoutStore();
  const { dockVisible, dockPosition, dockMagnification } = useSettingsStore();
  useEffect(() => {
    const openSettings = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        if (!useLayoutStore.getState().widgets['settings-window']?.isOpen)
          useLayoutStore.getState().toggleWidget('settings-window');
      }
    };
    window.addEventListener('keydown', openSettings);
    return () => window.removeEventListener('keydown', openSettings);
  }, []);
  const { isPlaying } = useMusicStore();

  const isYTMusicOpen = widgets['ytmusic-plugin']?.isOpen || false;
  const isYTMusicActive = isYTMusicOpen || isPlaying;

  const isTaskWindowOpen = widgets['task-window']?.isOpen || false;

  if (!dockVisible) return null;
  const placement = dockPosition === 'left' ? 'left-4 top-1/2 -translate-y-1/2' : dockPosition === 'right' ? 'right-4 top-1/2 -translate-y-1/2' : 'bottom-4 left-1/2 -translate-x-1/2';
  return (
    <div className={`absolute transform z-40 ${placement}`}>
      <GlassCard 
        blur="lg" 
        frost="heavy" 
        className={`px-3 py-2 rounded-3xl flex items-center justify-center gap-3 border border-white/10 shadow-2xl ${dockPosition === 'bottom' ? '' : 'flex-col'}`}
      >
        
        {/* Widgets App */}
        <div className="relative group flex flex-col items-center">
          <motion.button
            onClick={toggleWidgetDrawer}
            whileHover={dockMagnification ? { scale: 1.15, y: -8 } : undefined}
            whileTap={{ scale: 0.9 }}
            className={`rounded-[14px] w-[52px] h-[52px] flex items-center justify-center transition-colors shadow-lg overflow-hidden ${isWidgetDrawerOpen ? 'bg-white/20' : 'bg-gradient-to-br from-white/10 to-transparent hover:bg-white/20'}`}
          >
            <img src={widgetIcon} alt="Widgets" className="w-10 h-10 object-contain drop-shadow-md" />
          </motion.button>
          
          <div className="h-1.5 mt-1.5 flex items-center justify-center">
            {isWidgetDrawerOpen && (
              <motion.div 
                layoutId="active-indicator-widgets"
                className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)]" 
              />
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="w-[1px] h-10 bg-white/10 mx-1"></div>

        {/* YT Music App */}
        <div className="relative group flex flex-col items-center">
          <motion.button
            onClick={() => toggleWidget('ytmusic-plugin')}
            whileHover={dockMagnification ? { scale: 1.15, y: -8 } : undefined}
            whileTap={{ scale: 0.9 }}
            className={`rounded-[14px] w-[52px] h-[52px] flex items-center justify-center transition-colors shadow-lg bg-[#282828] ${isYTMusicOpen ? 'border border-[#FF0000]/50' : 'border border-transparent'}`}
          >
            <img src={ytMusicIcon} alt="YT Music" className="w-[32px] h-[32px] object-contain drop-shadow-xl" />
          </motion.button>
          
          <div className="h-1.5 mt-1.5 flex items-center justify-center">
            {isYTMusicActive && (
              <motion.div 
                layoutId="active-indicator-ytmusic"
                className="w-1.5 h-1.5 rounded-full bg-[#FF0000] shadow-[0_0_8px_rgba(255,0,0,0.8)]" 
              />
            )}
          </div>
        </div>

        {/* Tasks App */}
        <div className="relative group flex flex-col items-center">
          <motion.button
            onClick={() => toggleWidget('task-window')}
            whileHover={dockMagnification ? { scale: 1.15, y: -8 } : undefined}
            whileTap={{ scale: 0.9 }}
            className={`rounded-[14px] w-[52px] h-[52px] flex items-center justify-center transition-colors shadow-lg overflow-hidden ${isTaskWindowOpen ? 'bg-white/20' : 'bg-gradient-to-br from-white/10 to-transparent hover:bg-white/20'}`}
          >
            <img src={taskIcon} alt="Tasks" className="w-10 h-10 object-contain drop-shadow-md" />
          </motion.button>
          
          <div className="h-1.5 mt-1.5 flex items-center justify-center">
            {isTaskWindowOpen && (
              <motion.div 
                layoutId="active-indicator-tasks"
                className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" 
              />
            )}
          </div>
        </div>

        <div className="relative flex flex-col items-center">
          <motion.button aria-label="Settings" title="Settings"
            onClick={() => {
              if (useSettingsStore.getState().activeSidebarCategory === 'ui-components') useSettingsStore.getState().setActiveSidebarCategory('general');
              toggleWidget('settings-window');
            }}
            whileHover={dockMagnification ? { scale: 1.15, y: -8 } : undefined} whileTap={{ scale: 0.9 }}
            className="rounded-[14px] w-[52px] h-[52px] flex items-center justify-center bg-white/10 hover:bg-white/20 shadow-lg">
            <Settings className="w-8 h-8 text-neutral-200" />
          </motion.button>
          <div className="h-1.5 mt-1.5">{widgets['settings-window']?.isOpen && <div className="w-1.5 h-1.5 rounded-full bg-white/80" />}</div>
        </div>
      </GlassCard>
    </div>
  );
};
