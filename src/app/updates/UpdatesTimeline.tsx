"use client";

import Link from "next/link";
import { useState } from "react";
import { UpdateLinks } from "./UpdateLinks";
import { BuildSite } from "@/components/BuildSite";
import { updateId, type Update, type UpdateLink, type UpdateTag } from "@/lib/updates";
import styles from "./updates.module.css";

const FILTERS: { key: string; label: string; tags: readonly UpdateTag[] }[] = [
  { key: "all", label: "All", tags: ["New bank", "New papers", "Feature", "Improvement"] },
  { key: "content", label: "New banks & papers", tags: ["New bank", "New papers"] },
  { key: "features", label: "Features", tags: ["Feature"] },
  { key: "fixes", label: "Improvements", tags: ["Improvement"] },
];
const PAGE = 15;

/** One plain link makes the whole row clickable; several stay as separate links. */
const soleLink = (links: readonly UpdateLink[] = []) => links.length === 1 && !("options" in links[0]) ? links[0] : undefined;

const parse = (date: string) => new Date(`${date}T00:00:00Z`);
const day = (date: string) => parse(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const monthName = (date: string) => parse(date).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** Month → day → updates, keeping the newest-first order. */
function group(updates: readonly Update[]) {
  const months: { month: string; days: { date: string; updates: Update[] }[] }[] = [];
  for (const update of updates) {
    const month = update.date.slice(0, 7);
    if (months.at(-1)?.month !== month) months.push({ month, days: [] });
    const days = months.at(-1)!.days;
    if (days.at(-1)?.date !== update.date) days.push({ date: update.date, updates: [] });
    days.at(-1)!.updates.push(update);
  }
  return months;
}

function Entry({ update }: { update: Update }) {
  const only = soleLink(update.links);
  return (
    <li id={updateId(update)} className={styles.entry} data-linked={only ? "true" : undefined} data-tag={update.tag} data-subject-tone={update.tone}>
      <div className={styles.entryHead}>
        <h4>{only ? <Link className={styles.stretch} href={only.href}>{update.title}</Link> : update.title}</h4>
        <span className={styles.tag} data-tag={update.tag}>{update.tag}</span>
        {only && <span className={styles.go} aria-hidden="true">{only.label} →</span>}
      </div>
      <p>{update.body}</p>
      {!only && <UpdateLinks links={update.links} />}
    </li>
  );
}

export function UpdatesTimeline({ updates, comingSoon }: { updates: readonly Update[]; comingSoon: readonly string[] }) {
  const [filter, setFilter] = useState(FILTERS[0]);
  const [shown, setShown] = useState(PAGE);
  const list = updates.filter((update) => filter.tags.includes(update.tag));

  return (
    <section className={styles.log} aria-labelledby="all-updates">
      <div className={styles.logHead}>
        <h2 id="all-updates" className="sr-only">All updates</h2>
        <div className={styles.tabs} role="group" aria-label="Filter updates">
          {FILTERS.map((option) => (
            <button key={option.key} type="button" aria-pressed={option.key === filter.key} onClick={() => { setFilter(option); setShown(PAGE); }}>
              {option.label}<span>{updates.filter((update) => option.tags.includes(update.tag)).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.timeline}>
        <section className={styles.soon} aria-labelledby="coming-soon">
          <p className={styles.dayDate}>Soon</p>
          <div className={styles.soonBody}>
            <h3 id="coming-soon" className={styles.soonLabel}>Being built</h3>
            <ul>{comingSoon.map((item, index) => <li key={item}><BuildSite text={item} offset={index * .27} /></li>)}</ul>
          </div>
        </section>

        {group(list.slice(0, shown)).map(({ month, days }) => (
          <section key={month} className={styles.monthGroup} aria-label={monthName(`${month}-01`)}>
            <h3 className={styles.month}>{monthName(`${month}-01`)}</h3>
            <ol className={styles.days}>
              {days.map(({ date, updates: entries }) => (
                <li key={date} className={styles.day}>
                  <time className={styles.dayDate} dateTime={date}>{day(date)}</time>
                  <ul className={styles.entries}>{entries.map((update) => <Entry key={update.title} update={update} />)}</ul>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      {list.length > shown && <button type="button" className={styles.more} onClick={() => setShown(list.length)}>Show all {list.length} updates</button>}
    </section>
  );
}
