export interface SessionRow {
  id: string;
  title: string;
  type: string;
  subject: string | null;
  status: string;
  duration_ms: number;
  created_at: string;
  updated_at: string;
  tags?: string;
}
