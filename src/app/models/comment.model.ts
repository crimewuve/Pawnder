export interface ReportComment {
  id: string;
  report_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}
