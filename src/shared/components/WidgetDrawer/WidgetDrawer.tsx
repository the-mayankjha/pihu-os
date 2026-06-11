import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from '../GlassCard/GlassCard';
import { useLayoutStore } from '../../../core/layout/LayoutStore';
import { OrbWidget } from '../../../widgets/orb/OrbWidget';
import { ClockWidget } from '../../../widgets/clock/ClockWidget';
import { MusicWidget } from '../../../widgets/music/MusicWidget';

export const WidgetDrawer: React.FC = () => {
  const { isWidgetDrawerOpen, toggleWidgetDrawer, spawnWidget } = useLayoutStore();

  const handleWidgetClick = (widgetId: string) => {
    // Spawn the widget slightly offset from the center
    const x = window.innerWidth / 2 - 150; 
    const y = window.innerHeight / 2 - 200;
    spawnWidget(widgetId, { x, y });
    toggleWidgetDrawer(); // Automatically close drawer after adding
  };

  return (
    <AnimatePresence>
      {isWidgetDrawerOpen && (
        <>
          {/* Invisible backdrop to close the drawer when clicking outside */}
          <div 
            className="absolute inset-0 z-40" 
            onClick={toggleWidgetDrawer}
          />
          
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 h-full w-[400px] p-4 z-50 flex flex-col"
          >
            <GlassCard 
              blur="lg" 
              frost="heavy" 
              className="w-full h-full p-6 flex flex-col gap-6"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <h2 className="text-xl font-semibold text-white/90">Widgets</h2>
                <button 
                  onClick={toggleWidgetDrawer}
                  className="text-white/50 hover:text-white/90 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pb-10">
                <p className="text-xs text-white/50 mb-6">Click a widget to add it to your screen</p>
                
                <div className="flex flex-col gap-8 items-center">
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">AI Orb</span>
                    <OrbWidget preview onClick={() => handleWidgetClick('orb-widget')} />
                  </div>
                  
                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Music Player</span>
                    <MusicWidget preview onClick={() => handleWidgetClick('music-widget')} />
                  </div>

                  <div className="w-full flex flex-col gap-2 items-center">
                    <span className="text-sm font-medium text-white/80">Clock</span>
                    <ClockWidget preview onClick={() => handleWidgetClick('clock-widget')} />
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
