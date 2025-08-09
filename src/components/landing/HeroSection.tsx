import React from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export const HeroSection: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      data-testid="hero-section"
      className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-black"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-50 blur-3xl"></div>
      
      <div data-testid="hero-content" className="relative z-10 text-center max-w-4xl mx-auto px-4">
        <motion.h1 
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          data-testid="hero-title"
          className="text-5xl md:text-7xl font-bold text-white mb-6 tracking-tight"
        >
          Connect Your Cardano Wallet<br />Seamlessly
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          data-testid="hero-subtitle"
          className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto"
        >
          Experience next-generation wallet synchronization with secure, instant connections across your favorite Cardano wallets.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          data-testid="hero-cta"
        >
          <Button 
            size="lg" 
            variant="outline"
            data-testid="hero-connect-wallet-button"
            className="bg-transparent border-2 border-white/30 text-white hover:bg-white/10 transition-all duration-300"
          >
            Connect Wallet
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
};