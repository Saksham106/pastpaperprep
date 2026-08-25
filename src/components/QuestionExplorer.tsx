"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowSquareOut, CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { filterQuestions, type UnifiedQuestion } from "@/lib/questions";

const PAGE_SIZE = 12;

export function QuestionExplorer({ questions }: { questions: UnifiedQuestion[] }) {
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [year, setYear] = useState("");
  const [paper, setPaper] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const topics = useMemo(() => [...new Set(questions.map((q) => q.primaryTopic))].sort(), [questions]);
  const years = useMemo(() => [...new Set(questions.map((q) => q.year))].sort((a, b) => b - a), [questions]);
  const papers = useMemo(() => [...new Set(questions.map((q) => q.paper))].sort(), [questions]);
  const filtered = useMemo(
    () => filterQuestions(questions, { search, topic, year, paper }),
    [questions, search, topic, year, paper],
  );

  const update = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setVisible(PAGE_SIZE);
  };

  return (
    <section className="explorer" aria-label="Question explorer">
      <div className="filter-bar">
        <label className="search-field">
          <span className="sr-only">Search questions</span>
          <MagnifyingGlass aria-hidden="true" />
          <input value={search} onChange={(e) => update(setSearch)(e.target.value)} placeholder="Search questions, skills, or methods" />
        </label>
        <Filter label="Topic" value={topic} values={topics} onChange={update(setTopic)} />
        <Filter label="Year" value={year} values={years.map(String)} onChange={update(setYear)} />
        <Filter label="Paper" value={paper} values={papers.map(String)} onChange={update(setPaper)} />
      </div>

      <div className="results-heading">
        <strong>{filtered.length.toLocaleString()} {filtered.length === 1 ? "question" : "questions"}</strong>
        {(search || topic || year || paper) && (
          <button className="text-button" onClick={() => { setSearch(""); setTopic(""); setYear(""); setPaper(""); }}>Clear filters</button>
        )}
      </div>

      <div className="question-list">
        {filtered.slice(0, visible).map((question) => <QuestionCard key={question.id} question={question} />)}
      </div>
      {filtered.length === 0 && <div className="empty-state"><strong>No questions match that combination.</strong><span>Clear a filter and try again.</span></div>}
      {visible < filtered.length && (
        <button className="load-more" onClick={() => setVisible((count) => count + PAGE_SIZE)}>Show 12 more questions</button>
      )}
    </section>
  );
}

function Filter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <label className="select-field">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">All {label.toLowerCase()}s</option>
        {values.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <CaretDown aria-hidden="true" />
    </label>
  );
}

function QuestionCard({ question }: { question: UnifiedQuestion }) {
  const [answerOpen, setAnswerOpen] = useState(false);
  return (
    <article className="question-card">
      <div className="question-meta">
        <span>{question.year} {question.session}</span>
        <span>Paper {question.paper}</span>
        <span>Question {question.number}</span>
        {question.marks !== null && <span>{question.marks} marks</span>}
      </div>
      <div className="question-main">
        <div className="question-copy">
          <p className="eyebrow">{question.primaryTopic}</p>
          <h3>{question.summary || `Question ${question.number}`}</h3>
          <div className="skill-row">{question.skills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}</div>
        </div>
        {question.questionImages[0] && <Image unoptimized width={1200} height={900} src={question.questionImages[0]} alt={`Question ${question.number} from ${question.year} ${question.session}`} />}
      </div>
      <div className="question-actions">
        {(question.solution || question.markschemeImages.length > 0) ? (
          <div className="answer-wrap">
            <button className="answer-toggle" aria-expanded={answerOpen} onClick={() => setAnswerOpen((open) => !open)}>
              {answerOpen ? "Hide answer" : "Show answer"}
            </button>
            {answerOpen && <div className="answer-panel">
              {question.solution && <p>{question.solution}</p>}
              {question.markschemeImages.map((image, index) => <Image unoptimized width={1200} height={900} key={image} src={image} alt={`Mark scheme page ${index + 1}`} />)}
            </div>}
          </div>
        ) : <span className="muted">Answer coming soon</span>}
        {question.sourceQuestionUrl && <a href={question.sourceQuestionUrl} target="_blank" rel="noreferrer">Source paper <ArrowSquareOut /></a>}
      </div>
    </article>
  );
}
