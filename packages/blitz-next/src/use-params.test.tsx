/**
 * @vitest-environment jsdom
 */
import React from "react"
import {describe, it, expect, vi, afterEach} from "vitest"
import {extractRouterParams, useParam, useParams} from "./use-params"
import {renderHook as defaultRenderHook} from "@testing-library/react"
import {NextRouter} from "next/router"
import {RouterContext} from "./router-context"

type DefaultHookParams = Parameters<typeof defaultRenderHook>
type RenderHook = DefaultHookParams[0]
type RenderHookOptions = DefaultHookParams[1] & {
  router?: Partial<NextRouter>
  dehydratedState?: unknown
}

// This is the router query object which includes route params
const query = {
  id: "1",
  cat: "category",
  slug: ["example", "multiple", "slugs"],
  empty: "",
}

const mockRouter: NextRouter = {
  basePath: "",
  pathname: "/",
  route: "/",
  asPath: "/",
  query: {},
  isReady: true,
  isLocaleDomain: false,
  isPreview: false,
  push: vi.fn(),
  replace: vi.fn(),
  reload: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
  beforePopState: vi.fn(),
  events: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  },
  isFallback: false,
  forward: vi.fn(),
}

export function renderHook(
  hook: RenderHook,
  {router, dehydratedState, ...options}: RenderHookOptions = {},
) {
  const wrapper = ({children}: {children: React.ReactNode}) =>
    (
      <RouterContext.Provider value={{...mockRouter, ...router}}>{children}</RouterContext.Provider>
    ) as React.ReactElement
  wrapper.displayName = "wrapper"

  return defaultRenderHook(hook, {wrapper, ...options})
}

describe("extractRouterParams", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("returns proper params", () => {
    const routerQuery = {
      id: "1",
      cat: "category",
      slug: ["example", "multiple", "slugs"],
      empty: "",
      queryArray: ["1", "123", ""],
    }

    const query = {
      cat: "somethingelse",
      slug: ["query-slug"],
      queryArray: ["1", "123", ""],
      onlyInQuery: "onlyInQuery",
    }

    const params = extractRouterParams(routerQuery, query)
    expect(params).toEqual({
      id: "1",
      cat: "category",
      slug: ["example", "multiple", "slugs"],
      empty: "",
    })
  })
})

describe("useParams", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("works without parameter", () => {
    vi.mock("next/compat/router", () => {
      return {
        useRouter: vi.fn(() => ({...mockRouter, query})),
      }
    })

    it("works with string", () => {
      vi.mock("next/compat/router", () => {
        return {
          useRouter: vi.fn(() => ({...mockRouter, query})),
        }
      })

      const {result} = renderHook(() => useParams("string"), {
        router: {query},
      })
      expect(result.current).toEqual({
        id: "1",
        cat: "category",
        empty: "",
      })
    })

    it("works with string", () => {
      vi.mock("next/compat/router", () => {
        return {
          useRouter: vi.fn(() => ({...mockRouter, query})),
        }
      })

      const {result} = renderHook(() => useParams("string"), {
        router: {query},
      })
      expect(result.current).toEqual({
        id: "1",
        cat: "category",
        empty: "",
      })
    })

    it("works with number", () => {
      vi.mock("next/compat/router", () => {
        return {
          useRouter: vi.fn(() => ({...mockRouter, query})),
        }
      })

      const {result} = renderHook(() => useParams("number"), {
        router: {query},
      })
      expect(result.current).toEqual({
        id: 1,
        cat: undefined,
        slug: undefined,
      })
    })

    it("works with array", () => {
      vi.mock("next/compat/router", () => {
        return {
          useRouter: vi.fn(() => ({...mockRouter, query})),
        }
      })

      const {result} = renderHook(() => useParams("array"), {
        router: {query},
      })
      expect(result.current).toEqual({
        id: ["1"],
        cat: ["category"],
        slug: ["example", "multiple", "slugs"],
        empty: [""],
      })
    })
  })
})

describe("useParam", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("works without parameter", () => {
    vi.mock("next/compat/router", () => {
      return {
        useRouter: vi.fn(() => ({...mockRouter, query})),
      }
    })

    let {result} = renderHook(() => useParam("id"), {router: {query}})
    expect(result.current).toEqual("1")
    ;({result} = renderHook(() => useParam("cat"), {router: {query}}))
    expect(result.current).toEqual("category")
    ;({result} = renderHook(() => useParam("slug"), {router: {query}}))
    expect(result.current).toEqual(["example", "multiple", "slugs"])
    ;({result} = renderHook(() => useParam("empty"), {router: {query}}))
    expect(result.current).toEqual("")
    ;({result} = renderHook(() => useParam("doesnt-exist"), {
      router: {query},
    }))
    expect(result.current).toBeUndefined()
  })

  it("works with string", () => {
    vi.mock("next/compat/router", () => {
      return {
        useRouter: vi.fn(() => ({...mockRouter, query})),
      }
    })

    let {result} = renderHook(() => useParam("id", "string"), {
      router: {query},
    })
    expect(result.current).toEqual("1")
    ;({result} = renderHook(() => useParam("cat", "string"), {
      router: {query},
    }))
    expect(result.current).toEqual("category")
    ;({result} = renderHook(() => useParam("slug", "string"), {
      router: {query},
    }))
    expect(result.current).toEqual(undefined)
    ;({result} = renderHook(() => useParam("empty", "string"), {
      router: {query},
    }))
    expect(result.current).toEqual("")
    ;({result} = renderHook(() => useParam("doesnt-exist", "string"), {
      router: {query},
    }))
    expect(result.current).toBeUndefined()
  })

  it("works with number", () => {
    // This is the router query object which includes route params
    const query = {
      id: "1",
      cat: "category",
      slug: ["example", "multiple", "slugs"],
      empty: "",
    }

    let {result} = renderHook(() => useParam("id", "number"), {
      router: {query},
    })
    expect(result.current).toEqual(1)
    ;({result} = renderHook(() => useParam("cat", "number"), {
      router: {query},
    }))
    expect(result.current).toBeUndefined()
    ;({result} = renderHook(() => useParam("slug", "number"), {
      router: {query},
    }))
    expect(result.current).toBeUndefined()
    ;({result} = renderHook(() => useParam("empty", "number"), {
      router: {query},
    }))
    expect(result.current).toBeUndefined()
    ;({result} = renderHook(() => useParam("doesnt-exist", "number"), {
      router: {query},
    }))
    expect(result.current).toBeUndefined()
  })

  it("works with array", () => {
    // This is the router query object which includes route params
    const query = {
      id: "1",
      cat: "category",
      slug: ["example", "multiple", "slugs"],
      empty: "",
    }

    let {result} = renderHook(() => useParam("id", "array"), {
      router: {query},
    })
    expect(result.current).toEqual(["1"])
    ;({result} = renderHook(() => useParam("cat", "array"), {
      router: {query},
    }))
    expect(result.current).toEqual(["category"])
    ;({result} = renderHook(() => useParam("slug", "array"), {
      router: {query},
    }))
    expect(result.current).toEqual(["example", "multiple", "slugs"])
    ;({result} = renderHook(() => useParam("empty", "array"), {
      router: {query},
    }))
    expect(result.current).toEqual([""])
    ;({result} = renderHook(() => useParam("doesnt-exist", "array"), {
      router: {query},
    }))
    expect(result.current).toBeUndefined()
  })
})
