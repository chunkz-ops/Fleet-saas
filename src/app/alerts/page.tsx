'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Alert {
  id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
}

export default function AlertsPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
      await generateAlerts(profile.company_id)
      fetchAlerts(profile.company_id)
    }
  }

  const generateAlerts = async (cid: string) => {
    const today = new Date()
    const in30Days = new Date()
    in30Days.setDate(today.getDate() + 30)

    const [vehiclesRes, driversRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('company_id', cid),
      supabase.from('drivers').select('*').eq('company_id', cid),
    ])

    const newAlerts: any[] = []

    vehiclesRes.data?.forEach((v) => {
      if (!v.insurance_expiry) return
      const expiry = new Date(v.insurance_expiry)
      if (expiry < today) {
        newAlerts.push({
          company_id: cid,
          type: 'insurance_expired',
          message: `Vehicle ${v.plate_number} insurance has EXPIRED on ${v.insurance_expiry}`,
          is_read: false,
        })
      } else if (expiry <= in30Days) {
        newAlerts.push({
          company_id: cid,
          type: 'insurance_expiring',
          message: `Vehicle ${v.plate_number} insurance expires on ${v.insurance_expiry}`,
          is_read: false,
        })
      }
    })

    driversRes.data?.forEach((d) => {
      if (!d.license_expiry) return
      const expiry = new Date(d.license_expiry)
      if (expiry < today) {
        newAlerts.push({
          company_id: cid,
          type: 'license_expired',
          message: `Driver ${d.full_name} license has EXPIRED on ${d.license_expiry}`,
          is_read: false,
        })
      } else if (expiry <= in30Days) {
        newAlerts.push({
          company_id: cid,
          type: 'license_expiring',
          message: `Driver ${d.full_name} license expires on ${d.license_expiry}`,
          is_read: false,
        })
      }
    })

    if (newAlerts.length > 0) {
      await supabase.from('alerts').delete().eq('company_id', cid)
      await supabase.from('alerts').insert(newAlerts)
    }
  }

  const fetchAlerts = async (cid: string) => {
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('company_id', cid)
      .order('created_at', { ascending: false })
    setAlerts(data || [])
    setLoading(false)
  }

  const markRead = async (id: string) => {
    await supabase.from('alerts').update({ is_read: true }).eq('id', id)
    if (companyId) fetchAlerts(companyId)
  }

  const markAllRead = async () => {
    if (!companyId) return
    await supabase.from('alerts').update({ is_read: true }).eq('company_id', companyId)
    fetchAlerts(companyId)
  }

  const deleteAlert = async (id: string) => {
    await supabase.from('alerts').delete().eq('id', id)
    if (companyId) fetchAlerts(companyId)
  }

  const alertIcon = (type: string) => {
    switch (type) {
      case 'insurance_expired': return '🚨'
      case 'insurance_expiring': return '⚠️'
      case 'license_expired': return '🚨'
      case 'license_expiring': return '⚠️'
      case 'maintenance_overdue': return '🔧'
      case 'high_fuel': return '⛽'
      default: return '🔔'
    }
  }

  const alertColor = (type: string) => {
    if (type.includes('expired')) return 'border-red-500/30 bg-red-500/5'
    if (type.includes('expiring')) return 'border-yellow-500/30 bg-yellow-500/5'
    if (type.includes('maintenance')) return 'border-orange-500/30 bg-orange-500/5'
    return 'border-blue-500/30 bg-blue-500/5'
  }

  const alertBadgeColor = (type: string) => {
    if (type.includes('expired')) return 'bg-red-500/20 text-red-400'
    if (type.includes('expiring')) return 'bg-yellow-500/20 text-yellow-400'
    if (type.includes('maintenance')) return 'bg-orange-500/20 text-orange-400'
    return 'bg-blue-500/20 text-blue-400'
  }

  const alertLabel = (type: string) => {
    switch (type) {
      case 'insurance_expired': return 'Insurance Expired'
      case 'insurance_expiring': return 'Insurance Expiring'
      case 'license_expired': return 'License Expired'
      case 'license_expiring': return 'License Expiring'
      case 'maintenance_overdue': return 'Maintenance Overdue'
      case 'high_fuel': return 'High Fuel Usage'
      default: return 'Alert'
    }
  }

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'unread') return !a.is_read
    if (filter === 'read') return a.is_read
    return true
  })

  const unreadCount = alerts.filter((a) => !a.is_read).length

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Alerts</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="text-gray-400 mt-1">Stay on top of expiries and issues</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Alerts</p>
          <p className="text-2xl font-bold text-white">{alerts.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Unread</p>
          <p className="text-2xl font-bold text-red-400">{unreadCount}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Expired</p>
          <p className="text-2xl font-bold text-red-400">
            {alerts.filter(a => a.type.includes('expired')).length}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Expiring Soon</p>
          <p className="text-2xl font-bold text-yellow-400">
            {alerts.filter(a => a.type.includes('expiring')).length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {['all', 'unread', 'read'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading alerts...</div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🎉</p>
          <p className="text-white font-semibold text-lg">No alerts!</p>
          <p className="text-gray-400 mt-2">Everything looks good with your fleet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`border rounded-2xl p-5 transition-all ${alertColor(alert.type)} ${
                !alert.is_read ? 'opacity-100' : 'opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <span className="text-2xl">{alertIcon(alert.type)}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${alertBadgeColor(alert.type)}`}>
                        {alertLabel(alert.type)}
                      </span>
                      {!alert.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-400" />
                      )}
                    </div>
                    <p className="text-white text-sm font-medium">{alert.message}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!alert.is_read && (
                    <button
                      onClick={() => markRead(alert.id)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    onClick={() => deleteAlert(alert.id)}
                    className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}