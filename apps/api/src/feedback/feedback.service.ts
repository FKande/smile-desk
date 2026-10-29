import { Inject, Injectable } from '@nestjs/common';
import { DB, type Db } from '../database/database.js';
import { PRACTICE } from '../practice/practice.js';

export type FeedbackRating = 1 | -1;

export interface FeedbackEntry {
  id: string;
  conversationId: string;
  rating: FeedbackRating;
  comment: string | null;
  createdAt: string;
  /** Set only when the patient verified their identity in that conversation. */
  patientName: string | null;
  /** The patient's first message, trimmed, so staff can tell conversations apart at a glance. */
  excerpt: string;
}

interface FeedbackRow {
  id: string;
  conversation_id: string;
  rating: FeedbackRating;
  comment: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  first_message: string | null;
}

export const FEEDBACK_LIMIT = 50;
const EXCERPT_CHARS = 140;

/** The text the patient typed in a stored user message; never the injected context block. */
const excerptOf = (content: string | null): string => {
  if (!content) return '';
  let text: unknown;
  try {
    text = (JSON.parse(content) as { text?: unknown }).text;
  } catch {
    return '';
  }
  if (typeof text !== 'string') return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > EXCERPT_CHARS ? `${flat.slice(0, EXCERPT_CHARS - 1).trimEnd()}…` : flat;
};

/** Patient ratings of the assistant, for the staff Feedback view (the improvement loop). */
@Injectable()
export class FeedbackService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Newest first, capped at 50. Pass a rating to see only thumbs-up or only thumbs-down. */
  list(rating?: FeedbackRating): FeedbackEntry[] {
    const rows = this.db
      .prepare(
        `SELECT f.id, f.conversation_id, f.rating, f.comment, f.created_at,
                p.first_name, p.last_name,
                (SELECT m.content FROM messages m
                  WHERE m.conversation_id = f.conversation_id AND m.role = 'user'
                  ORDER BY m.rowid LIMIT 1) AS first_message
           FROM feedback f
           JOIN conversations c ON c.id = f.conversation_id
           LEFT JOIN patients p ON p.id = c.patient_id
          WHERE c.location_id = ? AND (? IS NULL OR f.rating = ?)
          ORDER BY f.created_at DESC, f.rowid DESC
          LIMIT ?`,
      )
      .all(PRACTICE.locationId, rating ?? null, rating ?? null, FEEDBACK_LIMIT) as FeedbackRow[];
    return rows.map((r) => ({
      id: r.id,
      conversationId: r.conversation_id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
      patientName: r.first_name ? `${r.first_name} ${r.last_name}` : null,
      excerpt: excerptOf(r.first_message),
    }));
  }
}
