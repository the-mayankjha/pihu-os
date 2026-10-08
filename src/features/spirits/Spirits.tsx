import { useEffect, useRef, useState } from 'react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { emit, emitTo, listen } from '@tauri-apps/api/event';
import { cursorPosition, getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import { Mic, Settings, Command, ListTodo, LayoutGrid, Music } from 'lucide-react';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAgentActivityStore } from '../../core/agent/activityStore';
import { useOrbStore } from '../../core/orb/OrbStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { bundledSpirits } from './catalog';
import { useSpiritsStore } from './store';
import { SpiritSprite } from './SpiritSprite';
import type { SpiritActivity, SpiritAnimation, SpiritShortcut } from './model';
import { ANIMATIONS, SPIRIT_SHORTCUTS, normalizeShortcuts, dragAnimation, lookDirection, safeSpiritSize, spiritActivity } from './model';

const ACTIVITY_EVENT = 'pihu-spirit-activity';
const SHORTCUT_EVENT = 'pihu-spirit-shortcut';
const SHORTCUT_ICONS = { voice: Mic, settings: Settings, commands: Command, tasks: ListTodo, widgets: LayoutGrid, music: Music };

async function runShortcut(shortcut: SpiritShortcut) {
  if (shortcut === 'voice') {
    const { VoiceManager } = await import('../../core/voice/VoiceManager');
    const manager = VoiceManager.getInstance();
    if (useVoiceStore.getState().isListening) manager.stopListening();
    else await manager.startListening();
    return;
  }
  if (isTauri()) { const main = getCurrentWindow(); await main.show(); await main.unminimize(); await main.setFocus(); }
  const layout = useLayoutStore.getState();
  if (shortcut === 'commands') useVoiceStore.getState().setIsCommandPaletteOpen(true);
  else if (shortcut === 'widgets') { if (!layout.isWidgetDrawerOpen) layout.toggleWidgetDrawer(); }
  else {
    const id = { settings: 'settings-window', tasks: 'task-window', music: 'ytmusic-plugin' }[shortcut];
    if (shortcut === 'settings') useSettingsStore.getState().setActiveSidebarCategory('spirits');
    if (!layout.widgets[id]?.isOpen) layout.toggleWidget(id);
  }
}

export function SpiritsHost() {
  const { enabled, activeIds, size, customSpirits, setError, shortcuts } = useSpiritsStore();
  const orb = useOrbStore(s => s.currentState);
  const pending = useVoiceStore(s => Boolean(s.pendingEmailAction || s.pendingProjectAction || s.pendingWhatsAppAction));
  const reviewing = useVoiceStore(s => s.isCommandPaletteOpen);
  const processing = useVoiceStore(s => Boolean(s.processingStatus));
  const agent = useAgentActivityStore(s => s.status);
  const { animation, resting } = spiritActivity(orb, agent, pending, reviewing, processing);
  const ids = enabled ? activeIds.filter(id => [...bundledSpirits, ...customSpirits].some(s => s.id === id)) : [];
  const selection = JSON.stringify(ids);
  // Serialize changes: rapid resizing/toggling must not leave stale windows behind.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    if (!isTauri()) return;
    queue.current = queue.current.catch(() => {}).then(() => {
      const ids: string[] = JSON.parse(selection);
      const positions = Object.fromEntries(ids.flatMap(id => {
        try {
          const position = JSON.parse(localStorage.getItem(`pihu-spirit-position-${id}`) ?? 'null');
          return position && Number.isFinite(position.x) && Number.isFinite(position.y) ? [[id, position]] : [];
        } catch { return []; }
      }));
      return invoke('sync_spirits', { ids, size, positions });
    }).then(() => setError(null)).catch(error => setError(String(error)));
  }, [selection, size, setError]);
  useEffect(() => {
    if (isTauri()) void emit(ACTIVITY_EVENT, { animation, resting, shortcuts }).catch(console.error);
  }, [animation, resting, shortcuts]);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen('pihu-spirit-ready', () => { void emit(ACTIVITY_EVENT, { animation, resting, shortcuts }); }).then(stop => { if (disposed) stop(); else unlisten = stop; });
    return () => { disposed = true; unlisten?.(); };
  }, [animation, resting, shortcuts]);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<string>(SHORTCUT_EVENT, event => {
      if (typeof event.payload === 'string' && Object.hasOwn(SPIRIT_SHORTCUTS, event.payload)) {
        void runShortcut(event.payload as SpiritShortcut).catch(error => setError(String(error)));
      }
    }).then(stop => { if (disposed) stop(); else unlisten = stop; });
    return () => { disposed = true; unlisten?.(); };
  }, [setError]);
  if (isTauri()) return null;
  return <div className="fixed bottom-24 right-6 flex items-end gap-3 pointer-events-none" style={{ zIndex: 10000 }}>{ids.map(id => <div key={id} className="pointer-events-auto"><SpiritCompanion id={id} size={size} animation={animation} resting={resting} shortcuts={shortcuts} /></div>)}</div>;
}

