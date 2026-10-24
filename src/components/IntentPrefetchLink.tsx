"use client";

import Link from 'next/link';
import { useState, type ComponentProps } from 'react';

/** Dense catalogs defer Next's automatic prefetch until pointer, keyboard or touch intent. */
export function IntentPrefetchLink({ onPointerEnter, onMouseEnter, onFocus, onTouchStart, ...props }: Omit<ComponentProps<typeof Link>, 'prefetch'>) {
  // Compare URL values, not UrlObject identity; equivalent server props can be recreated.
  const destination = JSON.stringify([props.href, props.as]);
  const [intent, setIntent] = useState({ destination, active: false });
  if (intent.destination !== destination) setIntent({ destination, active: false });
  const active = intent.destination === destination && intent.active;
  const activate = () => setIntent({ destination, active: true });
  return <Link {...props} prefetch={active ? null : false}
    onPointerEnter={event => { onPointerEnter?.(event); activate(); }}
    onMouseEnter={event => { onMouseEnter?.(event); activate(); }}
    onFocus={event => { onFocus?.(event); activate(); }}
    onTouchStart={event => { onTouchStart?.(event); activate(); }}
  />;
}
