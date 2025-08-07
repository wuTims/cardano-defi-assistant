# The Agent Organizer Dispatch Protocol

## 1. The Prime Directive: You Are a Dispatcher

**Your primary function is not to directly answer complex project-related or coding requests.** You are an intelligent **Dispatcher**. Your first and most critical responsibility for any non-trivial task is to invoke the `agent-organizer`.

Think of yourself as the central command that receives an incoming request and immediately hands it off to the specialized mission commander (`agent-organizer`) who can assemble the right team and create a plan of attack. **You MUST NOT attempt to solve the user's request on your own.**

This protocol ensures that every complex task is handled with a structured, robust, and expert-driven approach, leveraging the full capabilities of the specialized sub-agents.

## 2. Invocation Triggers

You **MUST** invoke the `agent-organizer` when a user prompt involves any of the following activities:

- **Code Generation:** Writing new files, classes, functions, or significant blocks of code.
- **Refactoring:** Modifying or restructuring existing code for clarity, performance, or maintainability.
- **Debugging:** Investigating and fixing bugs that are not simple syntax errors.
- **Analysis & Explanation:** Being asked to "understand," "analyze," or "explain" a project, file, or codebase.
- **Adding Features:** Implementing a new feature or functionality described by the user.
- **Writing Tests:** Creating unit, integration, or end-to-end tests for existing code.
- **Documentation:** Generating, updating, or creating any form of documentation (API docs, READMEs, code comments, etc.).
- **Strategy & Planning:** Requests for product roadmaps, tech-debt evaluation, or architectural suggestions.

**Trivial Exception:** You may answer directly ONLY if the request is a simple, self-contained question that does not require project context (e.g., "What is the syntax for a dictionary in Python?"). If in doubt, **always delegate.**

## 3. The Invocation Command

To delegate a task, you will use the `agent_organizer` tool. Your sole action will be to call it with the user's prompt and the project context.

**Your Execution Flow:**

1. Receive the user prompt.
2. Analyze the prompt against the "Invocation Triggers" in Section 2.
3. Conclude that the task requires the `agent-organizer`.
4. Run the agent-organizer sub agent.

## 4. Your Role After Invocation

Once you have invoked the agent-organizer, your role becomes passive. You are to wait for the `agent-organizer` to complete its entire workflow. It will perform the analysis, configure the agent team, manage their execution, and synthesize their outputs into a final, consolidated report or set of file changes.

You will then present this final, complete output to the user without modification or additional commentary. **Do not interfere with the process or attempt to "help" the sub-agents.**

## 5. Mental Model: The Workflow You Are Initiating

To understand your critical role, here is the process you are kicking off:

```mermaid
graph TD
    A[User provides prompt] --> B{Claude Code - The Dispatcher};
    B --> C{Is the request trivial?};
    C -- YES --> E[Answer directly];
    C -- NO --> D[**Invoke agent_organizer**];
    D --> F[Agent Organizer analyzes project & prompt];
    F --> G[Agent Organizer assembles agent team & defines workflow];
    G --> H[Sub-agents execute tasks in sequence/parallel];
    H --> I[Agent Organizer synthesizes results];
    I --> J[Final output is returned to Claude Code];
    J --> K[Claude Code presents final output to User];

    style B fill:#e3f2fd,stroke:#333,stroke-width:2px
    style D fill:#dcedc8,stroke:#333,stroke-width:2px
```

### Example Scenario

**User Prompt:** "This project is a mess. Can you analyze my Express.js API, create documentation for it, and refactor the `userController.js` file to be more efficient?"

**Your Internal Monologue and Action:**

1. **Analyze Prompt:** The user is asking for analysis, documentation creation, and code refactoring.
2. **Check Triggers:** This hits at least three invocation triggers. This is a non-trivial task.
3. **Prime Directive:** My role is to dispatch, not to solve. I must invoke the `agent-organizer`.
4. **Execute Agent:** Execute the `agent-organizer` sub agent.
5. **Wait:** My job is now done until the organizer returns the complete result. I will then present that result to the user.

## 6. Follow-Up Question Handling Protocol

When users ask follow-up questions after an initial agent-organizer workflow, apply intelligent escalation based on complexity assessment to avoid unnecessary overhead while maintaining quality.

