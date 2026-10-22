import { createContext, useCallback, useContext, useMemo } from 'react'
import { trpc } from '../lib/trpc'
import { startLogin } from '../const'

const AuthContext = createContext(null)

function toWorkspaceUser(user) {
  if (!user) return null
  return { ...user, fullName: user.name || user.email || 'NeuroSync operator' }
}

export function AuthProvider({ children }) {
  const utils = trpc.useUtils()
  const account = trpc.auth.me.useQuery(undefined, { retry: false, staleTime: 60_000 })
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => utils.auth.me.setData(undefined, null),
  })

  const login = useCallback(() => {
    startLogin()
    return { success: true }
  }, [])

  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync()
    try {
      // Preview environments may mirror an authenticated session into session
      // storage when an iframe cannot send its HttpOnly cookie. Removing this
      // bearer fallback is necessary for logout to have the same meaning in
      // preview and on the published domain.
      sessionStorage.removeItem('manus-cookie')
    } catch {
      // Session storage can be unavailable in hardened browser contexts.
    }
    utils.auth.me.setData(undefined, null)
  }, [logoutMutation, utils])

  const managedOnly = useCallback(() => ({
    success: false,
    error: 'Account identity and credentials are managed securely by your connected sign-in provider.',
  }), [])

  const value = useMemo(() => ({
    user: toWorkspaceUser(account.data),
    isAuthenticated: !!account.data && !account.isError,
    initializing: account.isLoading,
    login,
    signup: login,
    logout,
    updateProfile: managedOnly,
    changePassword: managedOnly,
  }), [account.data, account.isError, account.isLoading, login, logout, managedOnly])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider.')
  return context
}