function SpiritCompanion({ id, size, animation, resting = false, shortcuts }: { id: string; size: number; animation: SpiritAnimation; resting?: boolean; shortcuts: SpiritShortcut[] }) {
  const [interaction, setInteraction] = useState<SpiritAnimation | null>(null);
  const [dragging, setDragging] = useState<SpiritAnimation | null>(null);
  const [direction, setDirection] = useState<number | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const element = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const pointer = useRef({ x: 0, y: 0, lastX: 0, dragged: false, pressed: false, offset: { x: 0, y: 0 } });
  const origin = useRef<Promise<{ x: number; y: number }>>(Promise.resolve({ x: 0, y: 0 }));
  const latestMove = useRef<{ dx: number; dy: number; origin: Promise<{ x: number; y: number }> } | null>(null);
  const moving = useRef(false);
  const moveNative = async () => {
    if (moving.current) return;
    moving.current = true;
    try {
      while (latestMove.current) {
        const move = latestMove.current;
        latestMove.current = null;
        const start = await move.origin;
        await getCurrentWindow().setPosition(new LogicalPosition(start.x + move.dx, start.y + move.dy));
      }
    } catch (error) { console.error('Could not move Spirit:', error); }
    finally { moving.current = false; }
  };
  const play = (state: SpiritAnimation) => {
    clearTimeout(timer.current);
    setInteraction(state);
    const config = ANIMATIONS[state];
    timer.current = setTimeout(() => setInteraction(null), 1000 * config.frames / config.fps);
  };
  useEffect(() => () => { clearTimeout(timer.current); if (frame.current !== undefined) cancelAnimationFrame(frame.current); }, []);
  useEffect(() => {
    if (animation !== 'idle' || resting) return;
    let disposed = false;
    let sampling = false;
    let gazeTimer: ReturnType<typeof setTimeout> | undefined;
    let lastCursor: { x: number; y: number } | undefined;
    const update = (x: number, y: number) => {
      if (disposed) return;
      setDirection(lookDirection(x, y));
      clearTimeout(gazeTimer);
      gazeTimer = setTimeout(() => { if (!disposed) setDirection(null); }, 1200);
    };
    const follow = (event: PointerEvent) => {
      const bounds = element.current?.getBoundingClientRect();
      if (bounds) update(event.clientX - bounds.left - size / 2, event.clientY - bounds.top - size * 0.28);
    };
    const sample = async () => {
      if (sampling || pointer.current.pressed) return;
      sampling = true;
      try {
        const current = getCurrentWindow();
        const [cursor, position, factor] = await Promise.all([cursorPosition(), current.outerPosition(), current.scaleFactor()]);
        if (!lastCursor || cursor.x !== lastCursor.x || cursor.y !== lastCursor.y) {
          lastCursor = { x: cursor.x, y: cursor.y };
          update((cursor.x - position.x) / factor - size / 2, (cursor.y - position.y) / factor - size * 0.28);
        }
      } catch { /* Retain idle if the platform cannot report global cursor position. */ }
      finally { sampling = false; }
    };
    const interval = isTauri() ? setInterval(() => { void sample(); }, 200) : undefined;
    if (!isTauri()) window.addEventListener('pointermove', follow);
    return () => { disposed = true; clearInterval(interval); clearTimeout(gazeTimer); window.removeEventListener('pointermove', follow); };
  }, [animation, resting, size]);
  const shown = dragging ?? interaction ?? animation;
  const name = [...bundledSpirits, ...useSpiritsStore.getState().customSpirits].find(s => s.id === id)?.name ?? 'Spirit';
  return <div ref={element} data-spirit-state={shown} className="group flex flex-col items-center select-none" style={{ width: '100%', height: '100%', background: 'transparent', transform: isTauri() ? undefined : `translate(${offset.x}px, ${offset.y}px)` }}>
    <button type="button" aria-label={`${name}: hover or click to say hi, drag to move`} title={`${name} · Hover to say hi · Drag to move`} style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', border: 0, padding: 0, background: 'transparent' }}
      onPointerEnter={event => {
        if (event.pointerType !== 'touch' && event.buttons === 0 && !pointer.current.pressed) play('waving');
      }}
      onFocus={() => { if (!pointer.current.pressed) play('waving'); }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        pointer.current = { x: event.screenX, y: event.screenY, lastX: event.screenX, dragged: false, pressed: true, offset };
        event.currentTarget.setPointerCapture(event.pointerId);
        if (isTauri()) {
          const current = getCurrentWindow();
          origin.current = Promise.all([current.outerPosition(), current.scaleFactor()]).then(([position, factor]) => position.toLogical(factor));
          void origin.current.catch(console.error);
        }
      }}
      onPointerMove={event => {
        if (!pointer.current.pressed || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        if (event.buttons === 0) {
          pointer.current.pressed = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(null);
          if (pointer.current.dragged) play('jumping');
          return;
        }
        const dx = event.screenX - pointer.current.x;
        const dy = event.screenY - pointer.current.y;
        if (!pointer.current.dragged && Math.hypot(dx, dy) <= 5) return;
        pointer.current.dragged = true;
        clearTimeout(timer.current);
        setInteraction(null);
        const delta = event.screenX - pointer.current.lastX;
        pointer.current.lastX = event.screenX;
        setDragging(previous => dragAnimation(delta, previous ?? 'running-right'));
        if (isTauri()) {
          latestMove.current = { dx, dy, origin: origin.current };
          if (frame.current !== undefined) cancelAnimationFrame(frame.current);
          frame.current = requestAnimationFrame(() => { frame.current = undefined; void moveNative(); });
        } else setOffset({ x: pointer.current.offset.x + dx, y: pointer.current.offset.y + dy });
      }}
      onPointerUp={event => {
        pointer.current.pressed = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (pointer.current.dragged) { setDragging(null); play('jumping'); }
      }}
      onPointerCancel={() => { pointer.current.pressed = false; setDragging(null); }}
      onLostPointerCapture={() => { if (pointer.current.pressed) { pointer.current.pressed = false; setDragging(null); } }}
      onClick={event => { if (event.detail === 0 || !pointer.current.dragged) play('waving'); }}>
      <SpiritSprite id={id} size={size} animation={shown} resting={!dragging && !interaction && resting} direction={shown === 'idle' && !resting ? direction : null} />
    </button>
    <div role="toolbar" aria-label={`${name} shortcuts`} className={`flex items-center justify-center gap-1 h-11 transition-opacity ${dragging ? 'opacity-0 pointer-events-none' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto'}`} style={{ width: size }}>
      {shortcuts.map((shortcut, index) => {
        const Icon = SHORTCUT_ICONS[shortcut];
        return <button key={index} type="button" aria-label={SPIRIT_SHORTCUTS[shortcut]} title={SPIRIT_SHORTCUTS[shortcut]}
          className="flex items-center justify-center rounded-full bg-neutral-950/55 backdrop-blur-xl border border-white/20 text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white/60"
          style={{ width: Math.min(34, (size - 8) / 3), height: Math.min(34, (size - 8) / 3), flexShrink: 0 }}
          onClick={() => { void (isTauri() ? emitTo('main', SHORTCUT_EVENT, shortcut) : runShortcut(shortcut)).catch(error => useSpiritsStore.getState().setError(String(error))); }}><Icon size={Math.min(16, size / 5)} /></button>;
      })}
    </div>
  </div>;
}

