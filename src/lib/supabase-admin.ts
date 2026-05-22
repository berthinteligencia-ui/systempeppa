import { createClient } from "@supabase/supabase-js"

export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: {
        fetch: (url, options = {}) =>
          fetch(url, { ...options, cache: "no-store" }),
      },
    }
  )
}

export function check<T>(result: { data: T | null; error: any }): T {
  if (result.error) throw new Error(result.error.message ?? String(result.error))
  return result.data!
}

export async function fetchFullList<T>(
  buildQuery: (from: number, to: number) => any
): Promise<T[]> {
  const allData: T[] = []
  let from = 0
  const chunkSize = 1000
  let hasMore = true
  
  while (hasMore) {
    const { data, error } = await buildQuery(from, from + chunkSize - 1)
    if (error) throw new Error(error.message ?? String(error))
    if (!data || data.length === 0) {
      hasMore = false
    } else {
      allData.push(...data)
      if (data.length < chunkSize) {
        hasMore = false
      } else {
        from += chunkSize
      }
    }
  }
  return allData
}

