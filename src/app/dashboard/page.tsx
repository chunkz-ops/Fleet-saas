'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Stats {
  totalVehicles: number
  activeVehicles: number
  maintenanceVehicles: number
  totalDrivers: number
  activeDrivers: number
  totalTrips: number
  totalFuelCost: number
  totalMaintenanceCost: number
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400 text-sm font-medium">{title}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-white">{value}</p>
      {subtitle && <p className="text-gray-500 text-xs mt-1">{subtitle}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalVehicles: 0,
    activeVehicles: 0,
    maintenanceVehicles: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    totalTrips: 0,
    totalFuelCost: 0,
    totalMaintenanceCost: 0,
  })
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*, companies(name)')
      .eq('id', user.id)
      .single()
    setProfile(profileData)

    const companyId = profileData?.company_id
    if (!companyId) {
      setLoading(false)
      return
    }

    const [vehicles, drivers, trips, fuel, maintenance] = await Promise.all([
      supabase.from('vehicles').select('status').eq('company_id', companyId),
      supabase.from('drivers').select('status').eq('company_id', companyId),
      supabase.from('trips').select('id').eq('company_id', companyId),
      supabase.from('fuel_logs').select('cost').eq('company_id', companyId),
      supabase.from('maintenance_records').select('cost').eq('company_id', companyId),
    ])

    setStats({
      totalVehicles: vehicles.data?.length || 0,
      activeVehicles: vehicles.data?.filter((v) => v.status === 'active').length || 0,
      maintenanceVehicles: vehicles.data?.filter((v) => v.status === 'maintenance').length || 0,
      totalDrivers: drivers.data?.length || 0,
      activeDrivers: drivers.data?.filter((d) => d.status === 'active').length || 0,
      totalTrips: trips.data?.length || 0,
      totalFuelCost: fuel.data?.reduce((s, f) => s + (f.cost || 0), 0) || 0,
      totalMaintenanceCost: maintenance.data?.reduce((s, m) => s + (m.cost || 0), 0) || 0,
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p className="text-gray-400 mt-1">
          {profile?.companies?.name || 'Your Fleet'} — Overview
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPICard
          title="Total Vehicles"
          value={stats.totalVehicles}
          subtitle={`${stats.activeVehicles} active`}
          color="bg-blue-600/20"
          icon={
            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4zm-8-3h8a2 2 0 002-2V6a2 2 0 00-2-2H8a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          }
        />
        <KPICard
          title="Total Drivers"
          value={stats.totalDrivers}
          subtitle={`${stats.activeDrivers} active`}
          color="bg-purple-600/20"
          icon={
            <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <KPICard
          title="Total Trips"
          value={stats.totalTrips}
          subtitle="All time"
          color="bg-orange-600/20"
          icon={
            <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          }
        />
        <KPICard
          title="Total Cost"
          value={`ETB ${(stats.totalFuelCost + stats.totalMaintenanceCost).toLocaleString()}`}
          subtitle="Fuel + Maintenance"
          color="bg-red-600/20"
          icon={
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <KPICard
          title="In Maintenance"
          value={stats.maintenanceVehicles}
          subtitle="Vehicles"
          color="bg-yellow-600/20"
          icon={
            <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <KPICard
          title="Fuel Cost"
          value={`ETB ${stats.totalFuelCost.toLocaleString()}`}
          subtitle="All time"
          color="bg-green-600/20"
          icon={
            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
          }
        />
        <KPICard
          title="Maintenance Cost"
          value={`ETB ${stats.totalMaintenanceCost.toLocaleString()}`}
          subtitle="All time"
          color="bg-cyan-600/20"
          icon={
            <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/vehicles" className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm text-gray-300">Add Vehicle</span>
          </a>
          <a href="/drivers" className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm text-gray-300">Add Driver</span>
          </a>
          <a href="/trips" className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm text-gray-300">New Trip</span>
          </a>
          <a href="/fuel" className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm text-gray-300">Log Fuel</span>
          </a>
          <a href="/maintenance" className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm text-gray-300">Add Service</span>
          </a>
          <a href="/analytics" className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="text-sm text-gray-300">Analytics</span>
          </a>
          <a href="/gps" className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm text-gray-300">GPS Tracking</span>
          </a>
          <a href="/settings" className="flex flex-col items-center gap-2 p-4 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm text-gray-300">Settings</span>
          </a>
        </div>
      </div>
    </div>
  )
}