export type Role = 'super_admin' | 'fleet_manager' | 'dispatcher' | 'accountant'
export type VehicleStatus = 'active' | 'maintenance' | 'inactive' | 'retired'
export type DriverStatus = 'active' | 'inactive'
export type TripStatus = 'pending' | 'active' | 'completed' | 'cancelled'

export interface Company {
  id: string
  name: string
  created_at: string
}

export interface Profile {
  id: string
  full_name: string
  role: Role
  company_id: string
  created_at: string
}

export interface Vehicle {
  id: string
  company_id: string
  plate_number: string
  model: string
  year: number
  fuel_type: string
  status: VehicleStatus
  insurance_expiry: string
  created_at: string
}

export interface Driver {
  id: string
  company_id: string
  full_name: string
  phone: string
  license_number: string
  license_expiry: string
  assigned_vehicle: string
  status: DriverStatus
  created_at: string
}

export interface Trip {
  id: string
  company_id: string
  driver_id: string
  vehicle_id: string
  start_location: string
  destination: string
  start_time: string
  end_time: string
  distance: number
  fuel_used: number
  status: TripStatus
  created_at: string
}

export interface FuelLog {
  id: string
  company_id: string
  vehicle_id: string
  driver_id: string
  liters: number
  cost: number
  mileage: number
  fuel_station: string
  date: string
  created_at: string
}

export interface MaintenanceRecord {
  id: string
  company_id: string
  vehicle_id: string
  service_type: string
  cost: number
  notes: string
  service_date: string
  next_service_date: string
  created_at: string
}

export interface Alert {
  id: string
  company_id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
}