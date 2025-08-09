/**
 * Central selector definitions for consistent test locators
 * Organized by page/component for easy maintenance and reference
 */

export const SELECTORS = {
  // Authentication & Wallet Connection
  auth: {
    walletConnectButton: '[data-testid="wallet-connect-trigger-disconnected"]',
    walletConnectButtonConnected: '[data-testid="wallet-connect-trigger-connected"]',
    walletPopover: '[data-testid="wallet-popover"]',
    walletPopoverFallback: '[role="dialog"]',
    walletSelection: '.wallet-selection',
    namiWallet: 'text=/nami/i',
    eternlWallet: 'text=/eternl/i',
    laceWallet: 'text=/lace/i',
    vesperWallet: 'text=/vespr/i'
  },

  // Landing Page
  landing: {
    heroSection: '[data-testid="hero-section"]',
    heroPrimaryButton: '[data-testid="hero-primary-button"]',
    heroSecondaryButton: '[data-testid="hero-secondary-button"]',
    featuresSection: '[data-testid="features-section"]',
    cardanoWalletHero: '[data-testid="cardano-wallet-hero"]'
  },

  // Dashboard
  dashboard: {
    content: '[data-testid="dashboard-content"]',
    layout: '[data-testid="dashboard-layout"]',
    walletOverview: '[data-testid="wallet-overview"]',
    walletAddress: '[data-testid="wallet-address"]',
    walletBalance: '[data-testid="wallet-balance"]',
    walletAssets: '[data-testid="wallet-assets"]',
    walletUtxos: '[data-testid="wallet-utxos"]',
    syncStatus: '[data-testid="sync-status"]',
    disconnectButton: '[data-testid="disconnect-button"]'
  },

  // Navigation
  navigation: {
    navbar: '[data-testid="navbar"]',
    mobileMenu: '[data-testid="mobile-menu"]',
    navLinks: '[data-testid="nav-links"]'
  },

  // Common UI Elements
  common: {
    loadingSpinner: '[data-testid="loading-spinner"]',
    errorMessage: 'text=/error|failed|unable/i',
    successMessage: 'text=/success|completed|connected/i',
    modal: '[role="dialog"]',
    closeButton: '[data-testid="close-button"]',
    confirmButton: '[data-testid="confirm-button"]',
    cancelButton: '[data-testid="cancel-button"]'
  },

  // Forms
  forms: {
    input: 'input',
    textArea: 'textarea',
    submitButton: 'button[type="submit"]',
    resetButton: 'button[type="reset"]'
  }
} as const;

// Helper functions for complex selectors
export const getWalletPopoverSelector = (): string => {
  return `${SELECTORS.auth.walletPopover}, ${SELECTORS.auth.walletPopoverFallback}, ${SELECTORS.auth.walletSelection}`;
};

export const getWalletSelector = (walletType: 'nami' | 'eternl' | 'lace' | 'vespr'): string => {
  const walletSelectors = {
    nami: SELECTORS.auth.namiWallet,
    eternl: SELECTORS.auth.eternlWallet,
    lace: SELECTORS.auth.laceWallet,
    vespr: SELECTORS.auth.vesperWallet
  };
  return walletSelectors[walletType];
};

// Export flat selectors for backward compatibility if needed
export const WALLET_CONNECT_BUTTON = SELECTORS.auth.walletConnectButton;
export const WALLET_POPOVER = getWalletPopoverSelector();
export const ERROR_MESSAGE = SELECTORS.common.errorMessage;