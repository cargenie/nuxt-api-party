import { headersToObject, resolvePath } from '../utils'
import type { ModuleOptions } from '../../module'
import type { ApiFetchOptions } from '../composables/$api'
import { useRuntimeConfig } from '#imports'

export function _$api<T = any>(
  endpointId: string,
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { pathParams, query, headers, method, body, ...fetchOptions } = opts
  const { apiParty } = useRuntimeConfig()
  const endpoints = (apiParty as unknown as ModuleOptions).endpoints || {}
  const endpoint = endpoints[endpointId]

  return globalThis.$fetch<T>(resolvePath(path, pathParams), {
    ...fetchOptions,
    baseURL: endpoint.url,
    method,
    query: {
      ...endpoint.query,
      ...query,
    },
    headers: {
      ...(endpoint.token && { Authorization: `Bearer ${endpoint.token}` }),
      ...endpoint.headers,
      ...headersToObject(headers),
    },
    body,
  }) as Promise<T>
}
