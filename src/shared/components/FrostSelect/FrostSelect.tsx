import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

interface Props { value: string; options: {value:string;label:string}[]; onChange:(value:string)=>void; label:string }
export function FrostSelect({value,options,onChange,label}:Props) {
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const [bounds,setBounds]=useState({left:0,top:0,width:0});
  const button=useRef<HTMLButtonElement>(null);
  const menu=useRef<HTMLDivElement>(null);
  const id=useId();
  useEffect(()=>{
    if(!open)return;
    const position=()=>{const rect=button.current!.getBoundingClientRect();setBounds({left:rect.left,top:Math.max(8,Math.min(rect.bottom+6,window.innerHeight-220)),width:rect.width});};
    const outside=(e:PointerEvent)=>{if(!button.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))setOpen(false);};
    position();document.addEventListener('pointerdown',outside);window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
    return ()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};
  },[open]);
  const choose=(index:number)=>{onChange(options[index].value);setOpen(false);button.current?.focus();};
  return <>
    <button ref={button} type="button" role="combobox" aria-label={label} aria-expanded={open} aria-controls={id} aria-haspopup="listbox" aria-activedescendant={open?`${id}-${active}`:undefined}
      onClick={()=>{setActive(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(!open);}}
      onKeyDown={event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);}
        else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(!open){setActive(Math.max(0,options.findIndex(option=>option.value===value)));setOpen(true);}else setActive(index=>(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);}
        else if(open&&(event.key==='Enter'||event.key===' ')){event.preventDefault();choose(active);}
        else if(event.key==='Tab')setOpen(false);
      }}
      className="mt-2 flex w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-xs text-white backdrop-blur-xl hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition">
      {options.find(option=>option.value===value)?.label}<ChevronDown size={14} className={`text-neutral-400 transition ${open?'rotate-180':''}`} />
    </button>
    {open&&createPortal(<div ref={menu} id={id} role="listbox" aria-label={label} style={{position:'fixed',...bounds,zIndex:1000}} className="max-h-52 overflow-auto rounded-xl border border-white/20 bg-neutral-900/85 p-1.5 shadow-2xl backdrop-blur-3xl">
      {options.map((option,index)=><div key={option.value} id={`${id}-${index}`} role="option" aria-selected={value===option.value} onMouseEnter={()=>setActive(index)} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(index)} className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-xs text-white ${index===active?'bg-white/15':'hover:bg-white/10'}`}>
        {option.label}{value===option.value&&<Check size={13} />}
      </div>)}
    </div>,document.body)}
  </>;
}
