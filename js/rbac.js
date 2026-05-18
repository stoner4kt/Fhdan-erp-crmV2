// Role-Based Access Control
// Defines what each role can access and do

export const PERMISSIONS = {
  system_admin: ['dashboard','fleet','bookings','clients','finance','vault','drivers','settings','setup',
                 'create_booking','edit_booking','delete_booking',
                 'create_vehicle','edit_vehicle','delete_vehicle',
                 'create_client','edit_client','delete_client',
                 'create_driver','edit_driver','delete_driver',
                 'create_invoice','record_payment','manage_users','upload_document'],

  manager: ['dashboard','fleet','bookings','clients','finance','vault','drivers','setup',
            'create_booking','edit_booking','delete_booking',
            'create_vehicle','edit_vehicle',
            'create_client','edit_client',
            'create_driver','edit_driver',
            'create_invoice','record_payment','upload_document'],

  finance_officer: ['dashboard','bookings','finance','vault','setup',
                    'create_invoice','record_payment','upload_document'],

  sales_agent: ['dashboard','bookings','clients','vault','setup',
                'create_booking','edit_booking',
                'create_client','edit_client','upload_document'],

  fleet_coordinator: ['dashboard','fleet','bookings','drivers','vault','setup',
                      'create_booking','edit_booking',
                      'create_vehicle','edit_vehicle',
                      'create_driver','edit_driver','upload_document'],

  driver: ['driver_trips','setup'],
};

export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: 'grid', permission: 'dashboard' },
  { path: '/fleet', label: 'Fleet', icon: 'truck', permission: 'fleet' },
  { path: '/bookings', label: 'Bookings', icon: 'calendar', permission: 'bookings' },
  { path: '/clients', label: 'Clients', icon: 'users', permission: 'clients' },
  { path: '/finance', label: 'Finance', icon: 'dollar-sign', permission: 'finance' },
  { path: '/vault', label: 'Document Vault', icon: 'folder', permission: 'vault' },
  { path: '/drivers', label: 'Drivers', icon: 'user-check', permission: 'drivers' },
  { path: '/driver-trips', label: 'My Trips', icon: 'route', permission: 'driver_trips' },
  { path: '/settings', label: 'Settings', icon: 'settings', permission: 'settings' },
  { path: '/setup', label: 'Setup Guide', icon: 'book-open', permission: 'setup' },
];

export function can(role, permission) {
  if (!role) return false;
  return (PERMISSIONS[role] || []).includes(permission);
}

export function canAny(role, ...permissions) {
  return permissions.some(p => can(role, p));
}
