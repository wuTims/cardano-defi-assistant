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

### **CRITICAL: Dependency Management Process Failure Prevention**

**Lessons Learned from August 7, 2025 False Alarm:**

**Issue**: IDE diagnostics showed "missing dependencies" for `@radix-ui/react-accordion` and `framer-motion`, leading to false assumption of missing packages.

**Reality**: All dependencies were already installed and functional. The issue was IDE cache/diagnostics lag, not actual missing packages.

**Prevention Process:**
1. **Always verify with actual commands before assuming dependency issues:**
   ```bash
   npx tsc --noEmit    # Check TypeScript compilation
   npm run build       # Test complete build process
   ls node_modules/@radix-ui/ # Verify physical package presence
   ```

2. **Don't trust IDE diagnostics alone** - they can show false positives due to:
   - Cache lag after fresh installs
   - TypeScript server restart needed
   - Temporary file system sync issues

3. **Evidence-based diagnosis required:**
   - If TypeScript compiles cleanly, dependencies are resolved
   - If build succeeds, all imports work correctly
   - Physical package presence in node_modules confirms installation

4. **Process failure documentation mandatory** when making incorrect assumptions

### Critical Guidelines

#### NO UNUSED CODE GENERATION
**NEVER** generate methods, functions, or components that are not immediately used. Every piece of code MUST serve a specific, immediate purpose in the current task.

### NEVER LEAVE TODOS OR STUBS IN CODE
**NEVER** leave todos or stubs in code. Every piece of code MUST serve a specific, immediate purpose in the current task. If you are not sure what to do, ask for help. If you need to stub or TODO, ensure it is clear and you create a task to comeback to it at the end.

### TypeScript Code Guidelines

### Variable Declarations

### Inline Usage for Single-Use Variables

Quick description: Do not declare constants that are only used once. Use their value directly inline instead.

✅ DO:

```typescript
const deleteResponse = await genqlMutation({
  prisma,
  source: {
    deleteTag: [{ id: createResponse.createTag.id }, { id: true }],
  },
  userId: seededData.users[0].id,
  workspaceId: seededData.workspaces[1].id,
});
```

❌ DON'T:

```typescript
const tagId = createResponse.createTag.id;

const deleteResponse = await genqlMutation({
  prisma,
  source: {
    deleteTag: [{ id: tagId }, { id: true }],
  },
  userId: seededData.users[0].id,
  workspaceId: seededData.workspaces[1].id,
});
```

### Direct Reference to Static Data

Quick description: Always reference static data (like seededData) directly without creating intermediate variables.

✅ DO:

```typescript
const deleteResponse = await genqlMutation({
  prisma,
  source: {
    deleteTag: [{ id: seededData.tags[0].id }, { id: true }],
  },
  userId: seededData.users[0].id,
  workspaceId: seededData.workspaces[0].id,
});

const tag = await prisma.tag.findUnique({
  where: { id: seededData.tags[0].id },
});
```

❌ DON'T:

```typescript
const tagToDelete = seededData.tags[0]; // Unnecessary intermediate variable

const deleteResponse = await genqlMutation({
  prisma,
  source: {
    deleteTag: [{ id: tagToDelete.id }, { id: true }],
  },
  userId: seededData.users[0].id,
  workspaceId: seededData.workspaces[0].id,
});

const tag = await prisma.tag.findUnique({
  where: { id: tagToDelete.id },
});
```

### Exceptions

Variables may be declared separately if:

- They are used multiple times
- The expression is complex and would harm readability if used inline
- The variable name provides important semantic context that would be lost with inline usage
- Debugging purposes require a specific variable to be inspectable

## Types vs Interfaces

Quick description: Always use `type` for declaring types, avoid interfaces.

✅ DO:

```tsx
export type UpsertTagNamespaceFormModalProps = {
  tagNamespace: UpsertTagNamespaceFormProps['tagNamespace'];
  trigger?: ReactElement;
};
```

❌ DON'T:

```tsx
interface UpsertTagNamespaceFormModalProps {
  tagNamespace: UpsertTagNamespaceFormProps['tagNamespace'];
  trigger?: ReactElement;
}
```

## Function Definitions

Quick description: Use arrow functions with `export const` syntax instead of standard function declarations.

✅ DO:

```typescript
export const getCollectionAncestors = async ({ collection, ctx }: GetCollectionAncestorsArgs) => {
  // Implementation
};
```

❌ DON'T:

```typescript
export async function getCollectionAncestors({ collection, ctx }: GetCollectionAncestorsArgs): Promise<string[]> {
  // Implementation
}
```

## Type Parameters

Quick description: Use descriptive names with `Args` suffix for function parameters and prefer `Pick<>` over custom types when referencing model properties.

✅ DO:

```typescript
export type GetCollectionAncestorsArgs = {
  collection: Pick<Collection, 'id' | 'parentCollectionId'>;
  ctx: Context;
};
```

❌ DON'T:

```typescript
export type CollectionInfo = {
  id: string;
  parentCollectionId: string | null;
};

export type GetCollectionAncestorsParams = {
  collection: CollectionInfo;
  ctx: Context;
};
```

## Return Types

Quick description: Prefer implicit return types when possible, let TypeScript infer the types.

✅ DO:

```typescript
export const getCollectionAncestors = async ({ collection, ctx }: GetCollectionAncestorsArgs) => {
  // TypeScript will infer the return type
};
```

❌ DON'T:

```typescript
export const getCollectionAncestors = async ({ collection, ctx }: GetCollectionAncestorsArgs): Promise<string[]> => {
  // Explicitly specified return type
};
```

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

### CRITICAL LESSON LEARNED: Code Review Failure Analysis

#### **What Went Wrong (August 7, 2025)**
**VIOLATION**: Claimed "code review complete" and "dashboard working" without testing actual user experience.

**ROOT CAUSE**: 
- Made assumptions based on code compilation success
- Did not test running application in browser
- Failed to ask for specific error details from user
- Validated syntax but ignored user experience

#### **CORRECT REVIEW PROCESS**:
1. **ASK FOR SPECIFICS**: "What specific error/issue are you seeing?"
2. **TEST THE RUNNING APP**: Always verify in actual browser, not just compilation
3. **CHECK USER WORKFLOWS**: Test clicks, interactions, page navigation  
4. **VERIFY CONSOLE**: Check browser console for runtime errors
5. **NEVER CLAIM SUCCESS** without end-to-end user experience validation

#### **Review Checklist - MANDATORY**:
- [ ] Code compiles without TypeScript errors
- [ ] Application starts and loads in browser  
- [ ] Target page/component renders without errors
- [ ] Interactive elements respond correctly
- [ ] Browser console shows no errors
- [ ] User workflow functions end-to-end

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