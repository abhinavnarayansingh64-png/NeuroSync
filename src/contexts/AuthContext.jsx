/**
 * Authentication context.
 *
 * Provides mock authentication backed by localStorage, exactly as required
 * by PRD Section 1 ("Backend authentication will be implemented in a future
 * section. Use mock authentication for now."). The API surface — login,
 * signup, logout, updateProfile, changePassword — mirrors what a real auth
 * service would expose, so swapping in a backend later is a drop-in change.
 *
 * Passwords are stored only to make the mock login flow feel real; this is a
 * client-side demo and must never be treated as secure credential storage.
 */

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { STORAGE_KEYS, readStorage, writeStorage, removeStorage } from '../services/storage'
import { uid } from '../utils/id'

const AuthContext = createContext(null)

/** Strip sensitive fields before exposing a user object to the app. */
function toPublicUser(user) {
  if (!user) return null
  const { password, ...publicUser } = user
  return publicUser
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  // Restore the persisted session on first mount.
  useEffect(() => {
    const session = readStorage(STORAGE_KEYS.auth, null)
    if (session?.user) {
      setUser(session.user)
    }
    setInitializing(false)
  }, [])

  const persistSession = useCallback((publicUser, remember) => {
    setUser(publicUser)
    // Persist regardless of "remember" so a refresh keeps the session (per
    // the success criteria). "remember" is reserved for future token TTLs.
    writeStorage(STORAGE_KEYS.auth, { user: publicUser, remember: !!remember })
  }, [])

  const signup = useCallback(({ fullName, email, password }) => {
    const users = readStorage(STORAGE_KEYS.users, [])
    const normalizedEmail = email.trim().toLowerCase()
    const exists = users.some((u) => u.email === normalizedEmail)
    if (exists) {
      return { success: false, error: 'An account with this email already exists.' }
    }
    const newUser = {
      id: uid('user'),
      fullName: fullName.trim(),
      email: normalizedEmail,
      password,
      createdAt: new Date().toISOString(),
    }
    writeStorage(STORAGE_KEYS.users, [...users, newUser])
    persistSession(toPublicUser(newUser), true)
    return { success: true }
  }, [persistSession])

  const login = useCallback(({ email, password, remember }) => {
    const users = readStorage(STORAGE_KEYS.users, [])
    const normalizedEmail = email.trim().toLowerCase()
    const match = users.find((u) => u.email === normalizedEmail)
    if (!match || match.password !== password) {
      return { success: false, error: 'Invalid email or password.' }
    }
    persistSession(toPublicUser(match), remember)
    return { success: true }
  }, [persistSession])

  const logout = useCallback(() => {
    setUser(null)
    removeStorage(STORAGE_KEYS.auth)
  }, [])

  /** Update the current user's profile (name/email). */
  const updateProfile = useCallback(({ fullName, email }) => {
    if (!user) return { success: false, error: 'Not authenticated.' }
    const users = readStorage(STORAGE_KEYS.users, [])
    const normalizedEmail = email.trim().toLowerCase()
    const clash = users.some((u) => u.email === normalizedEmail && u.id !== user.id)
    if (clash) {
      return { success: false, error: 'That email is already in use by another account.' }
    }
    const updatedUsers = users.map((u) =>
      u.id === user.id ? { ...u, fullName: fullName.trim(), email: normalizedEmail } : u,
    )
    writeStorage(STORAGE_KEYS.users, updatedUsers)
    const updatedPublic = { ...user, fullName: fullName.trim(), email: normalizedEmail }
    persistSession(updatedPublic, true)
    return { success: true }
  }, [user, persistSession])

  /** Change the current user's password after verifying the current one. */
  const changePassword = useCallback(({ currentPassword, newPassword }) => {
    if (!user) return { success: false, error: 'Not authenticated.' }
    const users = readStorage(STORAGE_KEYS.users, [])
    const record = users.find((u) => u.id === user.id)
    if (!record || record.password !== currentPassword) {
      return { success: false, error: 'Current password is incorrect.' }
    }
    const updatedUsers = users.map((u) =>
      u.id === user.id ? { ...u, password: newPassword } : u,
    )
    writeStorage(STORAGE_KEYS.users, updatedUsers)
    return { success: true }
  }, [user])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      initializing,
      login,
      signup,
      logout,
      updateProfile,
      changePassword,
    }),
    [user, initializing, login, signup, logout, updateProfile, changePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.')
  }
  return context
}
