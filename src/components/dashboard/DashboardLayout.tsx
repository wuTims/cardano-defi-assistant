import React from 'react';
import { cn } from '@/lib/ui-utils';
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
  <div 
    data-testid={`dashboard-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
    className={cn(
      "bg-gray-800 rounded-xl p-6 shadow-lg transition-all duration-300 hover:bg-gray-700/50 border border-gray-700",
      className
    )}
  >
    <div data-testid={`card-header-${title.toLowerCase().replace(/\s+/g, '-')}`} className="flex justify-between items-center mb-4">
      <h3 data-testid={`card-title-${title.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm text-gray-400 uppercase tracking-wider">{title}</h3>
      <div data-testid={`card-icon-${title.toLowerCase().replace(/\s+/g, '-')}`}>{icon}</div>
    </div>
    <p data-testid={`card-value-${title.toLowerCase().replace(/\s+/g, '-')}`} className="text-3xl font-bold text-white">{value}</p>
  </div>
);

export const DashboardLayout: React.FC = () => {
  return (
    <div data-testid="dashboard-layout" className="min-h-screen bg-gray-900 text-white p-8">
      <header data-testid="dashboard-header" className="mb-12">
        <h1 data-testid="dashboard-title" className="text-4xl font-bold mb-2">Dashboard</h1>
        <p data-testid="dashboard-subtitle" className="text-gray-400">Your Cardano Wallet Overview</p>
      </header>

      <div data-testid="dashboard-cards-grid" className="grid grid-cols-1 md:grid-cols-4 gap-6">
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

      <section data-testid="transactions-section" className="mt-12">
        <h2 data-testid="transactions-title" className="text-2xl font-bold mb-6">Recent Transactions</h2>
        <div data-testid="transactions-table-container" className="bg-gray-800 rounded-xl overflow-hidden">
          <table data-testid="transactions-table" className="w-full">
            <thead className="bg-gray-700/50">
              <tr data-testid="transactions-table-header">
                <th className="p-4 text-left text-sm text-gray-300">Date</th>
                <th className="p-4 text-left text-sm text-gray-300">Description</th>
                <th className="p-4 text-right text-sm text-gray-300">Amount</th>
              </tr>
            </thead>
            <tbody data-testid="transactions-table-body">
              {[
                { date: '2025-08-05', description: 'Transfer to Binance', amount: '-₳ 1,234.56', color: 'text-red-400' },
                { date: '2025-08-04', description: 'Received from Stake Pool', amount: '+₳ 456.78', color: 'text-green-400' },
                { date: '2025-08-03', description: 'NFT Purchase', amount: '-₳ 567.89', color: 'text-red-400' },
              ].map((tx, index) => (
                <tr 
                  key={index} 
                  data-testid={`transaction-row-${index}`}
                  className="border-b border-gray-700 last:border-b-0 hover:bg-gray-700/30"
                >
                  <td data-testid={`transaction-date-${index}`} className="p-4 text-gray-400">{tx.date}</td>
                  <td data-testid={`transaction-description-${index}`} className="p-4">{tx.description}</td>
                  <td data-testid={`transaction-amount-${index}`} className={`p-4 text-right font-bold ${tx.color}`}>{tx.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};