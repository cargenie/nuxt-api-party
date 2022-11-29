import { defu } from 'defu'
import { camelCase, pascalCase } from 'scule'
import { addImportsSources, addServerHandler, addTemplate, createResolver, defineNuxtModule, useLogger } from '@nuxt/kit'
import { apiServerRoute } from './runtime/utils'

export interface ModuleOptions {
  /**
   * API name used for composables
   *
   * @remarks
   * For example, if you set it to `foo`, the composables will be called `$foo` and `useFooData`
   *
   * @default 'party'
   */
  name?: string

  /**
   * API base URL
   *
   * @default process.env.API_PARTY_BASE_URL
   */
  url?: string

  /**
   * Optional API token for bearer authentication
   *
   * @remarks
   * You can set a custom header with the `headers` module option instead
   *
   * @default process.env.API_PARTY_TOKEN
   */
  token?: string

  /**
   * Custom headers sent with every request to the API
   *
   * @remarks
   * Add authorization headers if you want to use a custom authorization method
   *
   * @example
   * export default defineNuxtConfig({
   *   apiParty: {
   *     headers: {
   *       'Custom-Api-Header': 'foo',
   *       'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
   *     }
   *   }
   * })
   *
   * @default {}
   */
  headers?: Record<string, string>

  /**
   * Multiple API endpoints
   *
   * @remarks
   * This will create multiple API composables and invalidate the `name`, `url`, `token` and `headers` module options of the default endpoint
   *
   * @default {}
   */
  endpoints?: Record<
    string,
    {
      url: string
      token?: string
      headers?: Record<string, string>
    }
 >
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-api-party',
    configKey: 'apiParty',
    compatibility: {
      nuxt: '^3',
    },
  },
  defaults: {
    name: 'party',
    url: process.env.API_PARTY_BASE_URL as string,
    token: process.env.API_PARTY_TOKEN as string,
    headers: {},
    endpoints: {},
  },
  async setup(options, nuxt) {
    const logger = useLogger('nuxt-api-party')
    const hasMultipleEndpoints = Object.keys(options.endpoints!).length > 0
    const getRawComposableName = (endpointName: string) => `$${camelCase(endpointName)}`
    const getDataComposableName = (endpointName: string) => `use${pascalCase(endpointName)}Data`

    if (!hasMultipleEndpoints) {
      // Make sure API base URL is set
      if (!options.url)
        logger.error('Missing `API_PARTY_BASE_URL` in `.env` file')

      // Make sure authentication credentials are set
      if (!options.token && Object.keys(options.headers!).length === 0)
        logger.warn('Missing `API_PARTY_TOKEN` in `.env` file for bearer authentication and custom headers in module options. Are you sure your API doesn\'t require authentication? If so, you may not need this module.')

      // Add default endpoint to collection of endpoints
      options.endpoints![options.name!] = {
        url: options.url!,
        token: options.token,
        headers: options.headers,
      }
    }

    // Private runtime config
    nuxt.options.runtimeConfig.apiParty = defu(
      nuxt.options.runtimeConfig.apiParty,
      options,
    )

    // Transpile runtime
    const { resolve } = createResolver(import.meta.url)
    nuxt.options.build.transpile.push(resolve('runtime'))

    // Add Nuxt server route to proxy the API request server-side
    addServerHandler({
      route: apiServerRoute,
      method: 'post',
      handler: resolve('runtime/server/api/handler'),
    })

    const endpointKeys = Object.keys(options.endpoints!)

    addImportsSources({
      from: '#build/api-party',
      imports: endpointKeys.flatMap(i => [getRawComposableName(i), getDataComposableName(i)]),
    })

    // Add generated composables
    addTemplate({
      filename: 'api-party.mjs',
      getContents() {
        return `
import { _$api } from '${resolve('runtime/composables/$api')}'
import { _useApiData } from '${resolve('runtime/composables/useApiData')}'
${endpointKeys.map(i => `
export const ${getRawComposableName(i)} = (...args) => _$api('${i}', ...args)
export const ${getDataComposableName(i)} = (...args) => _useApiData('${i}', ...args)
`.trimStart()).join('')}`.trimStart()
      },
    })

    // Add types for generated composables
    addTemplate({
      filename: 'api-party.d.ts',
      getContents() {
        return endpointKeys.map(i => `
export declare const ${getRawComposableName(i)}: typeof import('${resolve('runtime/composables/$api')}')['$api']
export declare const ${getDataComposableName(i)}: typeof import('${resolve('runtime/composables/useApiData')}')['useApiData']
`.trimStart()).join('')
      },
    })
  },
})
