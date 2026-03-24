import { Outlet } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import ParticleBackground from '../components/ParticleBackground';
import { useGsapAnimations } from '../hooks/useGsapAnimations';

export default function AuthenticatedLayout() {
  useGsapAnimations();

  return (
    <div className='h-screen flex flex-col bg-bg-primary overflow-hidden relative'>
      <ParticleBackground />
      <TopNavbar />
      <main className='flex-1 overflow-y-auto relative z-10 scrollbar-thin scrollbar-thumb-white/10'>
        <Outlet />
      </main>
    </div>
  );
}
