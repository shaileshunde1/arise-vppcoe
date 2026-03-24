import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function MainLayout() {
  return (
    <div className='min-h-screen flex flex-col'>
      <Navbar />
      <main className='flex-1 mt-20'>
        <Outlet />
      </main>
      <footer className="py-8 px-8 border-t border-white/10 text-center text-gray-400 text-sm mt-auto">
  <p className="opacity-50">© 2026 ARISE. All rights reserved.</p>
</footer>
    </div>
  );
}
