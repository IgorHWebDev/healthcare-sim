# Debugging and Functionality Verification Plan

## 1. Core Functionality Testing

### 1.1 Database Connectivity
```sql
-- Test query to verify database connection and schema
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.schemata 
    WHERE schema_name = 'bot_schema'
);

-- Verify required tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'bot_schema';
```

### 1.2 Bot Command Testing Matrix
| Command | Expected Behavior | Current Status | Fix Required |
|---------|------------------|----------------|--------------|
| /start | Welcome message | Not Working | Yes |
| /help | Show commands | Not Working | Yes |
| /practice | Start new case | Not Working | Yes |
| /progress | Show stats | Not Working | Yes |

## 2. Issue Investigation

### 2.1 Session Management
```typescript
// Add debug logging
bot.use(async (ctx, next) => {
    console.log('Incoming update:', {
        type: ctx.updateType,
        message: ctx.message,
        session: ctx.session
    });
    await next();
    console.log('Post-processing session:', ctx.session);
});
```

### 2.2 Command Registration
```typescript
// Verify command registration
bot.telegram.getMyCommands()
    .then(commands => console.log('Registered commands:', commands))
    .catch(err => console.error('Error getting commands:', err));
```

## 3. Fix Implementation Plan

### 3.1 Command Handlers
```typescript
// Ensure proper command registration
await bot.telegram.setMyCommands([
    { command: 'start', description: 'Start the bot' },
    { command: 'help', description: 'Show help message' },
    { command: 'practice', description: 'Start practice session' },
    { command: 'progress', description: 'View progress' }
]);

// Implement proper error boundaries
bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    return ctx.reply('An error occurred. Please try again.');
});
```

### 3.2 Session Middleware
```typescript
// Configure session middleware properly
bot.use(session({
    defaultSession: () => ({
        currentCase: undefined,
        sessionId: undefined
    })
}));

// Add session type checking
interface MySession {
    currentCase?: EDCase;
    sessionId?: number;
}

interface MyContext extends Context {
    session: MySession;
}
```

## 4. Testing Steps

1. **Database Connectivity**
   - [ ] Verify PostgreSQL connection
   - [ ] Check schema existence
   - [ ] Validate table structures

2. **Bot Commands**
   - [ ] Test /start command
   - [ ] Test /help command
   - [ ] Test /practice command
   - [ ] Test /progress command

3. **Session Management**
   - [ ] Verify session creation
   - [ ] Test session persistence
   - [ ] Check session cleanup

4. **Error Handling**
   - [ ] Test database connection errors
   - [ ] Test invalid command inputs
   - [ ] Verify error messages

## 5. Implementation Order

1. **Phase 1: Core Fixes**
   ```typescript
   // 1. Fix session middleware
   bot.use(session({
       defaultSession: () => ({
           currentCase: undefined,
           sessionId: undefined
       })
   }));

   // 2. Fix command registration
   await bot.telegram.setMyCommands([...]);

   // 3. Implement proper error handling
   bot.catch((err, ctx) => {...});
   ```

2. **Phase 2: Command Handlers**
   ```typescript
   // 1. Start command
   bot.command('start', async (ctx) => {...});

   // 2. Help command
   bot.command('help', async (ctx) => {...});

   // 3. Practice command
   bot.command('practice', async (ctx) => {...});

   // 4. Progress command
   bot.command('progress', async (ctx) => {...});
   ```

3. **Phase 3: Database Integration**
   ```typescript
   // 1. Verify connection
   const client = await pool.connect();
   try {
       await client.query('SELECT NOW()');
   } finally {
       client.release();
   }

   // 2. Implement database operations
   class DatabaseService {
       async createSession(userId: number): Promise<number> {...}
       async updateSession(sessionId: number, score: number): Promise<void> {...}
       async getUserProgress(userId: number): Promise<Progress> {...}
   }
   ```

## 6. Verification Checklist

### 6.1 Database
- [ ] Connection successful
- [ ] Schema exists
- [ ] Tables created
- [ ] Permissions granted

### 6.2 Bot Commands
- [ ] Commands registered
- [ ] Help message correct
- [ ] Practice flow working
- [ ] Progress tracking accurate

### 6.3 Session Management
- [ ] Sessions created properly
- [ ] State maintained between messages
- [ ] Cleanup working correctly

### 6.4 Error Handling
- [ ] Graceful error messages
- [ ] No unhandled exceptions
- [ ] Proper logging

## 7. Next Steps

1. **Immediate Actions**
   - Fix session middleware
   - Implement proper command handlers
   - Add comprehensive logging

2. **Short-term Goals**
   - Complete all verification steps
   - Document fixed functionality
   - Prepare for AI integration

3. **Medium-term Goals**
   - Implement monitoring
   - Add performance metrics
   - Prepare scaling strategy
