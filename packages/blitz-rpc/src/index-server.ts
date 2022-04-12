import {assert, Ctx, baseLogger, prettyMs, newLine} from "blitz"
import {NextApiRequest, NextApiResponse} from "next"
import {deserialize, serialize as superjsonSerialize} from "superjson"
import chalk from "chalk"

// TODO - optimize end user server bundles by not exporting all client stuff here
export * from "./index-browser"

// Mechanism used by Vite/Next/Nuxt plugins for automatically loading query and mutation resolvers
function isObject(value: unknown): value is Record<string | symbol, unknown> {
  return typeof value === "object" && value !== null
}
function getGlobalObject<T extends Record<string, unknown>>(key: string, defaultValue: T): T {
  assert(key.startsWith("__internal_blitz"), "unsupported key")
  if (typeof global === "undefined") {
    return defaultValue
  }
  assert(isObject(global), "not an object")
  return ((global as Record<string, unknown>)[key] =
    ((global as Record<string, unknown>)[key] as T) || defaultValue)
}

type Resolver = (...args: unknown[]) => Promise<unknown>
type ResolverFiles = Record<string, () => Promise<{default?: Resolver}>>

// We define `global.__internal_blitzRpcResolverFiles` to ensure we use the same global object.
// Needed for Next.js. I'm guessing that Next.js is including the `node_modules/` files in a seperate bundle than user files.
const g = getGlobalObject<{blitzRpcResolverFilesLoaded: ResolverFiles | null}>(
  "__internal_blitzRpcResolverFiles",
  {
    blitzRpcResolverFilesLoaded: null,
  },
)

export function loadBlitzRpcResolverFilesWithInternalMechanism() {
  return g.blitzRpcResolverFilesLoaded
}

export function __internal_addBlitzRpcResolver(
  routePath: string,
  resolver: () => Promise<{default?: Resolver}>,
) {
  g.blitzRpcResolverFilesLoaded = g.blitzRpcResolverFilesLoaded || {}
  g.blitzRpcResolverFilesLoaded[routePath] = resolver
  return resolver
}

import {resolve} from "path"
const dir = __dirname + (() => "")() // trick to avoid `@vercel/ncc` to glob import
const loaderServer = resolve(dir, "./loader-server.cjs")
const loaderClient = resolve(dir, "./loader-client.cjs")

export function installWebpackConfig<T extends any[]>(config: {module?: {rules?: T}}) {
  config.module!.rules!.push({
    test: /\/\[\[\.\.\.blitz]]\.[jt]s$/,
    use: [{loader: loaderServer}],
  })
  config.module!.rules!.push({
    test: /[\\/](queries|mutations)[\\/]/,
    use: [{loader: loaderClient}],
  })
}

// ----------
// END LOADER
// ----------

async function getResolverMap(): Promise<ResolverFiles | null | undefined> {
  // Handles:
  // - Next.js
  // - Nuxt
  // - Vite with `importBuild.js`
  {
    const resolverFilesLoaded = loadBlitzRpcResolverFilesWithInternalMechanism()
    if (resolverFilesLoaded) {
      return resolverFilesLoaded
    }
  }

  // Handles:
  // - Vite
  // {
  //   const {resolverFilesLoaded, viteProvider} = await loadTelefuncFilesWithVite(runContext)
  //   if (resolverFilesLoaded) {
  //     assertUsage(
  //       Object.keys(resolverFilesLoaded).length > 0,
  //       getErrMsg(`Vite [\`${viteProvider}\`]`),
  //     )
  //     return resolverFilesLoaded
  //   }
  // }
}

interface RpcConfig {
  onError?: (error: Error) => void
}

export function rpcHandler(config: RpcConfig) {
  return async function handleRpcRequest(req: NextApiRequest, res: NextApiResponse, ctx: Ctx) {
    const resolverMap = await getResolverMap()
    assert(resolverMap, "No query or mutation resolvers found")
    assert(
      Array.isArray(req.query.blitz),
      "It seems your Blitz RPC endpoint file is not named [[...blitz]].(jt)s. Please ensure it is",
    )

    const relativeRoutePath = req.query.blitz.join("/")
    const routePath = "/" + relativeRoutePath

    const loadableResolver = resolverMap[routePath]
    if (!loadableResolver) {
      throw new Error("No resolver for path: " + routePath)
    }

    const resolver = (await loadableResolver()).default
    if (!resolver) {
      throw new Error("No default export for resolver path: " + routePath)
    }

    const log = baseLogger().getChildLogger({
      prefix: [relativeRoutePath + "()"],
    })

    const customChalk = new chalk.Instance({
      level: log.settings.type === "json" ? 0 : chalk.level,
    })

    if (req.method === "HEAD") {
      // We used to initiate database connection here
      res.status(200).end()
      return
    } else if (req.method === "POST") {
      // Handle RPC call

      if (typeof req.body.params === "undefined") {
        const error = {message: "Request body is missing the `params` key"}
        log.error(error.message)
        res.status(400).json({
          result: null,
          error,
        })
        return
      }

      try {
        const data = deserialize({
          json: req.body.params,
          meta: req.body.meta?.params,
        })

        log.info(customChalk.dim("Starting with input:"), data ? data : JSON.stringify(data))
        const startTime = Date.now()
        const result = await resolver(data, (res as any).blitzCtx)
        const resolverDuration = Date.now() - startTime
        log.debug(customChalk.dim("Result:"), result ? result : JSON.stringify(result))

        const serializerStartTime = Date.now()
        const serializedResult = superjsonSerialize(result)

        const nextSerializerStartTime = Date.now()
        ;(res as any).blitzResult = result
        res.json({
          result: serializedResult.json,
          error: null,
          meta: {
            result: serializedResult.meta,
          },
        })
        log.debug(
          customChalk.dim(
            `Next.js serialization:${prettyMs(Date.now() - nextSerializerStartTime)}`,
          ),
        )
        const serializerDuration = Date.now() - serializerStartTime
        const duration = Date.now() - startTime

        log.info(
          customChalk.dim(
            `Finished: resolver:${prettyMs(resolverDuration)} serializer:${prettyMs(
              serializerDuration,
            )} total:${prettyMs(duration)}`,
          ),
        )
        newLine()

        return
      } catch (error: any) {
        if (error._clearStack) {
          delete error.stack
        }
        log.error(error)
        newLine()

        if (!error.statusCode) {
          error.statusCode = 500
        }

        const serializedError = superjsonSerialize(error)

        res.json({
          result: null,
          error: serializedError.json,
          meta: {
            error: serializedError.meta,
          },
        })
        return
      }
    } else {
      // Everything else is error
      log.warn(`${req.method} method not supported`)
      res.status(404).end()
      return
    }
  }
}