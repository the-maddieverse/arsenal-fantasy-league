import { supabase } from './supabase'

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw error

  const userId = data.user?.id
  if (!userId) return

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id: userId, display_name: displayName.trim() })
  if (profileError) throw profileError
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
