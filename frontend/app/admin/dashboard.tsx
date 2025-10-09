import React from 'react';
import { useRouter } from 'expo-router';

// Import the existing admin component
import AdminPanel from '../admin';

export default function AdminDashboard() {
  // This redirects to the main admin panel with dashboard tab active
  const router = useRouter();
  
  React.useEffect(() => {
    // Redirect to main admin panel with dashboard as default
    router.replace('/admin?tab=dashboard');
  }, []);

  return <AdminPanel />;
}