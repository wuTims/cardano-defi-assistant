import React from 'react';
import { cn } from '@/lib/utils';
import { Wallet, TrendingUp, Layers, CreditCard } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  className?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ 
  title, 
  value, 
  icon, 
  className 
}) => (
  <div className={cn(
    "bg-gray-800 rounded-xl p-6 shadow-lg transition-all duration-300 hover:bg-gray-700/50 border border-gray-700",
    className
  )}>
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-sm text-gray-400 uppercase tracking-wider">{title}</h3>
      {icon}
    </div>
    <p className="text-3xl font-bold text-white">{value}</p>
  </div>
);

export const DashboardLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400">Your Cardano Wallet Overview</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <DashboardCard 
          title="Total Balance" 
          value="₳ 15,342.50" 
          icon={<Wallet className="text-blue-400" />} 
        />
        <DashboardCard 
          title="Portfolio Value" 
          value="$42,156.78" 
          icon={<TrendingUp className="text-green-400" />} 
          className="md:col-span-2"
        />
        <DashboardCard 
          title="Assets" 
          value="12" 
          icon={<Layers className="text-purple-400" />} 
        />
        <DashboardCard 
          title="Transactions" 
          value="87" 
          icon={<CreditCard className="text-pink-400" />} 
        />
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-bold mb-6">Recent Transactions</h2>
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700/50">
              <tr>
                <th className="p-4 text-left text-sm text-gray-300">Date</th>
                <th className="p-4 text-left text-sm text-gray-300">Description</th>
                <th className="p-4 text-right text-sm text-gray-300">Amount</th>
              </tr>
            </thead>
            <tbody>
              {[
                { date: '2025-08-05', description: 'Transfer to Binance', amount: '-₳ 1,234.56', color: 'text-red-400' },
                { date: '2025-08-04', description: 'Received from Stake Pool', amount: '+₳ 456.78', color: 'text-green-400' },
                { date: '2025-08-03', description: 'NFT Purchase', amount: '-₳ 567.89', color: 'text-red-400' },
              ].map((tx, index) => (
                <tr key={index} className="border-b border-gray-700 last:border-b-0 hover:bg-gray-700/30">
                  <td className="p-4 text-gray-400">{tx.date}</td>
                  <td className="p-4">{tx.description}</td>
                  <td className={`p-4 text-right font-bold ${tx.color}`}>{tx.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};