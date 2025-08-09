# Wallet Sync Service

A secure, modern Cardano wallet synchronization service built with Next.js 15, featuring JWT authentication with CIP-30 wallet signature verification. This service enables users to connect their Cardano wallets, authenticate securely, and sync their wallet data for portfolio tracking and transaction analysis.

## 🔐 Key Security Feature: JWT + CIP-30 Authentication

This service implements a novel authentication approach combining:
- **CIP-30 Wallet Signatures**: Users sign challenges with their Cardano wallet
- **JWT Token Generation**: Server generates Supabase-compatible JWTs after verification
- **Cryptographic Verification**: Ed25519 signature verification ensures wallet ownership
- **Row Level Security**: Supabase RLS policies enforce data isolation per wallet

### Authentication Flow

1. **Challenge Request**: Client requests a nonce from `/api/auth/nonce`
2. **Wallet Signing**: User signs the challenge using their Cardano wallet (CIP-30)
3. **Signature Verification**: Server verifies the COSE signature and extracts the Ed25519 public key
4. **Address Validation**: Public key is validated against the claimed wallet address
5. **JWT Generation**: Server issues a Supabase-compatible JWT with wallet claims
6. **Secure Access**: JWT enables secure access to wallet-specific data via RLS

## 🛠 Technology Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Wallet Integration**: MeshJS for Cardano CIP-30 compliance
- **Database**: Supabase with Row Level Security (RLS)
- **Authentication**: Custom JWT with wallet signature verification
- **Testing**: Playwright for E2E tests, Jest for unit tests
- **UI Components**: Radix UI primitives with custom styling

## 🚀 Features

### Current (Implemented)
- ✅ Cardano wallet connection (Nami, Eternl, Flint, etc.)
- ✅ Secure authentication via wallet signatures
- ✅ JWT token generation and verification
- ✅ User dashboard with wallet overview
- ✅ Supabase integration with RLS policies
- ✅ Comprehensive error handling
- ✅ E2E testing infrastructure

### Roadmap
- 🔄 **Full Wallet History Sync**: Complete transaction history from Blockfrost
- 🪙 **Token Registry Integration**: Cardano token metadata and pricing
- 📊 **Transaction Parsing**: Intelligent categorization of DeFi, NFT, and transfer transactions
- 💼 **Portfolio View**: Real-time portfolio valuation and performance metrics
- 🎨 **UI Enhancements**: Advanced filtering, sorting, and data visualization
- 📱 **Mobile Optimization**: Responsive design improvements
- 🔍 **Advanced Analytics**: Transaction patterns and spending insights

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Blockfrost API key (for blockchain data)
- Cardano wallet browser extension

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/wallet-sync-service.git
cd wallet-sync-service
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**

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

4. **Generate JWT Keys**

For production, generate an ES256 key pair:
```bash
# Generate private key
openssl ecparam -genkey -name prime256v1 -noout -out private.pem

# Convert to JWK format and base64 encode
# Use a tool like https://github.com/dannycoates/pem-jwk
```

5. **Set up Supabase database**

Run the migrations in your Supabase SQL editor:
```sql
-- Create app_users table
CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  wallet_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id),
  address TEXT NOT NULL,
  stake_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, address)
);

-- Enable RLS
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own data" ON app_users
  FOR SELECT USING (wallet_address = current_setting('request.jwt.claims')::json->>'addr');

CREATE POLICY "Users can view own wallets" ON wallets
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM app_users 
      WHERE wallet_address = current_setting('request.jwt.claims')::json->>'addr'
    )
  );
```

6. **Run the development server**
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run all tests
npm run test:all

# Run tests with coverage
npm run test:coverage
```

## 🏗 Project Structure

```
wallet-sync-service/
├── src/
│   ├── app/                 # Next.js app router pages
│   │   ├── api/auth/        # Authentication endpoints
│   │   ├── dashboard/       # Dashboard pages
│   │   └── page.tsx         # Landing page
│   ├── components/          # React components
│   │   ├── dashboard/       # Dashboard components
│   │   ├── landing/         # Landing page components
│   │   └── ui/              # Reusable UI components
│   ├── context/             # React context providers
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Core utilities
│   │   ├── auth/            # Authentication logic
│   │   ├── cardano/         # Cardano wallet utilities
│   │   └── supabase/        # Database client
│   ├── services/            # Business logic services
│   └── types/               # TypeScript type definitions
├── tests/                   # Test suites
│   ├── e2e/                 # Playwright E2E tests
│   └── fixtures/            # Test fixtures and helpers
├── docs/                    # Documentation
└── CLAUDE.md               # Claude AI guidelines
```

## 🤖 Built with AI Assistance

This project was developed using **Claude Sonnet 4** with advanced subagent workflows:

- **Architecture Planning**: AI-assisted system design and technology selection
- **Security Implementation**: Cryptographic verification logic with AI code review
- **Testing Strategy**: Comprehensive test coverage using AI-generated test cases
- **UI Components**: Built using **21st.dev's Magic MCP** for rapid component generation
- **Code Quality**: Continuous AI review for best practices and optimization

### Development Workflow

1. **Planning Phase**: Claude AI helps architect features and break down tasks
2. **Implementation**: AI pair programming with real-time code generation
3. **Testing**: AI generates test scenarios and fixtures
4. **Review**: Automated code review for security and performance
5. **Documentation**: AI-assisted documentation generation

## 🔒 Security Considerations

- **No Private Keys**: Never stores or transmits private keys
- **Challenge-Response**: Time-limited nonces prevent replay attacks
- **Signature Verification**: Cryptographic proof of wallet ownership
- **JWT Security**: Short-lived tokens with secure signing
- **RLS Policies**: Database-level access control
- **Input Validation**: Comprehensive validation of all inputs
- **Error Handling**: Secure error messages without information leakage

## 📝 Development Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm test             # Run Jest tests
npm run test:e2e     # Run Playwright tests
npx tsc --noEmit     # TypeScript type checking
```

