export function workspaceRouteForRole(workspaceRole) {
  if (workspaceRole === 'receiver') return '/receiver'
  if (workspaceRole === 'sender' || workspaceRole === 'both') return '/dashboard'
  return '/choose-role'
}
