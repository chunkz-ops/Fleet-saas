import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useCompany() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getCompany = async () => {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.user) {
        setLoading(false)
        return
      }

      setUserId(session.user.id)

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', session.user.id)
        .single()

      if (profile?.company_id) {
        setCompanyId(profile.company_id)
      }

      setLoading(false)
    }

    getCompany()
  }, [])

  return { companyId, userId, loading }
}