"use client";

import Link from "next/link";
import { ArrowRight, Books, Student } from "@phosphor-icons/react";
import { useRef, useState, type KeyboardEvent } from "react";
import { CourseIcon, type CourseTone } from "@/components/CourseIcon";
import type { Bank } from "@/lib/banks";
import styles from "./MarketingHome.module.css";

type SubjectGroup = { name: string; tone: CourseTone; banks: Bank[] };
type CatalogData = { id: string; title: string; description: string; icon: "cambridge" | "ib"; groups: SubjectGroup[] };

function bankVariant(bank: Bank): string {
  if (bank.qualification === "Cambridge IGCSE") return bank.title.replace("Cambridge IGCSE ", "");
  if (bank.subject.includes("AA")) return bank.subject.includes("HL") ? "AA HL" : "AA SL";
  if (bank.subject.includes("AI")) return bank.subject.includes("HL") ? "AI HL" : "AI SL";
  return bank.subject.includes("HL") ? "HL" : "SL";
}

function BankCard({ bank }: { bank: Bank }) {
  return <Link className={`${styles.bankCard} course-tone-${bankVariant(bank).toLowerCase().replaceAll(" ", "-")}`} href={`/banks/${bank.slug}?free=1`}><span className={styles.bankCardCopy}><strong>{bank.qualification === "Cambridge IGCSE" ? bank.title : bank.shortName}</strong><span className={styles.bankChips}><span>{bank.questionCount.toLocaleString()} questions</span><span>{bank.paperCount.toLocaleString()} papers</span><span>{bank.years}</span></span></span><ArrowRight aria-hidden="true" weight="bold" /></Link>;
}

function Catalog({ catalog }: { catalog: CatalogData }) {
  const count = catalog.groups.reduce((total, group) => total + group.banks.length, 0);
  return <section className={`${styles.catalog} ${catalog.icon === "ib" ? styles.catalogIb : styles.catalogCambridge}`} aria-labelledby={`${catalog.id}-heading`}><header className={styles.catalogHeader}><span className={styles.catalogMark} data-qualification-icon={catalog.icon === "cambridge" ? "igcse" : "ib"} aria-hidden="true">{catalog.icon === "cambridge" ? <Books weight="duotone" /> : <Student weight="duotone" />}</span><span className={styles.catalogHeading}><span className={styles.catalogTitleLine}><h3 id={`${catalog.id}-heading`}>{catalog.title}</h3><span className={styles.catalogCount}>{count} banks</span></span><p>{catalog.description}</p></span></header><div className={`${styles.subjectGrid} ${catalog.groups.length === 4 ? styles.subjectGridFour : ""} ${catalog.groups.length === 5 ? styles.subjectGridFive : ""}`}>{catalog.groups.map((subject) => { const bankCount = subject.banks.length; return <section className={`${styles.subjectGroup} course-tone-${subject.tone}`} key={subject.name} aria-labelledby={`${catalog.id}-${subject.tone}`}><header><CourseIcon tone={subject.tone} /><h4 id={`${catalog.id}-${subject.tone}`}>{subject.name}</h4></header><div data-bank-count={bankCount} className={`${styles.bankCards} ${bankCount === 1 ? styles.bankCardsSingle : bankCount === 2 ? styles.bankCardsTwo : styles.bankCardsMany}`}>{subject.banks.map((bank) => <BankCard bank={bank} key={bank.slug} />)}</div></section>; })}</div></section>;
}

export function QualificationTabs({ catalogs }: { catalogs: CatalogData[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % catalogs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + catalogs.length) % catalogs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = catalogs.length - 1;
    else return;
    event.preventDefault();
    setActiveIndex(next);
    tabsRef.current[next]?.focus();
  };
  return <div className={styles.qualificationSwitcher}><div className={styles.qualificationTabs} role="tablist" aria-label="Choose a qualification">{catalogs.map((catalog, index) => <button className={styles.qualificationTab} key={catalog.id} id={`${catalog.id}-tab`} ref={(node) => { tabsRef.current[index] = node; }} type="button" role="tab" aria-selected={activeIndex === index} aria-controls={`${catalog.id}-panel`} tabIndex={activeIndex === index ? 0 : -1} onClick={() => setActiveIndex(index)} onKeyDown={(event) => onKeyDown(event, index)}>{catalog.title}</button>)}</div>{catalogs.map((catalog, index) => <div className={styles.tabPanel} key={catalog.id} id={`${catalog.id}-panel`} role="tabpanel" aria-labelledby={`${catalog.id}-tab`} hidden={activeIndex !== index}><Catalog catalog={catalog} /></div>)}</div>;
}
