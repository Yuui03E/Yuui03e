export interface SearchProgressItem {
  current: number;
  total: number;
  title: string;
  status:
    | "searching"
    | "matched"
    | "not_found"
    | "low_confidence"
    | "error"
    | "cancelled";
  message: string | null;
}
