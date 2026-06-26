'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [data, setData] = useState<any>({
    vehicles: [],
    drivers: [],
    trips: [],
    fuelLogs: [],
    maintenance: [],
  })

  useEffect(() => { init() }, [])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles').select('company_id').eq('id', user.id).single()
    if (profile?.company_id) {
      setCompanyId(profile.company_id)
      const { data: company } = await supabase
        .from('companies').select('name').eq('id', profile.company_id).single()
      setCompanyName(company?.name || 'FleetSync')
      fetchAll(profile.company_id)
    }
  }

  const fetchAll = async (cid: string) => {
    const [v, d, t, f, m] = await Promise.all([
      supabase.from('vehicles').select('*').eq('company_id', cid),
      supabase.from('drivers').select('*').eq('company_id', cid),
      supabase.from('trips').select('*').eq('company_id', cid),
      supabase.from('fuel_logs').select('*').eq('company_id', cid),
      supabase.from('maintenance_records').select('*').eq('company_id', cid),
    ])
    setData({
      vehicles: v.data || [],
      drivers: d.data || [],
      trips: t.data || [],
      fuelLogs: f.data || [],
      maintenance: m.data || [],
    })
    setLoading(false)
  }

  const downloadCSV = (filename: string, rows: any[], headers: string[], keys: string[]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => keys.map(k => `"${row[k] ?? ''}"`).join(','))
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const generateVehicleReport = (format: string) => {
    setGenerating('vehicles')
    setTimeout(() => {
      if (format === 'csv') {
        downloadCSV(
          `vehicles-report-${new Date().toISOString().split('T')[0]}.csv`,
          data.vehicles,
          ['Plate Number', 'Model', 'Year', 'Fuel Type', 'Status', 'Insurance Expiry'],
          ['plate_number', 'model', 'year', 'fuel_type', 'status', 'insurance_expiry']
        )
      } else if (format === 'pdf') {
        generatePDF('Vehicle Report', [
          ['Plate Number', 'Model', 'Year', 'Fuel Type', 'Status', 'Insurance Expiry'],
          ...data.vehicles.map((v: any) => [v.plate_number, v.model, v.year, v.fuel_type, v.status, v.insurance_expiry])
        ])
      }
      setGenerating('')
    }, 500)
  }

  const generateDriverReport = (format: string) => {
    setGenerating('drivers')
    setTimeout(() => {
      if (format === 'csv') {
        downloadCSV(
          `drivers-report-${new Date().toISOString().split('T')[0]}.csv`,
          data.drivers,
          ['Full Name', 'Phone', 'License Number', 'License Expiry', 'Status'],
          ['full_name', 'phone', 'license_number', 'license_expiry', 'status']
        )
      } else if (format === 'pdf') {
        generatePDF('Driver Report', [
          ['Full Name', 'Phone', 'License Number', 'License Expiry', 'Status'],
          ...data.drivers.map((d: any) => [d.full_name, d.phone, d.license_number, d.license_expiry, d.status])
        ])
      }
      setGenerating('')
    }, 500)
  }

  const generateFuelReport = (format: string) => {
    setGenerating('fuel')
    setTimeout(() => {
      if (format === 'csv') {
        downloadCSV(
          `fuel-report-${new Date().toISOString().split('T')[0]}.csv`,
          data.fuelLogs,
          ['Date', 'Liters', 'Cost (ETB)', 'Fuel Station', 'Mileage'],
          ['date', 'liters', 'cost', 'fuel_station', 'mileage']
        )
      } else if (format === 'pdf') {
        generatePDF('Fuel Report', [
          ['Date', 'Liters', 'Cost (ETB)', 'Fuel Station', 'Mileage'],
          ...data.fuelLogs.map((f: any) => [f.date, f.liters, f.cost, f.fuel_station, f.mileage])
        ])
      }
      setGenerating('')
    }, 500)
  }

  const generateTripReport = (format: string) => {
    setGenerating('trips')
    setTimeout(() => {
      if (format === 'csv') {
        downloadCSV(
          `trips-report-${new Date().toISOString().split('T')[0]}.csv`,
          data.trips,
          ['Start Location', 'Destination', 'Distance (km)', 'Fuel Used (L)', 'Status', 'Start Time'],
          ['start_location', 'destination', 'distance', 'fuel_used', 'status', 'start_time']
        )
      } else if (format === 'pdf') {
        generatePDF('Trip Report', [
          ['Start Location', 'Destination', 'Distance (km)', 'Fuel Used (L)', 'Status'],
          ...data.trips.map((t: any) => [t.start_location, t.destination, t.distance, t.fuel_used, t.status])
        ])
      }
      setGenerating('')
    }, 500)
  }

  const generateMaintenanceReport = (format: string) => {
    setGenerating('maintenance')
    setTimeout(() => {
      if (format === 'csv') {
        downloadCSV(
          `maintenance-report-${new Date().toISOString().split('T')[0]}.csv`,
          data.maintenance,
          ['Service Type', 'Cost (ETB)', 'Service Date', 'Next Service Date', 'Notes'],
          ['service_type', 'cost', 'service_date', 'next_service_date', 'notes']
        )
      } else if (format === 'pdf') {
        generatePDF('Maintenance Report', [
          ['Service Type', 'Cost (ETB)', 'Service Date', 'Next Service Date', 'Notes'],
          ...data.maintenance.map((m: any) => [m.service_type, m.cost, m.service_date, m.next_service_date, m.notes])
        ])
      }
      setGenerating('')
    }, 500)
  }

  const generateFinancialReport = (format: string) => {
    setGenerating('financial')
    const totalFuel = data.fuelLogs.reduce((s: number, l: any) => s + (l.cost || 0), 0)
    const totalMaint = data.maintenance.reduce((s: number, m: any) => s + (m.cost || 0), 0)
    setTimeout(() => {
      if (format === 'csv') {
        const rows = [
          { category: 'Total Fuel Cost', amount: totalFuel },
          { category: 'Total Maintenance Cost', amount: totalMaint },
          { category: 'Total Operational Cost', amount: totalFuel + totalMaint },
          { category: 'Total Trips', amount: data.trips.length },
          { category: 'Total Vehicles', amount: data.vehicles.length },
          { category: 'Total Drivers', amount: data.drivers.length },
        ]
        downloadCSV(
          `financial-summary-${new Date().toISOString().split('T')[0]}.csv`,
          rows,
          ['Category', 'Amount'],
          ['category', 'amount']
        )
      } else if (format === 'pdf') {
        generatePDF('Financial Summary', [
          ['Category', 'Amount (ETB)'],
          ['Total Fuel Cost', `ETB ${totalFuel.toLocaleString()}`],
          ['Total Maintenance Cost', `ETB ${totalMaint.toLocaleString()}`],
          ['Total Operational Cost', `ETB ${(totalFuel + totalMaint).toLocaleString()}`],
          ['Total Trips', data.trips.length.toString()],
          ['Total Vehicles', data.vehicles.length.toString()],
          ['Total Drivers', data.drivers.length.toString()],
        ])
      }
      setGenerating('')
    }, 500)
  }

  const generatePDF = (title: string, tableData: string[][]) => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
          h1 { color: #1d4ed8; margin-bottom: 4px; }
          .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th { background: #1d4ed8; color: white; padding: 10px 12px; text-align: left; }
          td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) { background: #f9fafb; }
          .footer { margin-top: 20px; color: #999; font-size: 12px; }
        </style>
      </head>
      <body>
        <h1>${companyName} — ${title}</h1>
        <div class="meta">Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</div>
        <table>
          <thead>
            <tr>${tableData[0].map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${tableData.slice(1).map(row =>
              `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`
            ).join('')}
          </tbody>
        </table>
        <div class="footer">FleetSync — Fleet Management System</div>
      </body>
      </html>
    `
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) {
      win.onload = () => {
        win.print()
      }
    }
    URL.revokeObjectURL(url)
  }

  const reports = [
    {
      id: 'vehicles',
      title: 'Vehicle Report',
      description: 'All vehicles with plate numbers, models, status and insurance details',
      icon: '🚗',
      count: data.vehicles.length,
      color: 'border-blue-500/30 bg-blue-500/5',
      iconBg: 'bg-blue-500/20',
      generate: generateVehicleReport,
    },
    {
      id: 'drivers',
      title: 'Driver Report',
      description: 'All drivers with license details, contact info and status',
      icon: '👤',
      count: data.drivers.length,
      color: 'border-purple-500/30 bg-purple-500/5',
      iconBg: 'bg-purple-500/20',
      generate: generateDriverReport,
    },
    {
      id: 'trips',
      title: 'Trip Report',
      description: 'All trips with routes, distances, fuel used and status',
      icon: '🗺️',
      count: data.trips.length,
      color: 'border-orange-500/30 bg-orange-500/5',
      iconBg: 'bg-orange-500/20',
      generate: generateTripReport,
    },
    {
      id: 'fuel',
      title: 'Fuel Report',
      description: 'All fuel logs with costs, liters, stations and mileage',
      icon: '⛽',
      count: data.fuelLogs.length,
      color: 'border-green-500/30 bg-green-500/5',
      iconBg: 'bg-green-500/20',
      generate: generateFuelReport,
    },
    {
      id: 'maintenance',
      title: 'Maintenance Report',
      description: 'All service records with costs, dates and next service dates',
      icon: '🔧',
      count: data.maintenance.length,
      color: 'border-yellow-500/30 bg-yellow-500/5',
      iconBg: 'bg-yellow-500/20',
      generate: generateMaintenanceReport,
    },
    {
      id: 'financial',
      title: 'Financial Summary',
      description: 'Complete financial overview with total costs and operational expenses',
      icon: '💰',
      count: null,
      color: 'border-cyan-500/30 bg-cyan-500/5',
      iconBg: 'bg-cyan-500/20',
      generate: generateFinancialReport,
    },
  ]

  const totalFuelCost = data.fuelLogs.reduce((s: number, l: any) => s + (l.cost || 0), 0)
  const totalMaintCost = data.maintenance.reduce((s: number, m: any) => s + (m.cost || 0), 0)

  return (
    <div>
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-gray-400 mt-1">Export your fleet data as PDF or CSV</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Vehicles</p>
          <p className="text-2xl font-bold text-white">{data.vehicles.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Drivers</p>
          <p className="text-2xl font-bold text-white">{data.drivers.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Fuel Cost</p>
          <p className="text-2xl font-bold text-blue-400">ETB {totalFuelCost.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Maint Cost</p>
          <p className="text-2xl font-bold text-yellow-400">ETB {totalMaintCost.toLocaleString()}</p>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => (
          <div key={report.id} className={`border rounded-2xl p-6 ${report.color}`}>
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${report.iconBg}`}>
                {report.icon}
              </div>
              {report.count !== null && (
                <span className="bg-gray-800 text-gray-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {report.count} records
                </span>
              )}
            </div>

            <h3 className="text-white font-semibold text-lg mb-1">{report.title}</h3>
            <p className="text-gray-400 text-sm mb-6">{report.description}</p>

            <div className="flex gap-2">
              <button
                onClick={() => report.generate('pdf')}
                disabled={generating === report.id}
                className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                {generating === report.id ? (
                  <span>Generating...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    PDF
                  </>
                )}
              </button>
              <button
                onClick={() => report.generate('csv')}
                disabled={generating === report.id}
                className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                {generating === report.id ? (
                  <span>Generating...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    CSV
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* How to use */}
      <div className="mt-8 bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">How to use Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <p className="text-white text-sm font-medium">PDF Reports</p>
              <p className="text-gray-400 text-xs mt-1">Opens a printable page in a new tab. Use your browser print function to save as PDF or print directly.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <p className="text-white text-sm font-medium">CSV Reports</p>
              <p className="text-gray-400 text-xs mt-1">Downloads a CSV file you can open in Excel, Google Sheets or any spreadsheet app.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}