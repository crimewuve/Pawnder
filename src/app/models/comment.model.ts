export interface ReportComment {
  id: string;
  report_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { display_name: string } | null;
}