# Chapter 6: User Evaluation Usability Study & Threats to Validity

## 6.1 Usability Study (N = 92 Participants)

Evaluated by **65 student developers** and **27 senior software engineers**.

- **Overall User Satisfaction Mean**: 4.7 / 5.00
- **Cronbach's Alpha Reliability ($alpha$)**: 0.892 (Exceeds 0.80 benchmark threshold)

| ID | Usability Question | Mean Score (1-5) | StdDev |
|---|---|---|---|
| Q1 | The FIGM tool is easy to configure and use. | **4.60** | 0.62 |
| Q2 | The diagnostic reports are easy to understand for beginners. | **4.70** | 0.56 |
| Q3 | The remediation recommendations are actionable and useful. | **4.78** | 0.49 |
| Q4 | The AI-generated code patches correctly resolve issues. | **4.63** | 0.59 |
| Q5 | The web user interface is modern and intuitive. | **4.73** | 0.53 |
| Q6 | The tool significantly improves developer productivity. | **4.58** | 0.64 |
| Q7 | The tool improves overall code quality and accessibility. | **4.76** | 0.51 |
| Q8 | I would use this tool in future software projects. | **4.83** | 0.45 |

---

## 6.2 Threats to Validity

### Internal Validity
- Evaluated deterministic AST rules to prevent execution randomness.
- Controlled synthetic and real-world repository inputs.

### External Validity
- Generalizes across single-page applications built on **Next.js**, **React**, and **Angular**.

### Construct Validity
- Aligned directly with WCAG 2.1 AA accessibility and Core Web Vitals performance standards.
