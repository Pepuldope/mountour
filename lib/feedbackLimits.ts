/** What a message may say (shared by the form and lib/feedback.ts). */
export const FEEDBACK_KINDS = ["napad", "chyba"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
/** What a problem report is about. */
export const PROBLEM_TOPICS = ["trasa", "parkovisko", "fotka", "web", "ine"] as const;
export type ProblemTopic = (typeof PROBLEM_TOPICS)[number];
export const FEEDBACK_MAX = 1500;
