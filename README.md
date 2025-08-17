# Cardano DeFi Assistant

A Cardano wallet portfolio tracker and DeFi analytics platform built with Next.js 15, React 19, and Supabase. Features secure wallet authentication via CIP-30 signature verification and real-time transaction syncing from the Cardano blockchain.

## Key Features

### Implemented
- Cardano wallet connection (Nami, Eternl, Flint, Lace, Yoroi)
- Secure JWT authentication via wallet signature verification  
- Real-time transaction history sync from Blockfrost
- Portfolio overview with ADA balance tracking
- Transaction categorization (DeFi swaps, transfers, staking)
- Virtual scrolling for large transaction lists
- Row Level Security (RLS) for data isolation

### In Progress
- Token metadata integration with Cardano token registry
- Advanced transaction filtering and search
- Portfolio performance analytics
- DeFi protocol identification

## Technology Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Wallet Integration**: MeshJS for Cardano CIP-30 compliance
- **Database**: Supabase with Row Level Security (RLS)
- **Authentication**: JWT with Ed25519 signature verification
- **Blockchain Data**: Blockfrost API for transaction history
- **State Management**: TanStack Query for server state
- **Testing**: Playwright for E2E tests

## Installation

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Blockfrost API key (for blockchain data)
- Cardano wallet browser extension

### Quick Start

1. **Clone and install**
```bash
git clone https://github.com/yourusername/cardano-defi-assistant.git
cd cardano-defi-assistant
npm install
```

2. **Configure environment variables**

Create a `.env.local` file:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# JWT Configuration (Base64-encoded JWK)
JWT_SECRET=your-base64-encoded-jwk
JWT_KID=your-key-id
JWT_ALGORITHM=ES256
JWT_ISSUER=https://your-project.supabase.co/auth/v1
TOKEN_EXPIRES_IN=3600

# Blockfrost API
BLOCKFROST_URL=https://cardano-mainnet.blockfrost.io/api/v0
BLOCKFROST_KEY=your-blockfrost-api-key

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

3. **Set up Supabase database**

Apply the database schema from `supabase/migrations/` in your Supabase SQL editor.

4. **Run the development server**
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Project Structure

```
cardano-defi-assistant/
├── src/
│   ├── app/                 # Next.js 15 app router
│   │   ├── api/            # API endpoints
│   │   └── dashboard/      # Dashboard pages
│   ├── components/         # React components
│   ├── context/           # React context providers
│   ├── hooks/             # Custom React hooks
│   │   ├── queries/       # TanStack Query hooks
│   │   └── mutations/     # Mutation hooks
│   ├── lib/               # Core utilities
│   ├── services/          # Business logic
│   └── types/             # TypeScript definitions
├── supabase/              # Database migrations
├── tests/                 # Test suites
└── docs/                  # Documentation
```

## Authentication & Security

### How It Works

1. User connects Cardano wallet (CIP-30)
2. Wallet signs a challenge message with private key
3. Server verifies Ed25519 signature and extracts public key
4. JWT issued with wallet address claim
5. All database queries filtered by wallet address via RLS

Key security features:
- No private keys stored or transmitted
- Time-limited nonces prevent replay attacks
- Cryptographic proof of wallet ownership
- Database-level access control via RLS

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
npm run test:e2e     # Run Playwright tests
```

## Testing

```bash
# Run E2E tests
npm run test:e2e

# Run with UI mode
npx playwright test --ui

# Debug specific test
npx playwright test --debug
```

## Deployment

### Vercel

1. Push to GitHub
2. Import repository on [vercel.com](https://vercel.com)
3. Configure environment variables
4. Deploy

### Environment Variables

Required environment variables for production:

```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_KEY
JWT_SECRET
JWT_KID
BLOCKFROST_URL
BLOCKFROST_KEY
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- [MeshJS](https://meshjs.dev/) for Cardano wallet integration
- [Supabase](https://supabase.com/) for backend infrastructure
- [Blockfrost](https://blockfrost.io/) for blockchain data
- [Vercel](https://vercel.com/) for hosting