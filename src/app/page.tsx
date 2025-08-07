import { HeroSection } from '@/components/landing/HeroSection';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';

export default function Home() {
  return (
    <div>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent p-4 flex justify-between items-center">
        <div className="text-white font-bold text-xl">WalletSync</div>
        <WalletConnectButton />
      </nav>
      <HeroSection />
      <DashboardLayout />
    </div>
  );
}