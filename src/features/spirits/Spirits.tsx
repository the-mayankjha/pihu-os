import { useEffect, useRef, useState } from 'react';
import { isTauri, invoke } from '@tauri-apps/api/core';
import { emit, emitTo, listen } from '@tauri-apps/api/event';
import { cursorPosition, getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import { SpiritToolbar } from './SpiritToolbar';
import { useLayoutStore } from '../../core/layout/LayoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAgentActivityStore } from '../../core/agent/activityStore';
import { useTTSPlaybackStore } from '../../core/voice/tts/playbackStore';
import { useOrbStore } from '../../core/orb/OrbStore';
import { useVoiceStore } from '../../stores/voiceStore';
import { bundledSpirits } from './catalog';
import { useSpiritsStore } from './store';
import { SpiritSprite } from './SpiritSprite';
import { useSpiritSocial } from './useSpiritSocial';
import type { SpiritActivity, SpiritAnimation, SpiritShortcut, ToolbarPreferences } from './model';
import { ANIMATIONS, SPIRIT_SHORTCUTS, normalizeShortcuts, normalizeToolbar, dragAnimation, lookDirection, safeSpiritSize, spiritActivity, pihuPose } from './model';

const ACTIVITY_EVENT = 'pihu-spirit-activity';
const SHORTCUT_EVENT = 'pihu-spirit-shortcut';

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
  const { enabled, activeIds, size, customSpirits, setError, shortcuts, toolbar } = useSpiritsStore();
  const orb = useOrbStore(s => s.currentState);
  const pending = useVoiceStore(s => Boolean(s.pendingEmailAction || s.pendingProjectAction || s.pendingWhatsAppAction));
  const reviewing = useVoiceStore(s => s.isCommandPaletteOpen);
  const processing = useVoiceStore(s => Boolean(s.processingStatus));
  const agent = useAgentActivityStore(s => s.status);
  const speaking = useTTSPlaybackStore(s => s.active.length > 0);
  const { animation, resting, speaking: playbackSpeaking } = spiritActivity(orb, agent, pending, reviewing, processing, speaking);
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
    if (isTauri()) void emit(ACTIVITY_EVENT, { animation, resting, speaking: playbackSpeaking, shortcuts, toolbar }).catch(console.error);
  }, [animation, resting, playbackSpeaking, shortcuts, toolbar]);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen('pihu-spirit-ready', () => { void emit(ACTIVITY_EVENT, { animation, resting, speaking: playbackSpeaking, shortcuts, toolbar }); }).then(stop => { if (disposed) stop(); else unlisten = stop; });
    return () => { disposed = true; unlisten?.(); };
  }, [animation, resting, playbackSpeaking, shortcuts, toolbar]);
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
  return <div className="fixed bottom-24 right-6 flex items-end gap-3 pointer-events-none" style={{ zIndex: 10000 }}>{ids.map(id => <div key={id} className="pointer-events-auto"><SpiritCompanion id={id} size={size} animation={animation} resting={resting} speaking={playbackSpeaking} shortcuts={shortcuts} toolbar={toolbar} /></div>)}</div>;
}

