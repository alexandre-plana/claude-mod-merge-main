export type Behind = {
  branch: string
  base: string
  behind: number
  ahead: number
  stat: string
  commits: string[]
  isDirty: boolean
}

export type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'asking' }
