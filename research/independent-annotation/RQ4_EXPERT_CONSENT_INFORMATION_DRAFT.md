# RQ4 Independent Expert Review — Information & Consent (DRAFT)

**Status: DRAFT — not yet reviewed or approved by the researcher/institution as an approved
consent instrument.** This document is a starting point, written only from the project's already-
confirmed ethics principles (see below) and modeled on the wording already approved for the RQ1
human-study consent form (`research/CONSENT_FORM.md`). It must not be sent to a real expert, and
must not be described as "approved," until the researcher explicitly reviews and confirms it.

**Research Title**: "Usability Evaluation of the Framework-Independent Guideline Model (FIGM) Code
Inspector for Single Page Applications"
**Institution**: NSBM Green University
**Module**: IS303.2 Research Methodology Repeat Coursework 2025
**Investigator**: A P H D S Sanjula (Student ID: 28256)

**Ethics Status**: `ETHICS_APPROVAL_STATUS = CONFIRMED_BY_RESEARCHER` — formal ethics approval for
this research project has been confirmed by the researcher. `ETHICS_APPROVAL_REFERENCE =
TO_BE_RECORDED`: the specific approval number, date, and committee name have not yet been supplied
to this repository, and none is fabricated here — this field should be filled in once available,
consistent with `research/CONSENT_FORM.md`'s identical, already-established wording.

---

## 1. Purpose

You are invited to take part in an independent expert code review, supporting a research study
evaluating the accuracy of the **FIGM Code Inspector**, an automated static-analysis tool for
Single Page Application front-end source code (React, Next.js, Angular, and Vue). Your review, as
a domain expert working independently of the tool, will serve as the reference standard the tool's
own findings are measured against (Precision, Recall, and F1-score).

## 2. What you will be asked to do

You will receive a self-contained package of **67 short, isolated front-end source files** and a
fixed list of **rule criteria** drawn from FIGM's guideline taxonomy (performance/architecture and
accessibility patterns). For each of a pre-defined set of (file, rule) pairs applicable to that
file's framework, you will judge whether the code violates that specific rule's criteria:
`VIOLATION`, `NO_VIOLATION`, or `AMBIGUOUS` (with a brief note). You will not see any output the
FIGM tool itself has produced for these files, and you will not be told which files or rules were
originally intended as positive or negative examples.

## 3. Approximate task scope

The package defines **1,717 individual (file, rule) judgments** across 67 files. This is a
substantial task; there is no fixed time limit, and you are welcome to complete it across multiple
sessions. An approximate per-judgment pace of a few seconds to a couple of minutes (depending on
file complexity and rule) is a reasonable expectation, but this will vary by reviewer.

## 4. Voluntary participation & right to withdraw

Participation is **completely voluntary**. You may decline to participate, stop at any point, or
withdraw your submission at any time before it is anonymized and incorporated into the analysis,
without any negative consequence.

## 5. Confidentiality, anonymity & data protection

- **No unnecessary personal data is collected.** We do not request your full name, email address,
  phone number, national ID, or employer, beyond what is needed to contact you about this specific
  review (kept separate from your annotation data).
- **Anonymous Expert ID**: your submission is associated only with an anonymous identifier (e.g.
  `E001`) in every research output, dataset, and dissertation artifact. Any mapping from that ID
  back to your identity, if kept at all, is stored separately from the annotation data itself and
  is never included in analysis files.
- **Research-only use**: your annotations are used exclusively for this academic research and
  thesis evaluation at NSBM Green University, reported only in aggregate/de-identified form.

## 6. Contact information

If you have questions about this research, your rights as a reviewer, or wish to withdraw your
submission prior to anonymization:
- **Investigator**: A P H D S Sanjula (Student ID: 28256)
- **Institution**: Department of Computer Science & Software Engineering, NSBM Green University

---

_This draft has not been reviewed by the researcher and carries no approval status of its own
beyond the project-level `CONFIRMED_BY_RESEARCHER` ethics status already recorded in
`research/CONSENT_FORM.md`. Do not send to a real expert until reviewed._

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BTxjxSo2MumPZ9pw28vgEA
