import "./global"
import {createClientPlugin} from "blitz"
import {DefaultOptions, QueryClient, QueryClientProvider} from "@tanstack/react-query"
import React from "react"

export * from "./client"

interface BlitzReactQueryOptions {
  reactQueryOptions?: DefaultOptions
}

export type BlitzRscProviderProps = {
  children: JSX.Element
  client?: QueryClient
  contextSharing?: boolean
}

export const BlitzReactQueryPlugin = createClientPlugin<
  BlitzReactQueryOptions,
  {queryClient: QueryClient; BlitzRscProvider: React.FC<BlitzRscProviderProps>}
>((options?: BlitzReactQueryOptions) => {
  const initializeQueryClient = () => {
    const {reactQueryOptions} = options || {}
    let suspenseEnabled = reactQueryOptions?.queries?.suspense ?? true
    if (!process.env.CLI_COMMAND_CONSOLE && !process.env.CLI_COMMAND_DB) {
      globalThis.__BLITZ_SUSPENSE_ENABLED = suspenseEnabled
    }

    return new QueryClient({
      defaultOptions: {
        ...reactQueryOptions,
        queries: {
          ...(typeof window === "undefined" && {cacheTime: 0}),
          retry: (failureCount: number, error: any) => {
            if (process.env.NODE_ENV !== "production") return false

            // Retry (max. 3 times) only if network error detected
            if (error.message === "Network request failed" && failureCount <= 3) return true

            return false
          },
          ...reactQueryOptions?.queries,
          suspense: suspenseEnabled,
        },
      },
    })
  }
  const queryClient = initializeQueryClient()
  function resetQueryClient() {
    setTimeout(async () => {
      // Do these in the next tick to prevent various bugs like https://github.com/blitz-js/blitz/issues/2207
      const debug = (await import("debug")).default("blitz:rpc")
      debug("Invalidating react-query cache...")
      await queryClient.cancelQueries()
      await queryClient.resetQueries()
      queryClient.getMutationCache().clear()
      // We have a 100ms delay here to prevent unnecessary stale queries from running
      // This prevents the case where you logout on a page with
      // Page.authenticate = {redirectTo: '/login'}
      // Without this delay, queries that require authentication on the original page
      // will still run (but fail because you are now logged out)
      // Ref: https://github.com/blitz-js/blitz/issues/1935
    }, 100)
  }
  const BlitzRscProvider = ({
    client = queryClient,
    contextSharing = false,
    children,
  }: BlitzRscProviderProps) => {
    if (client) {
      return (
        <QueryClientProvider
          client={client || globalThis.queryClient}
          contextSharing={contextSharing}
        >
          {children}
        </QueryClientProvider>
      )
    }
    return <>{children}</>
  }
  globalThis.queryClient = queryClient
  return {
    events: {
      onSessionCreated: async () => {
        resetQueryClient()
      },
    },
    middleware: {},
    exports: () => ({
      BlitzRscProvider,
      queryClient,
    }),
  }
})