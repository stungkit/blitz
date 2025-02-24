import {useSuspenseInfiniteQuery} from "@blitzjs/rpc"
import getInfiniteUsers from "src/queries/getInfiniteUsers"
import {useActionState} from "react"

function PageWithInfiniteQueryMutate(props) {
  const [usersPages, extraInfo] = useSuspenseInfiniteQuery(
    getInfiniteUsers,
    (page = {take: 3, skip: 0}) => page,
    {
      getNextPageParam: (lastPage) => lastPage.nextPage,
      initialPageParam: {take: 3, skip: 0},
    },
  )
  const {isFetchingNextPage, fetchNextPage, hasNextPage, setQueryData} = extraInfo

  const onOnContactSave = async (previousState, formData: FormData) => {
    const name = formData.get("name") as string | null

    await setQueryData(
      (oldData) => {
        if (!oldData) {
          return {
            pages: [],
            pageParams: [],
          }
        }

        return {
          ...oldData,
          pages: oldData.pages.map((page, index) => {
            if (index === 0) {
              return {
                ...page,
                users: [
                  {
                    id: Math.random(),
                    name,
                    role: "user",
                    email: `${name}@yopmail.com`,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    hashedPassword: "alsdklaskdoaskdokdo",
                  },
                  ...page.users,
                ],
              }
            }
            return page
          }),
        }
      },
      {refetch: false},
    )
  }

  const [, formAction] = useActionState(onOnContactSave, {name: ""})

  return (
    <div>
      <form action={formAction}>
        <input type="text" name="name" placeholder="User name" />
        <button type="submit">Add user</button>
      </form>
      {usersPages.map((usersPage) => (
        <>
          {usersPage?.users.map((u) => (
            <div key={u.name}>
              <p>name: {u.name}</p>
              <p>role: {u.role}</p>
              <p>email: {u.email}</p>
              <hr />
            </div>
          ))}

          {usersPage.hasMore && (
            <button onClick={() => fetchNextPage()} disabled={!hasNextPage || !!isFetchingNextPage}>
              {isFetchingNextPage
                ? "Loading more..."
                : hasNextPage
                ? "Load More"
                : "Nothing more to load"}
            </button>
          )}
        </>
      ))}
    </div>
  )
}

export default PageWithInfiniteQueryMutate
