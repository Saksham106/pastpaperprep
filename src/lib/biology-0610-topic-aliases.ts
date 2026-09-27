// Keep the stored source-era heading. This names the topic the student sees and
// makes a current syllabus selection retrieve semantically equivalent older papers.
const CURRENT_HEADING: Readonly<Record<string, string>> = {
  "Movement in and out of cells": "Movement into and out of cells",
  "Biotechnology and genetic engineering": "Biotechnology and genetic modification",
  // A few imported rows promoted an official subsection name to a peer topic.
  "Size of specimens": "Organisation of the organism",
  "Habitat destruction": "Human influences on ecosystems",
  "Genetic modification": "Biotechnology and genetic modification",
};

export function canonicalBiology0610Topic(topic: string): string {
  return CURRENT_HEADING[topic] ?? topic;
}
