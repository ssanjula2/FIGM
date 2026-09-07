# FIGM USER STUDY QUESTIONNAIRE SPECIFICATION

**Research Title**: "Usability Evaluation of the Framework-Agnostic Guideline Model (FIGM) Code Inspector for Single Page Applications"  
**Target Sample**: 20 Valid Real Human Participants — the final approved study target (a later approved research-scope decision confirmed by the researcher; the original Proposal/Interim 02 documents state 80-100 as the historical baseline, preserved and superseded — see `docs/research/PARTICIPANT_TARGET_DECISION.md`)  

---

## SECTION A: INFORMED CONSENT & ELIGIBILITY
1. **Q1. Participant Consent** *(Required)*
   - Options: `[ ] Yes, I consent` | `[ ] No, I do not consent`
2. **Q2. Age Eligibility** *(Required)*
   - Options: `[ ] 18–24` | `[ ] 25–34` | `[ ] 35–44` | `[ ] 45+` | `[ ] Under 18 (Excluded)`

---

## SECTION B: PARTICIPANT BACKGROUND
3. **Q3. Primary Professional / Student Role** *(Required)*
   - Options: `Student` | `Junior Software Engineer` | `Senior Software Engineer` | `Frontend Developer` | `DevOps / QA Engineer` | `Researcher / Academic` | `Other`
4. **Q4. General Programming Experience** *(Required)*
   - Options: `< 1 year` | `1–2 years` | `3–5 years` | `5+ years`
5. **Q5. Web / SPA Development Experience** *(Required)*
   - Options: `< 1 year` | `1–2 years` | `3–5 years` | `5+ years`
6. **Q6. Primary SPA Framework Used** *(Required)*
   - Options: `React` | `Angular` | `Vue` | `Next.js` | `Other`
7. **Q7. Frequency of Code Inspection / Static Analyzer Usage** *(Required)*
   - Options: `Daily` | `Weekly` | `Monthly` | `Rarely` | `Never`
8. **Q8. Existing Static Analysis Tools Used** *(Check all that apply)*
   - Options: `ESLint` | `SonarQube` | `Prettier` | `TypeScript Compiler` | `None` | `Other`

---

## SECTION C: FIGM TASK PERFORMANCE (Questions 9–15)
9. **Q9. Task 1 — Rule Identification**: Which rule ID was reported for the invariant object allocation in the benchmark fixture?
   - Options: `FIGM-PERF-01` | `FIGM-A11Y-01` | `FIGM-REACT-01` | `Not Sure`
10. **Q10. Task 2 — Diagnostic Clarity**: How clearly did FIGM explain the identified code concern?
    - Options: `1 - Very Unclear` .. `5 - Extremely Clear`
11. **Q11. Task 3 — Source Code Localization**: Were you able to locate the exact line number reported by FIGM in the benchmark file?
    - Options: `[ ] Yes, easily` | `[ ] Yes, with difficulty` | `[ ] No`
12. **Q12. Task 4 — Remediation Confidence**: How confident are you that applying FIGM's recommended fix will resolve the issue?
    - Options: `1 - Not Confident` .. `5 - Fully Confident`
13. **Q13. Task 5 — Manual Comparison**: Did FIGM detect code quality issues that would be difficult to spot during manual code review?
    - Options: `[ ] Yes` | `[ ] Somewhat` | `[ ] No` | `[ ] Unsure`
14. **Q14. Overall Task Completion Status**
    - Options: `Completed Successfully` | `Completed with Difficulty` | `Incomplete`
15. **Q15. Perceived Task Difficulty**
    - Options: `1 - Very Easy` .. `5 - Very Difficult`

---

## SECTION D: SYSTEM USABILITY SCALE (SUS) ITEMS (Questions 16–25)
*Rate each statement on a scale from 1 (Strongly Disagree) to 5 (Strongly Agree).*

- **Q16 (SUS 1)**: I think that I would like to use FIGM Code Inspector frequently.
- **Q17 (SUS 2)**: I found FIGM Code Inspector unnecessarily complex.
- **Q18 (SUS 3)**: I thought FIGM Code Inspector was easy to use.
- **Q19 (SUS 4)**: I think that I would need the support of a technical person to be able to use FIGM.
- **Q20 (SUS 5)**: I found the various functions in FIGM Code Inspector were well integrated.
- **Q21 (SUS 6)**: I thought there was too much inconsistency in FIGM Code Inspector.
- **Q22 (SUS 7)**: I would imagine that most people would learn to use FIGM Code Inspector very quickly.
- **Q23 (SUS 8)**: I found FIGM Code Inspector very cumbersome to use.
- **Q24 (SUS 9)**: I felt very confident using FIGM Code Inspector.
- **Q25 (SUS 10)**: I needed to learn a lot of things before I could get going with FIGM Code Inspector.

---

## STANDARD SUS SCORING FORMULA
- For **Odd Items** ($Q16, Q18, Q20, Q22, Q24$): Contribution = $\text{Score} - 1$
- For **Even Items** ($Q17, Q19, Q21, Q23, Q25$): Contribution = $5 - \text{Score}$
- **Total SUS Score** = $\sum(\text{Contributions}) \times 2.5$  
- **Score Range**: $0$ to $100$

---

## SECTION E: QUALITATIVE FEEDBACK
26. **Q26. Overall Tool Usefulness**: How useful is FIGM for enforcing SPA code guidelines?
    - Options: `1 - Not Useful` .. `5 - Extremely Useful`
27. **Q27. Best Aspect**: What aspect of FIGM did you find most valuable? *(Free text)*
28. **Q28. Suggested Improvements**: What features or guidelines should be improved? *(Free text)*
29. **Q29. Additional Comments**: Any additional observations or comments? *(Free text)*