export function SpiritWindow({ id }: { id: string }) {
  const [activity, setActivity] = useState<SpiritActivity>({ animation: 'idle', resting: false });
  const [size, setSize] = useState(safeSpiritSize(window.innerWidth));
  const [shortcuts, setShortcuts] = useState<SpiritShortcut[]>(normalizeShortcuts(useSpiritsStore.getState().shortcuts));
  useEffect(() => {
    const resize = () => setSize(safeSpiritSize(window.innerWidth));
    window.addEventListener('resize', resize);
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (isTauri()) void listen<SpiritActivity & { shortcuts?: unknown }>(ACTIVITY_EVENT, event => { if (event.payload?.animation in ANIMATIONS) { setActivity(event.payload); setShortcuts(normalizeShortcuts(event.payload.shortcuts)); } }).then(stop => {
      if (disposed) stop(); else { unlisten = stop; void emit('pihu-spirit-ready'); }
    });
    return () => { disposed = true; unlisten?.(); window.removeEventListener('resize', resize); };
  }, []);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const current = getCurrentWindow();
    void current.onMoved(event => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void current.scaleFactor().then(factor => {
          if (!disposed) localStorage.setItem(`pihu-spirit-position-${id}`, JSON.stringify(event.payload.toLogical(factor)));
        }).catch(console.error);
      }, 150);
    }).then(stop => { if (disposed) stop(); else unlisten = stop; });
    return () => { disposed = true; clearTimeout(timer); unlisten?.(); };
  }, [id]);
  return <SpiritCompanion id={id} size={size} animation={activity.animation} resting={activity.resting} shortcuts={shortcuts} />;
}
