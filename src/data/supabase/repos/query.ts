/**
 * Shared query helpers for the Supabase repositories.
 *
 * PostgREST caps every response at `max_rows` (1000 by default, also on Supabase Cloud), so a
 * plain select over 5 years of expenses would silently truncate. `selectAll` pages with a stable
 * order until a short page comes back.
 */
import type { IsoDate } from "@/domain/types";
import type { RawSupabaseError } from "../mappers";
import { toProviderError, toProviderErrorFromUnknown, unwrap } from "../mappers";

export const PAGE_SIZE = 1000;

type Result<T> = { data: T | null; error: RawSupabaseError | null; status?: number };

/** Awaits a supabase-js call, converting both returned and thrown errors to ProviderError. */
export async function exec<R extends Result<unknown>>(
  call: PromiseLike<R>,
): Promise<NonNullable<R["data"]>> {
  let result: R;
  try {
    result = await call;
  } catch (e) {
    throw toProviderErrorFromUnknown(e);
  }
  return unwrap(result) as NonNullable<R["data"]>;
}

/** Like exec, for calls whose data may legitimately be null (deletes, maybeSingle). */
export async function execNullable<R extends Result<unknown>>(
  call: PromiseLike<R>,
): Promise<R["data"]> {
  let result: R;
  try {
    result = await call;
  } catch (e) {
    throw toProviderErrorFromUnknown(e);
  }
  if (result.error) throw toProviderError(result.error, result.status);
  return result.data;
}

/**
 * Fetches every row by pages. `page(from, to)` must apply a stable `.order(...)` (e.g. by id)
 * and `.range(from, to)`.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<Result<T[]>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const chunk = (await exec(page(from, from + PAGE_SIZE - 1))) as T[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) return rows;
  }
}

export type DateRange = { from: IsoDate; to: IsoDate } | undefined;

/** Minimal structural type of a PostgREST filter builder used by `withinRange`. */
interface RangeFilterable<Self> {
  gte(column: string, value: string): Self;
  lte(column: string, value: string): Self;
}

export function withinRange<Q extends RangeFilterable<Q>>(
  query: Q,
  column: string,
  range: DateRange,
): Q {
  return range ? query.gte(column, range.from).lte(column, range.to) : query;
}

/** Splits ids into chunks so `.in('id', ids)` URLs stay well under URL length limits. */
export function chunk<T>(items: readonly T[], size = 200): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
