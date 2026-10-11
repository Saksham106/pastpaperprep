"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import styles from "./MarketingHome.module.css";

export type PickerBank = { slug: string; label: string; href: string };
export type PickerGroup = { id: string; label: string; banks: PickerBank[] };

/** Hero quick start: qualification, subject, go. "Start free" is a plain link, so the default works before hydration. */
export function HeroPicker({ groups }: { groups: readonly PickerGroup[] }) {
  const available = groups.filter((group) => group.banks.length > 0);
  const [groupId, setGroupId] = useState(available[0]?.id);
  const [slug, setSlug] = useState(available[0]?.banks[0]?.slug);
  const selectId = useId();
  const group = available.find((item) => item.id === groupId) ?? available[0];
  if (!group) return null;
  const bank = group.banks.find((item) => item.slug === slug) ?? group.banks[0];

  return <div className={styles.picker}>
    {available.length > 1 && <div className={styles.pickerToggle} role="group" aria-label="Qualification">
      {available.map((item) => <button key={item.id} type="button" aria-pressed={item.id === group.id} onClick={() => { setGroupId(item.id); setSlug(item.banks[0]?.slug); }}>{item.label}</button>)}
    </div>}
    <div className={styles.pickerField}>
      <label htmlFor={selectId}>Subject</label>
      <select id={selectId} value={bank.slug} onChange={(event) => setSlug(event.target.value)}>
        {group.banks.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}
      </select>
    </div>
    <Link className={styles.pickerGo} href={bank.href}>Start free <ArrowRight aria-hidden="true" weight="bold" /></Link>
  </div>;
}
