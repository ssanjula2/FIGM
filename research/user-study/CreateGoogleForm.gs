/**
 * FIGM Code Inspector — Google Forms & Sheets User Study Automation Script
 * 
 * Research Title: "Usability Evaluation of the Framework-Independent Guideline Model (FIGM) Code Inspector for Single Page Applications"
 * Institution: NSBM Green University
 * Candidate: A P H D S Sanjula (Student ID: 28256)
 * Module: IS303.2 Research Methodology Repeat Coursework 2025
 * Target Sample Size: 20 Valid Real Human Participants (revised from an earlier 85-participant
 *   target per the supervisor's latest instruction; see
 *   research/audits/FIGM_PRE_DATA_COLLECTION_AUDIT.md Section 3)
 * 
 * INSTRUCTIONS:
 * 1. Open https://script.google.com/ in your browser while logged into your Google account.
 * 2. Click "New project" and replace any placeholder code with the contents of this file.
 * 3. Click "Save" (Ctrl+S) and then click "Run" for the `createFIGMUserStudyForm` function.
 * 4. Grant required permissions when prompted.
 * 5. Check the Execution Log for your generated Google Form URL and Google Sheet Response Destination URL!
 */

function createFIGMUserStudyForm() {
  const formTitle = "FIGM Code Inspector — User Study";
  const formDescription = "You are invited to participate in a research study evaluating the usability of the Framework-Independent Guideline Model (FIGM) Code Inspector, a tool designed to identify potential performance, accessibility, security, and architectural issues in Single Page Applications.\n\n" +
    "The study involves using the FIGM Code Inspector to complete a series of software-code inspection tasks and answering a short usability questionnaire.\n\n" +
    "Participation is voluntary. The study is intended for academic research purposes. Your responses will be analysed in anonymised and aggregated form.\n\n" +
    "The estimated completion time is approximately 15–25 minutes.\n\n" +
    "You may stop participating at any time before submitting your response.\n\n" +
    "No personally identifying information is requested through this questionnaire.";

  // Create Form
  const form = FormApp.create(formTitle);
  form.setDescription(formDescription);
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setPublishingSummary(false);
  // Prevents the same signed-in Google account from submitting more than once. Google enforces this
  // internally via the responder's account and does NOT add an email/identity column to the exported
  // response sheet (that only happens if setCollectEmail(true) is separately called, which it is not
  // here) -- so this closes the duplicate-submission gap without weakening participant anonymity.
  // NOTE: requires participants to be signed into a Google account to open the form.
  form.setLimitOneResponsePerUser(true);
  form.setRequireLogin(true);

  // Link Destination Spreadsheet
  const ss = SpreadsheetApp.create("FIGM User Study — Responses (Target N=20)");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // SECTION 1 — Participant Information & Consent
  form.addSectionHeaderItem().setTitle("SECTION 1 — Participant Information & Consent");
  
  const consentItem = form.addMultipleChoiceItem()
    .setTitle("Q1: I have read and understood the participant information above and voluntarily agree to participate in this research study.")
    .setRequired(true);

  const ageItem = form.addMultipleChoiceItem()
    .setTitle("Q2: Are you 18 years of age or older?")
    .setRequired(true);

  // Page Break for Section 2
  const sec2 = form.addPageBreakItem().setTitle("SECTION 2 — Participant Background");
  
  // Set Consent & Age Branching
  const consentYes = consentItem.createChoice("Yes, I consent to participate", sec2);
  const consentNo = consentItem.createChoice("No, I do not consent to participate", FormApp.PageNavigationType.SUBMIT);
  consentItem.setChoices([consentYes, consentNo]);

  const ageYes = ageItem.createChoice("Yes", sec2);
  const ageNo = ageItem.createChoice("No", FormApp.PageNavigationType.SUBMIT);
  ageItem.setChoices([ageYes, ageNo]);

  // SECTION 2 Questions
  form.addMultipleChoiceItem()
    .setTitle("Q3: What best describes your current role?")
    .setChoiceValues([
      "Software Engineering Student",
      "Computer Science / IT Student",
      "Web Developer",
      "Software Engineer",
      "Full-Stack Developer",
      "Frontend Developer",
      "Backend Developer",
      "Other"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q4: How many years of programming experience do you have?")
    .setChoiceValues(["Less than 1 year", "1–2 years", "3–4 years", "5–6 years", "More than 6 years"])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q5: How much experience do you have with web development?")
    .setChoiceValues(["None", "Less than 1 year", "1–2 years", "3–4 years", "5+ years"])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle("Q6: Which of the following technologies/frameworks have you used?")
    .setChoiceValues(["React", "Next.js", "Angular", "Vue.js", "JavaScript", "TypeScript", "Other", "None"])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q7: How frequently do you inspect source code for performance, accessibility, security, or architectural issues?")
    .setChoiceValues(["Never", "Rarely", "Sometimes", "Often", "Very often"])
    .setRequired(true);

  form.addCheckboxItem()
    .setTitle("Q8: Which code analysis/developer tools have you previously used?")
    .setChoiceValues([
      "ESLint",
      "SonarQube",
      "Lighthouse",
      "Chrome DevTools",
      "VS Code diagnostics",
      "IDE inspections",
      "Other static analysis tools",
      "None"
    ])
    .setRequired(true);

  // SECTION 3 — FIGM Evaluation Tasks
  form.addPageBreakItem().setTitle("SECTION 3 — FIGM Evaluation Tasks")
    .setHelpText("Before answering Questions 9–15, open the provided FIGM Code Inspector environment (or VS Code Extension) and inspect one of the provided benchmark fixtures (React UserProfile.jsx, Angular SearchPanel.component.ts, or Vue DataGrid.vue). Run the FIGM inspection and review the reported diagnostics. Complete the following questions based on your actual interaction with the system.");

  form.addMultipleChoiceItem()
    .setTitle("Q9: Which FIGM guideline/rule was associated with the issue you identified?")
    .setChoiceValues([
      "FIGM-PERF-01: Invariant Object Allocation in Iteration Scopes",
      "FIGM-PERF-02: Unmemoized Component Parameter Closures",
      "FIGM-PERF-03: Inline Event Handler Allocation",
      "FIGM-PERF-04: Static Imports in Deferred Execution Paths",
      "FIGM-A11Y-01: Non-Semantic Interactive Element",
      "FIGM-A11Y-02: Missing Form Control Label",
      "FIGM-A11Y-03: Insufficient Color Contrast",
      "FIGM-A11Y-04: Missing Image Accessible Alternate Text",
      "I could not determine the rule"
    ])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q10: Were you able to understand the selected diagnostic, including what the issue is, why it matters, and what improvement is recommended?")
    .setChoiceValues(["Yes", "Partially", "No"])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q11: Were you able to locate the relevant source-code location associated with a FIGM diagnostic?")
    .setChoiceValues(["Yes", "Partially", "No"])
    .setRequired(true);

  form.addScaleItem()
    .setTitle("Q12: How confident are you that you understood the recommended improvement?")
    .setBounds(1, 5)
    .setLabels("Not at all confident", "Extremely confident")
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q13: Did FIGM help you identify or understand an issue that would have been more difficult to identify manually?")
    .setChoiceValues(["Yes", "No", "Not sure"])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Q14: Were you able to complete the requested FIGM tasks?")
    .setChoiceValues([
      "Successfully completed all tasks",
      "Completed most tasks",
      "Completed some tasks",
      "Unable to complete the tasks"
    ])
    .setRequired(true);

  form.addScaleItem()
    .setTitle("Q15: How difficult were the FIGM evaluation tasks?")
    .setBounds(1, 5)
    .setLabels("Very easy", "Very difficult")
    .setRequired(true);

  // SECTION 4 — System Usability Scale (SUS)
  form.addPageBreakItem().setTitle("SECTION 4 — System Usability Scale (SUS)")
    .setHelpText("Please indicate your level of agreement with each statement regarding FIGM Code Inspector. (1 = Strongly disagree, 5 = Strongly agree)");

  const susQuestions = [
    "1. I think that I would like to use this system frequently.",
    "2. I found the system unnecessarily complex.",
    "3. I thought the system was easy to use.",
    "4. I think that I would need the support of a technical person to be able to use this system.",
    "5. I found the various functions in this system were well integrated.",
    "6. I thought there was too much inconsistency in this system.",
    "7. I would imagine that most people would learn to use this system very quickly.",
    "8. I found the system very cumbersome/awkward to use.",
    "9. I felt very confident using the system.",
    "10. I needed to learn a lot of things before I could get going with this system."
  ];

  susQuestions.forEach((q) => {
    form.addScaleItem()
      .setTitle(q)
      .setBounds(1, 5)
      .setLabels("Strongly disagree", "Strongly agree")
      .setRequired(true);
  });

  // SECTION 5 — Additional Feedback
  form.addPageBreakItem().setTitle("SECTION 5 — Additional Feedback");

  form.addScaleItem()
    .setTitle("How useful did you find FIGM Code Inspector for identifying or understanding issues in SPA code?")
    .setBounds(1, 5)
    .setLabels("Not useful at all", "Extremely useful")
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle("Which aspect of FIGM did you find most useful?")
    .setChoiceValues([
      "Issue detection",
      "Guideline explanation",
      "Source-code location",
      "Recommendations",
      "Quick fixes",
      "Performance guidance",
      "Accessibility guidance",
      "Security guidance",
      "Other"
    ])
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle("What is the most important improvement you would recommend for the FIGM Code Inspector?")
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle("Please provide any additional comments about your experience using FIGM.")
    .setRequired(false);

  // SECTION 6 — Submission / Thank You
  form.addPageBreakItem().setTitle("SECTION 6 — Submission / Thank You")
    .setHelpText("Thank you for completing the FIGM Code Inspector Usability Study! Click Submit below to record your response.");

  // Log Results
  Logger.log("====================================================");
  Logger.log("FIGM USER STUDY FORM CREATED SUCCESSFULLY!");
  Logger.log("Form Edit URL: " + form.getEditUrl());
  Logger.log("Form Public Respondent URL: " + form.getPublishedUrl());
  Logger.log("Linked Google Sheet Responses URL: " + ss.getUrl());
  Logger.log("====================================================");
}