function SpiritCompanion({ id, size, animation, resting = false, speaking = false, shortcuts, toolbar }: { id: string; size: number; animation: SpiritAnimation; resting?: boolean; speaking?: boolean; shortcuts: SpiritShortcut[]; toolbar: ToolbarPreferences }) {
  const [held, setHeld] = useState(false);
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
  const [idleMs, setIdleMs] = useState(0);
  const idleEligible = id === 'pihu' && animation === 'idle' && !resting && !speaking && !dragging && !interaction;
  useEffect(() => {
    const started = Date.now();
    const reset = setTimeout(() => setIdleMs(0), 0);
    const interval = idleEligible ? setInterval(() => setIdleMs(Date.now() - started), 250) : undefined;
    return () => { clearTimeout(reset); clearInterval(interval); };
  }, [idleEligible]);
  const social = useSpiritSocial(id, size, animation !== 'idle' || resting || speaking || held || Boolean(dragging || interaction), element, (dx, dy) => setOffset(previous => ({ x: previous.x + dx, y: previous.y + dy })));
  const personal = id === 'pihu' ? pihuPose(animation, speaking, idleEligible ? idleMs : 0) : animation;
  const shown = dragging ?? (speaking || animation !== 'idle' ? personal : interaction ?? social.animation ?? personal);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const hideShortcuts = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revealShortcuts = () => {
    clearTimeout(hideShortcuts.current);
    setShortcutsOpen(true);
    if (toolbar.mode === 'auto') hideShortcuts.current = setTimeout(() => setShortcutsOpen(false), toolbar.delay);
  };
  useEffect(() => () => clearTimeout(hideShortcuts.current), []);
  // Non-activating macOS panels can miss WebKit pointer-enter/move events
  // while another app owns focus. Sample the global cursor without focusing.
  useEffect(() => {
    if (!isTauri() || !['auto', 'hover'].includes(toolbar.mode)) return;
    let disposed = false;
    let sampling = false;
    let inside = false;
    let last: { x: number; y: number } | undefined;
    const sample = async () => {
      if (disposed || sampling) return;
      sampling = true;
      try {
        const current = getCurrentWindow();
        const [cursor, position, factor] = await Promise.all([cursorPosition(), current.outerPosition(), current.scaleFactor()]);
        if (disposed) return;
        const bounds = element.current?.getBoundingClientRect();
        if (!bounds) return;
        const x = (cursor.x - position.x) / factor;
        const y = (cursor.y - position.y) / factor;
        const over = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
        const moved = !last || cursor.x !== last.x || cursor.y !== last.y;
        if (over && !dragging && (!inside || moved)) {
          clearTimeout(hideShortcuts.current);
          setShortcutsOpen(true);
          if (toolbar.mode === 'auto') hideShortcuts.current = setTimeout(() => setShortcutsOpen(false), toolbar.delay);
        } else if (!over && inside && toolbar.mode === 'hover') setShortcutsOpen(false);
        inside = over;
        last = { x: cursor.x, y: cursor.y };
      } catch (error) { console.debug('Spirit shortcut hover unavailable:', error); }
      finally { sampling = false; }
    };
    void sample();
    const interval = setInterval(() => { void sample(); }, 100);
    return () => { disposed = true; clearInterval(interval); clearTimeout(hideShortcuts.current); };
  }, [toolbar.mode, toolbar.delay, dragging]);
  const expanded = toolbar.mode === 'always' || (toolbar.mode !== 'hidden' && shortcutsOpen);
  const name = [...bundledSpirits, ...useSpiritsStore.getState().customSpirits].find(s => s.id === id)?.name ?? 'Spirit';
  return <div ref={element} data-spirit-id={id} data-spirit-state={shown} data-spirit-social={social.pair?.action} data-shortcuts-open={expanded && !dragging} data-shortcuts-mode={toolbar.mode}
    onPointerEnter={revealShortcuts} onPointerMove={event => { if (event.buttons === 0) revealShortcuts(); }}
    onPointerLeave={() => { if (toolbar.mode === 'hover') setShortcutsOpen(false); }}
    onKeyDown={revealShortcuts} onFocusCapture={event => { if (event.target.matches(':focus-visible')) revealShortcuts(); }} className="spirit-companion group flex flex-col items-center select-none" style={{ width: '100%', height: '100%', background: 'transparent', transform: isTauri() ? undefined : `translate(${offset.x}px, ${offset.y}px)` }}>
    <button type="button" aria-label={`${name}: hover or click to say hi, drag to move`} title={`${name} · Hover to say hi · Double-click to hop · Drag to move`} style={{ cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', border: 0, padding: 0, background: 'transparent' }}
      onDoubleClick={() => { if (!pointer.current.dragged) play('jumping'); }}
      onPointerEnter={event => {
        if (event.pointerType !== 'touch' && event.buttons === 0 && !pointer.current.pressed) play('waving');
      }}
      onFocus={() => { if (!pointer.current.pressed) play('waving'); }}
      onPointerDown={event => {
        if (event.button !== 0) return;
        setHeld(true);
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
          pointer.current.pressed = false; setHeld(false);
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
        pointer.current.pressed = false; setHeld(false);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (pointer.current.dragged) { setDragging(null); play('jumping'); }
      }}
      onPointerCancel={() => { setHeld(false); pointer.current.pressed = false; setDragging(null); }}
      onLostPointerCapture={() => { if (pointer.current.pressed) { setHeld(false); pointer.current.pressed = false; setDragging(null); } }}
      onClick={event => { if (event.detail === 0 || !pointer.current.dragged) play('waving'); }}>
      <SpiritSprite id={id} size={size} animation={shown} pair={social.pair} resting={!dragging && !interaction && resting} direction={shown === 'idle' && !resting ? social.direction ?? direction : null} />
    </button>
    <SpiritToolbar name={name} size={size} shortcuts={shortcuts} disabled={Boolean(dragging)} onShortcut={shortcut => {
      setShortcutsOpen(false);
      void (isTauri() ? emitTo('main', SHORTCUT_EVENT, shortcut) : runShortcut(shortcut)).catch(error => useSpiritsStore.getState().setError(String(error)));
    }} />
  </div>;
}

export function SpiritWindow({ id }: { id: string }) {
  const [activity, setActivity] = useState<SpiritActivity>({ animation: 'idle', resting: false });
  const [size, setSize] = useState(safeSpiritSize(window.innerWidth));
  const [toolbar, setToolbar] = useState<ToolbarPreferences>(normalizeToolbar(useSpiritsStore.getState().toolbar));
  const [shortcuts, setShortcuts] = useState<SpiritShortcut[]>(normalizeShortcuts(useSpiritsStore.getState().shortcuts));
  useEffect(() => {
    const resize = () => setSize(safeSpiritSize(window.innerWidth));
    window.addEventListener('resize', resize);
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (isTauri()) void listen<SpiritActivity & { shortcuts?: unknown; toolbar?: unknown }>(ACTIVITY_EVENT, event => { if (event.payload?.animation in ANIMATIONS) { setActivity(event.payload); setShortcuts(normalizeShortcuts(event.payload.shortcuts)); setToolbar(normalizeToolbar(event.payload.toolbar)); } }).then(stop => {
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
  return <SpiritCompanion id={id} size={size} animation={activity.animation} resting={activity.resting} speaking={activity.speaking} shortcuts={shortcuts} toolbar={toolbar} />;
}
