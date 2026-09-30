"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { BankSlug } from "@/lib/banks";
import type { PublicQuestionMetadata } from "@/lib/question-index";
import { fetchSignedAssets, isSignedAssetFresh, signedAssetKey, type SignedAsset } from "@/lib/signed-assets";
import { SourceCropImage } from "@/components/SourceCropImage";

export function PaperPreview({ bank, questions, onClose }: { bank: BankSlug; questions: PublicQuestionMetadata[]; onClose: () => void }) {
  const reader = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(0);
  const [answerOpen, setAnswerOpen] = useState(false);
  const [assets, setAssets] = useState<Map<string, SignedAsset>>(new Map());
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const pending = useRef(new Map<string, Promise<SignedAsset>>());
  const question = questions[position];
  const questionKey = signedAssetKey(question.id, "question");
  const answerKey = signedAssetKey(question.id, "answer");
  const questionAsset = assets.get(questionKey);
  const answerAsset = assets.get(answerKey);
  const hasQuestion = isSignedAssetFresh(questionAsset);
  const hasAnswer = isSignedAssetFresh(answerAsset);

  useEffect(() => { reader.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }); }, []);

  useEffect(() => {
    const kind = !hasQuestion ? "question" : answerOpen && !hasAnswer ? "answer" : null;
    if (!kind) return;
    const key = signedAssetKey(question.id, kind);
    let active = true;
    let request = pending.current.get(key);
    if (!request) {
      request = fetchSignedAssets(bank, [{ questionId: question.id, kind }]).then((result) => {
        const asset = result.get(key);
        if (!asset) throw new Error("Question preview unavailable");
        return asset;
      });
      pending.current.set(key, request);
      void request.finally(() => pending.current.delete(key)).catch(() => {});
    }
    request.then((asset) => { if (active) { setAssets((current) => new Map(current).set(key, asset)); setError(""); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load preview"); });
    return () => { active = false; };
  }, [bank, question.id, answerOpen, hasAnswer, hasQuestion, retry]);

  function move(next: number) { setPosition(next); setAnswerOpen(false); setError(""); }

  return <div ref={reader} className="paper-preview-reader" role="region" aria-label="Paper question viewer">
    <div className="paper-preview-toolbar"><div><span className="eyebrow">Question {position + 1} of {questions.length}</span><h3>Paper {question.paper} · Question {question.number}</h3><p>{question.year} · {question.marks} {question.marks === 1 ? "mark" : "marks"}{question.primaryTopic ? ` · ${question.primaryTopic}` : ""}</p></div><button type="button" className="button secondary" onClick={onClose}>Close preview</button></div>
    {error ? <div role="alert" className="paper-builder-error">{error} <button type="button" className="button secondary" onClick={() => { setError(""); setRetry((current) => current + 1); }}>Retry preview</button></div>
      : <div className="paper-preview-images" aria-live="polite">{hasQuestion ? (questionAsset.urls.length ? questionAsset.urls.map((src, index) => <SourceCropImage key={src} bankSlug={bank} questionId={question.id} src={src} crop={questionAsset.displayCrops?.[index]} alt={`Original question ${question.number}${questionAsset.urls.length > 1 ? ` page ${index + 1}` : ""}`} />) : <p>Question image unavailable.</p>) : <p role="status">Loading question…</p>}</div>}
    {hasQuestion && <div className="paper-preview-answer"><button type="button" className="button secondary" onClick={() => setAnswerOpen((open) => !open)}>{answerOpen ? "Hide answer" : "Show answer"}</button>{answerOpen && (hasAnswer ? <div className="paper-preview-images">{answerAsset.urls.length ? answerAsset.urls.map((src, index) => <Image unoptimized key={src} src={src} alt={`Official mark scheme page ${index + 1}`} width={1400} height={1000} />) : <p>No mark scheme image is available for this question.</p>}</div> : <p role="status">Loading answer…</p>)}</div>}
    <nav className="paper-preview-navigation" aria-label="Preview questions"><button type="button" className="button secondary" disabled={position === 0} onClick={() => move(position - 1)}>← Previous</button><span>{position + 1} / {questions.length}</span><button type="button" className="button secondary" disabled={position === questions.length - 1} onClick={() => move(position + 1)}>Next →</button></nav>
  </div>;
}