## 🚢 Deployment

### Deploy to Vercel

The easiest way to deploy this Next.js application is using [Vercel](https://vercel.com/), the platform from the creators of Next.js.

#### Option 1: Deploy with Vercel CLI

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Deploy**
```bash
vercel
```

Follow the prompts to link your project and configure environment variables.

#### Option 2: Deploy via GitHub

1. **Push to GitHub**
```bash
git remote add origin https://github.com/yourusername/wallet-sync-service.git
git branch -M main
git push -u origin main
```

2. **Import to Vercel**
- Go to [vercel.com/new](https://vercel.com/new)
- Import your GitHub repository
- Configure environment variables (see below)
- Deploy

#### Environment Variables for Vercel

Add these environment variables in your Vercel project settings:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# JWT Configuration
JWT_SECRET=your-base64-encoded-jwk
JWT_KID=your-key-id
JWT_ALGORITHM=ES256
JWT_ISSUER=https://your-project.supabase.co/auth/v1
TOKEN_EXPIRES_IN=3600

# Blockfrost API
BLOCKFROST_URL=https://cardano-mainnet.blockfrost.io/api/v0
BLOCKFROST_KEY=your-blockfrost-api-key

# Application (update to your Vercel domain)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NODE_ENV=production
```

#### Post-Deployment Steps

1. **Update CORS settings** in Supabase:
   - Go to Authentication > URL Configuration
   - Add your Vercel domain to allowed URLs

2. **Configure Domain** (optional):
   - Add a custom domain in Vercel project settings
   - Update `NEXT_PUBLIC_APP_URL` environment variable

3. **Monitor Performance**:
   - Enable Vercel Analytics for performance monitoring
   - Set up error tracking (e.g., Sentry)

### Production Considerations

- **Environment Variables**: Never commit sensitive keys to git
- **Rate Limiting**: Implement API rate limiting for production
- **Monitoring**: Set up error tracking and performance monitoring
- **Backup**: Regular database backups via Supabase
- **Security Headers**: Configure security headers in `next.config.js`

## 🎯 Next Steps

### Immediate Priorities

1. **Deploy to Vercel** ✅
   - Set up production environment
   - Configure domain and SSL
   - Test wallet authentication flow

2. **Implement Wallet History Sync**
   - Integrate Blockfrost API for transaction history
   - Store transactions in Supabase
   - Build pagination for large histories

3. **Add Token Registry**
   - Integrate Cardano token metadata API
   - Cache token information
   - Display token balances with metadata

4. **Transaction Parsing Engine**
   - Categorize transaction types (DeFi, NFT, transfers)
   - Extract protocol interactions
   - Build transaction timeline view

5. **Portfolio Analytics**
   - Calculate real-time portfolio value
   - Historical performance charts
   - Asset allocation breakdown

### Future Enhancements

- **Multi-wallet Support**: Allow users to track multiple wallets
- **Export Features**: CSV/PDF export for tax reporting
- **Mobile App**: React Native companion app
- **Notifications**: Transaction alerts and portfolio updates
- **Social Features**: Share portfolio insights (privacy-first)
- **DeFi Integration**: Direct interaction with Cardano DeFi protocols

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [MeshJS](https://meshjs.dev/) for Cardano wallet integration
- [Supabase](https://supabase.com/) for backend infrastructure
- [Blockfrost](https://blockfrost.io/) for blockchain data
- [21st.dev](https://21st.dev/) for UI component inspiration
- [Claude AI](https://claude.ai/) for development assistance

## 📧 Contact

For questions or support, please open an issue on GitHub or contact the maintainers.

---

**Note**: This service is in active development. Features and APIs may change. Always refer to the latest documentation.