import React from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from '../GlassCard/GlassCard';
import { useLayoutStore } from '../../../core/layout/LayoutStore';
import widgetIcon from '../../../assets/widget.png';

export const Dock: React.FC = () => {
  const { toggleWidgetDrawer, isWidgetDrawerOpen } = useLayoutStore();

  return (
    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-40">
      <GlassCard 
        blur="lg" 
        frost="medium" 
        className="px-4 py-3 rounded-[32px] flex items-center justify-center gap-4"
      >
        <motion.button
          onClick={toggleWidgetDrawer}
          whileHover={{ scale: 1.2, y: -10 }}
          whileTap={{ scale: 0.9 }}
          className={`relative rounded-2xl w-14 h-14 flex items-center justify-center transition-colors ${isWidgetDrawerOpen ? 'bg-white/20' : 'hover:bg-white/10'}`}
        >
          <img src={widgetIcon} alt="Widgets" className="w-10 h-10 object-contain drop-shadow-md" />
          
          {/* Active indicator dot */}
          {isWidgetDrawerOpen && (
            <motion.div 
              layoutId="active-indicator"
              className="absolute -bottom-2 w-1.5 h-1.5 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.8)]" 
            />
          )}
        </motion.button>
      </GlassCard>
    </div>
  );
};