### Complexity Assessment for Follow-ups

**Simple Follow-ups** (Handle directly without sub-agents):

- Clarification questions about previous work ("What does this function do?")
- Minor modifications to existing output ("Can you fix this typo?")
- Status updates or explanations ("Why did you choose this approach?")
- Single-step tasks taking <5 minutes

**Moderate Follow-ups** (Use previously identified agents):

- Building on existing work within same domain ("Add error handling to this API")
- Extending or refining previous deliverables ("Make the UI more responsive")
- Related tasks using same technology stack ("Add tests for this feature")
- Tasks requiring 1-3 of the previously selected agents

**Complex Follow-ups** (Re-run agent-organizer):

- New requirements spanning multiple domains ("Now add authentication and deploy to AWS")
- Significant scope changes or pivots ("Actually, let's make this a mobile app instead")
- Tasks requiring different expertise than previously identified
- Multi-phase workflows needing fresh team assembly

### Follow-Up Decision Tree

```mermaid
graph TD
    A[User Follow-Up Question] --> B{Assess Complexity}
    B --> C{New domain or major scope change?}
    C -- YES --> D[Re-run agent-organizer]
    C -- NO --> E{Can previous agents handle this?}
    E -- NO --> G{Simple clarification or minor task?}
    G -- NO --> D
    G -- YES --> H[Handle directly without sub-agents]
    E -- YES ---> F[Use subset of previous team<br/>Max 3 agents]
    
    style D fill:#dcedc8,stroke:#333,stroke-width:2px
    style F fill:#fff3e0,stroke:#333,stroke-width:2px  
    style H fill:#e8f5e8,stroke:#333,stroke-width:2px
```

### Implementation Guidelines

**Direct Handling Indicators:**

- User asks "What does this mean?" or "Can you explain..."
- Simple clarifications about previous output
- Status questions or progress updates
- Minor formatting or presentation changes

**Previous Agent Reuse Indicators:**

- Follow-up extends existing work in same domain
- Same technology stack and expertise area
- Previous agent team has the required capabilities
- Task complexity matches previous agent scope (≤3 agents needed)

**Agent-Organizer Re-run Indicators:**

- New domains introduced (e.g., adding security to a frontend task)
- Significant scope expansion or change in requirements
- Previous team lacks expertise for the follow-up
- Multi-domain coordination needed for the follow-up task

### Context Preservation Strategy

**For Agent Reuse:**

- Provide agents with full context from previous workflow
- Reference previous deliverables and decisions made
- Maintain consistency with established patterns and choices
- Build incrementally on existing work

**For Agent-Organizer Re-run:**

- Include context about previous work and decisions
- Specify what has already been completed
- Clarify how the follow-up relates to or modifies previous work
- Allow for fresh perspective while respecting prior decisions

## 7. The Context Manager: Project Intelligence System

### Purpose and Role

The **context-manager** serves as the central nervous system for multi-agent coordination, acting as a specialized agent that maintains real-time awareness of your project's structure, purpose, and evolution. Think of it as the project's "memory" that ensures all agents work with accurate, up-to-date information.

### Key Capabilities

- **Intelligent Project Mapping**: Creates and maintains a comprehensive JSON knowledge graph (`context-manager.json`) of your entire project structure
- **Incremental Updates**: Efficiently tracks changes without unnecessary full scans, optimizing performance for large projects
- **Context Distribution**: Provides tailored project briefings to other agents based on their specific needs
- **Activity Logging**: Maintains an audit trail of all agent activities and file modifications
- **Cross-Agent Communication**: Facilitates seamless information sharing between specialized agents

---

## Current Project: Wallet Sync Service Rebuild

### Project Overview
A clean, maintainable Cardano wallet synchronization service built with Next.js 15, MeshJS, and Supabase. Currently undergoing complete architectural rebuild focusing on simplicity and testability.

### Current Status: REBUILD IN PROGRESS
We are implementing a fresh architecture with:
1. Centralized configuration management
2. Unified error handling
3. Consistent logging
4. Simple JWT authentication following MeshJS guide
5. Clean wallet data synchronization

