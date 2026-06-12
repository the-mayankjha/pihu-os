import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '../GlassCard/GlassCard';
import { useLayoutStore } from '../../../core/layout/LayoutStore';
import { useMusicStore } from '../../../stores/musicStore';
import widgetIcon from '../../../assets/widget.png';
import ytMusicIcon from '../../../assets/ytmusic.svg';

export const Dock: React.FC = () => {
  const { toggleWidgetDrawer, isWidgetDrawerOpen, toggleWidget, widgets } = useLayoutStore();
  const { isPlaying } = useMusicStore();

  const isYTMusicOpen = widgets['ytmusic-plugin']?.isOpen || false;
  const isYTMusicActive = isYTMusicOpen || isPlaying;

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
      <GlassCard 
        blur="lg" 
        frost="heavy" 
        className="px-3 py-2 rounded-3xl flex items-center justify-center gap-3 border border-white/10 shadow-2xl"
      >
        
        {/* Widgets App */}
        <div className="relative group flex flex-col items-center">
          <motion.button
            onClick={toggleWidgetDrawer}
            whileHover={{ scale: 1.15, y: -8 }}
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
            whileHover={{ scale: 1.15, y: -8 }}
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

      </GlassCard>
    </div>
  );
};
