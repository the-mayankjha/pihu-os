import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import { lookDirection, nearestSpirit } from './model';
import type { SpiritAnimation, SpiritPresence } from './model';
import { SOCIAL_ACTIONS, SOCIAL_TIMING, socialAligned, socialNearby, socialStep, socialTarget, validEncounter } from './socialModel';
import type { PairPose, SocialEncounter } from './socialModel';

const EVENT = 'pihu-spirit-presence';
type Presence = SpiritPresence & { encounter?: SocialEncounter };
interface SocialPose { animation: SpiritAnimation | null; direction: number | null; pair: PairPose | null }
const EMPTY: SocialPose = { animation: null, direction: null, pair: null };

export function useSpiritSocial(id: string, size: number, busy: boolean, element: RefObject<HTMLDivElement | null>, shift: (dx: number, dy: number) => void): SocialPose {
  const peers = useRef(new Map<string, Presence>());
  const encounter = useRef<SocialEncounter | undefined>(undefined);
  const cooldown = useRef(0);
  const sequence = useRef(0);
  const move = useRef(shift);
  useEffect(() => { move.current = shift; }, [shift]);
  const [pose, setPose] = useState<SocialPose>(EMPTY);
  useEffect(() => {
    let disposed = false, sampling = false;
    let unlisten: (() => void) | undefined;
    let last = Date.now();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const receive = (value: Presence) => {
      if (!value || value.id === id || typeof value.id !== 'string' || !Number.isFinite(value.x) || !Number.isFinite(value.y) || !Number.isFinite(value.size) || value.size < 72 || value.size > 192) return;
      const now = Date.now();
      peers.current.set(value.id, { ...value, at: now });
      if (!busy && !value.busy && !encounter.current && now >= cooldown.current && validEncounter(value.encounter!, id, now)
        && value.encounter!.members.includes(value.id)) {
        encounter.current = value.encounter;
        cooldown.current = 0;
      }
    };
    const localReceive = (event: Event) => receive((event as CustomEvent<Presence>).detail);
    if (busy) { encounter.current = undefined; cooldown.current = Date.now() + SOCIAL_TIMING.cooldown; }
    if (isTauri()) void listen<Presence>(EVENT, event => receive(event.payload)).then(stop => { if (disposed) stop(); else unlisten = stop; }).catch(console.error);
    else window.addEventListener(EVENT, localReceive);
    const tick = async () => {
      if (disposed || sampling) return;
      sampling = true;
      try {
        let x: number, y: number;
        const current = isTauri() ? getCurrentWindow() : undefined;
        if (current) {
          const [position, factor] = await Promise.all([current.outerPosition(), current.scaleFactor()]);
          x = position.x / factor + size / 2;
          y = position.y / factor + size * 208 / 192 / 2;
        } else {
          const bounds = element.current?.getBoundingClientRect();
          if (!bounds) return;
          x = bounds.left + size / 2; y = bounds.top + size * 208 / 192 / 2;
        }
        if (disposed) return;
        const now = Date.now(), dt = now - last; last = now;
        const self: Presence = { id, x, y, size, busy, at: now };
        for (const [key, peer] of peers.current) if (now - peer.at > 1600) peers.current.delete(key);
        let session = encounter.current;
        const peer = session ? peers.current.get(session.members.find(member => member !== id)!) : nearestSpirit(self, [...peers.current.values()], now);
        if (session && (busy || !peer || peer.busy || Math.abs(peer.size - size) >= 2 || !socialNearby(self, peer))) {
          encounter.current = undefined; session = undefined; cooldown.current = now + SOCIAL_TIMING.cooldown;
        }
        if (!session && !busy && peer && now >= cooldown.current && id.localeCompare(peer.id) < 0
          && [id, peer.id].every(member => member === 'pihu' || member === 'mayank') && Math.abs(size - peer.size) < 2) {
          session = { members: x <= peer.x ? [id, peer.id] : [peer.id, id], started: now,
            x: (id === 'pihu' ? x : peer.x) + ((x <= peer.x ? id : peer.id) === 'pihu' ? 1 : -1) * size / 2,
            y: id === 'pihu' ? y : peer.y, size, action: SOCIAL_ACTIONS[sequence.current++ % SOCIAL_ACTIONS.length] };
          encounter.current = session; cooldown.current = now + SOCIAL_TIMING.cooldown;
        }
        let next: SocialPose = EMPTY;
        if (session && peer && !busy) {
          const elapsed = now - session.started;
          next = { animation: 'idle', direction: lookDirection(peer.x - x, peer.y - y), pair: null };
          const target = socialTarget(session, id);
          if (!motion.matches && elapsed >= SOCIAL_TIMING.gaze && elapsed < SOCIAL_TIMING.approach) {
            const step = socialStep(self, target, dt);
            if (Math.hypot(step.x, step.y) > 0.1) {
              next.animation = step.x >= 0 ? 'running-right' : 'running-left';
              if (current) await current.setPosition(new LogicalPosition(x - size / 2 + step.x, y - size * 208 / 192 / 2 + step.y));
              else move.current(step.x, step.y);
              self.x += step.x; self.y += step.y;
            }
          }
          if (!motion.matches && elapsed >= SOCIAL_TIMING.approach && socialAligned(self, peer, session)) {
            next.pair = { action: elapsed < SOCIAL_TIMING.action ? session.action : 'talking', column: id === 'mayank' ? 0 : 1, mirrored: session.members[0] === 'pihu', started: session.started + (elapsed < SOCIAL_TIMING.action ? SOCIAL_TIMING.approach : SOCIAL_TIMING.action) };
          }
        } else if (!busy && peer) next = { animation: null, direction: lookDirection(peer.x - x, peer.y - y), pair: null };
        self.encounter = encounter.current;
        if (current) await emit(EVENT, self); else window.dispatchEvent(new CustomEvent(EVENT, { detail: self }));
        if (!disposed) setPose(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      } catch (error) { console.debug('Spirit proximity unavailable:', error); }
      finally { sampling = false; }
    };
    void tick();
    const interval = setInterval(() => { void tick(); }, 100);
    return () => { disposed = true; clearInterval(interval); unlisten?.(); window.removeEventListener(EVENT, localReceive); };
  }, [id, size, busy, element]);
  return busy ? EMPTY : pose;
}
