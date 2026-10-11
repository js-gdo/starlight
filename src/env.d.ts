export interface TypedD1PreparedStatement extends Omit<D1PreparedStatement, 'first' | 'all' | 'run'> {
    bind(...values: unknown[]): TypedD1PreparedStatement;
    first<T = any>(colName: string): Promise<T | null>;
    first<T = any>(): Promise<T | null>;
    all<T = any>(): Promise<{ results: T[]; success: boolean; meta?: Record<string, unknown> }>;
    run<T = any>(): Promise<T>;
}

export interface TypedD1Database extends Omit<D1Database, 'prepare' | 'batch'> {
    prepare(query: string): TypedD1PreparedStatement;
    batch(statements: TypedD1PreparedStatement[]): Promise<Array<{ success: boolean; meta?: { changes?: number } }>>;
}

export interface Env {
    DB: TypedD1Database;
}