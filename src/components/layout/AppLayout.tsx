import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { GlobalSearch } from '@/components/GlobalSearch'
import { useAppStore } from '@/hooks/useStore'

export function AppLayout() {
  const { searchOpen } = useAppStore()

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <BottomNav />
      <Header />
      
      {/* Main content area */}
      <main className="lg:pl-[260px] pt-16 pb-20 lg:pb-6 min-h-screen transition-all duration-300">
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>

      {/* Global Search Modal */}
      {searchOpen && <GlobalSearch />}
    </div>
  )
}
