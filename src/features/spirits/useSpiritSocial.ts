import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { isTauri } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window';
import { lookDirection, nearestSpirit } from './model';
import type { SpiritAnimation, SpiritPresence } from './model';
import { SOCIAL_ACTIONS, SOCIAL_TIMING, socialAligned, socialCompanion, socialPhase, socialNearby, socialTrioNearby, socialStep, socialTarget, validEncounter } from './socialModel';
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
      const incoming = value.encounter;
      const mayJoinStory = Boolean(incoming?.third && !encounter.current?.third);
      if (!busy && !value.busy && (!encounter.current || mayJoinStory) && now >= cooldown.current && validEncounter(incoming!, id, now)
        && (incoming!.members.includes(value.id) || incoming!.third === value.id)) {
        encounter.current = incoming;
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
        const peerId = session ? (session.third === id ? session.members.find(member => member !== 'mayank')! : session.members.find(member => member !== id)!) : undefined;
        const peer = session ? peers.current.get(peerId!) : nearestSpirit(self, [...peers.current.values()], now);
        let third = session?.third ? peers.current.get(session.third === id ? session.members.find(member => member !== id && member !== 'mayank')! : session.third) : undefined;
        if (session && !session.third && id === 'mayank' && peer && !busy) {
          const newcomer = [...peers.current.values()].find(candidate => candidate.id !== peer.id && candidate.id !== id
            && ['pihu', 'piyu'].includes(candidate.id) && !candidate.busy && now - candidate.at < 1600
            && Math.abs(candidate.size - size) < 2 && socialTrioNearby(self, candidate) && socialTrioNearby(peer, candidate));
          if (newcomer) {
            session = { ...session, third: newcomer.id, started: now };
            third = newcomer;
            encounter.current = session;
          }
        }
        const storyFemale = [peer, third].find(candidate => candidate && candidate.id !== id && ['pihu', 'piyu'].includes(candidate.id));
        const closeToStoryPartner = Boolean(session?.third && storyFemale && socialTrioNearby(self, storyFemale));
        const closeToEither = Boolean(session?.third && id === 'mayank' && (peer && socialTrioNearby(self, peer) || third && socialTrioNearby(self, third)));
        if (session && (busy || !peer || peer.busy || Math.abs(peer.size - size) >= 2 || (!socialNearby(self, peer) && !closeToStoryPartner && !closeToEither)
          || (session.third && (!third || third.busy || Math.abs(third.size - size) >= 2)))) {
          encounter.current = undefined; session = undefined; cooldown.current = now + SOCIAL_TIMING.cooldown;
        }
        if (!session && !busy && peer && now >= cooldown.current && id.localeCompare(peer.id) < 0
          && socialCompanion([id, peer.id]) !== null && Math.abs(size - peer.size) < 2) {
          const extras = [...peers.current.values()].filter(candidate => candidate.id !== peer.id && candidate.id !== id
            && ['pihu', 'piyu'].includes(candidate.id) && !candidate.busy && now - candidate.at < 1600
            && socialTrioNearby(self, candidate) && socialTrioNearby(peer, candidate));
          const third = extras.find(candidate => candidate.id === 'pihu' || candidate.id === 'piyu');
          session = { members: x <= peer.x ? [id, peer.id] : [peer.id, id], ...(third ? { third: third.id } : {}), started: now,
            x: (id !== 'mayank' ? x : peer.x) + ((x <= peer.x ? id : peer.id) !== 'mayank' ? 1 : -1) * size / 2,
            y: id !== 'mayank' ? y : peer.y, size, action: SOCIAL_ACTIONS[sequence.current++ % SOCIAL_ACTIONS.length] };
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
          const turnStarted = session.started + 5500;
          const jealousStarted = session.started + 8300;
          const fightStarted = session.started + 11200;
          const fightAt = fightStarted + 2500;
          const reconcileStarted = fightAt + 8 * 850;
          const storyEnd = reconcileStarted + 4 * 700;
          const isFemale = id === 'pihu' || id === 'piyu';
          if (session.third && id === session.third && elapsed >= 5500 && elapsed < 8300) {
            next.pair = { companion: id === 'piyu' ? 'piyu' : 'pihu', action: 'turning', column: 0, mirrored: false,
              started: turnStarted, frameCount: 4, soloKey: `${id}:turning` };
          } else if (session.third && id === session.third && elapsed >= 8300 && elapsed < 11200) {
            next.pair = { companion: id === 'piyu' ? 'piyu' : 'pihu', action: 'jealous', column: 0, mirrored: false,
              started: jealousStarted, frameCount: 4, soloKey: `${id}:jealous` };
          } else if (session.third && isFemale && elapsed >= 11200 && elapsed < reconcileStarted) {
            const femaleIds: [string, string] = ['pihu', 'piyu'];
            const otherFemaleId = femaleIds.find(member => member !== id)!;
            const otherFemale = peers.current.get(otherFemaleId);
            if (otherFemale && socialTrioNearby(self, otherFemale)) {
              const fightSession: SocialEncounter = { ...session, members: femaleIds, x: (self.x + otherFemale.x) / 2, y: (self.y + otherFemale.y) / 2 };
              const target = socialTarget(fightSession, id);
              if (!motion.matches && Math.hypot(self.x - target.x, self.y - target.y) > 5) {
                const step = socialStep(self, target, dt);
                if (current) await current.setPosition(new LogicalPosition(x - size / 2 + step.x, y - size * 208 / 192 / 2 + step.y));
                else move.current(step.x, step.y);
                self.x += step.x; self.y += step.y;
                next.animation = step.x >= 0 ? 'running-right' : 'running-left';
              } else if (!motion.matches && elapsed >= fightAt) {
                next.pair = { companion: 'pihu', action: 'fight', column: id === 'pihu' ? 0 : 1,
                  mirrored: self.x > otherFemale.x, started: fightAt, frameCount: 8 };
              }
            }
          } else if (session.third && isFemale && elapsed >= reconcileStarted && elapsed < storyEnd) {
            next.pair = { companion: 'pihu', action: 'reconcile', column: id === 'pihu' ? 0 : 1,
              mirrored: peers.current.get('pihu')?.x! > peers.current.get('piyu')?.x!, started: reconcileStarted, frameCount: 4 };
          } else if (session.third && id === 'mayank' && elapsed >= fightStarted && elapsed < storyEnd) {
            next.pair = { companion: 'pihu', action: 'mediating', column: 0, mirrored: false,
              started: fightStarted, frameCount: 4, soloKey: 'pihu:mediating' };
          } else if (session.third && elapsed >= storyEnd && session.members.includes(id) && !motion.matches && socialAligned(self, peer, session)) {
            next.pair = { ...socialPhase(session, now), companion: socialCompanion(session.members)!, column: id === 'mayank' ? 0 : 1,
              mirrored: session.members[0] !== 'mayank' };
          } else if (!session.third && !motion.matches && elapsed >= SOCIAL_TIMING.approach && socialAligned(self, peer, session)) {
            next.pair = { ...socialPhase(session, now), companion: socialCompanion(session.members)!, column: id === 'mayank' ? 0 : 1, mirrored: session.members[0] !== 'mayank' };
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