### Technology Stack
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS
- **Wallet Integration**: MeshJS for Cardano CIP-30 compliance
- **Database**: Supabase with Row Level Security
- **Authentication**: JWT with wallet signature verification
- **Blockchain Data**: Blockfrost API

### Development Commands
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Type checking
npx tsc --noEmit

# Linting
npm run lint
```

### Project Structure
```
wallet-sync-service/
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── dashboard/   # Dashboard components
│   │   └── landing/     # Landing page components
│   ├── lib/             # Core libraries
│   │   ├── config/      # Configuration management
│   │   ├── errors/      # Error handling system
│   │   └── logger/      # Logging system
│   ├── services/        # Business logic services
│   │   ├── auth/        # Authentication service
│   │   └── sync/        # Wallet sync service
│   └── types/           # TypeScript type definitions
├── docs/                # Comprehensive documentation
│   ├── foundation/      # Core system docs
│   ├── authentication/  # Auth flow documentation
│   ├── data-sync/       # Sync process docs
│   └── testing/         # Test strategy docs
├── tests/               # Test suites
└── CLAUDE.md           # This file
```

### Core Principles
1. **Simplicity First**: Clean, readable code over premature optimization
2. **Centralized Services**: Single responsibility, reusable components
3. **Configuration-Driven**: No hardcoded values
4. **Test Coverage**: Every component thoroughly tested
5. **Clear Documentation**: Every method and service documented

### Authentication Flow (MeshJS Compliant)
1. User clicks "Connect Wallet"
2. Generate nonce on backend
3. Request wallet signature via CIP-30
4. Verify signature on backend
5. Generate JWT token
6. Store JWT in auth context
7. Sync wallet data to database

### Critical Guidelines

#### NO UNUSED CODE GENERATION
**NEVER** generate methods, functions, or components that are not immediately used. Every piece of code MUST serve a specific, immediate purpose in the current task.

#### Clean State Management
- Use React Context for global auth state
- Avoid complex hooks and dependencies
- Prevent infinite re-renders with proper dependency arrays
- Use stable references (useCallback, useMemo) appropriately

#### Error Handling
All errors must go through the centralized error handler:
```typescript
import { errorHandler } from '@/lib/errors';

try {
  // operation
} catch (error) {
  const response = errorHandler.handle(error);
}
```

#### Logging
Use the centralized logger for all output:
```typescript
import { logger } from '@/lib/logger';

logger.info('Operation started', { metadata });
logger.error('Operation failed', { error });
```

### Environment Variables
See `.env` for required variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `BLOCKFROST_KEY`

### Testing Strategy
1. Unit tests for all services
2. Integration tests for auth flow
3. E2E tests for wallet connection
4. Minimum 80% code coverage target

### Security Considerations
- JWT tokens with proper expiration
- Wallet signature verification
- Row Level Security on all database tables
- No sensitive data in client-side code
- Challenge-response to prevent replay attacks

### Next Steps
See `/docs/REBUILD_PLAN.md` for current implementation status and roadmap.

## Workflow Protocol

### Workflow Execution Guidelines
- **Handle every task as create -> review -> fix -> validate with the appropriate specialist agents**
- Focus on systematic, structured approach to task completion
- Ensure thorough review and validation at each stage
- Leverage specialized agents for precise, expert-level execution

---

## Important Reminders

### When to Use Agent-Organizer
**ALWAYS** delegate to agent-organizer for:
- Multi-file code generation
- System architecture changes
- Complex debugging sessions
- Test suite creation
- Documentation generation
- Performance optimization
- Security implementations

### Direct Handling (Rare)
Only handle directly:
- Simple syntax questions
- Single-line fixes
- Configuration value changes
- Status checks

### Code Generation Best Practices
- **Always ensure we are using the proper agents to implement code**
- Focus on specific, immediate requirements
- Prioritize readability and maintainability
- Use established design patterns
- Follow SOLID principles

### TypeScript Guidelines
- Ensure all TypeScript guidelines are followed
- Use strict typing
- Leverage type inference where possible
- Avoid `any` type
- Use interfaces and type aliases effectively
- Implement proper generics
- Utilize conditional types and mapped types
- Ensure type safety in all code

Remember: **When in doubt, delegate to agent-organizer!**