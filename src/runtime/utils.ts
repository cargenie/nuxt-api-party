import { unref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

export type MaybeComputedRef<T> = (() => T) | ComputedRef<T> | Ref<T> | T

export const apiServerRoute = '/api/__api_party__'

export function resolveUnref<T>(r: MaybeComputedRef<T>): T {
  return typeof r === 'function'
    ? (r as any)()
    : unref(r)
}

export function headersToObject(headers: HeadersInit = {}): Record<string, string> {
  // SSR compatibility for `Headers` prototype
  if (typeof Headers !== 'undefined' && headers instanceof Headers)
    return Object.fromEntries([...headers.entries()])

  if (Array.isArray(headers))
    return Object.fromEntries(headers)

  return headers as Record<string, string>
}
