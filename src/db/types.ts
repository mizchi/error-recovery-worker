import type { ColumnType } from "kysely";
export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;
export type Timestamp = ColumnType<Date, Date | string, Date | string>;

export type ErrorRecord = {
    id: string;
    name: string;
    message: string;
    stack: string;
    originalStack: string;
    url: string;
    at: number;
    ua: string | null;
};
export type DB = {
    ErrorRecord: ErrorRecord;
};
