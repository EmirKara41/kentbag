export interface QueryResult {
  rows: Record<string, any>[];
  rowCount?: number | null;
}
export interface Sql {
  query(text: string, values?: any[]): Promise<QueryResult>;
}
export interface Database extends Sql {
  transaction<T>(task: (sql: Sql) => Promise<T>): Promise<T>;
}
