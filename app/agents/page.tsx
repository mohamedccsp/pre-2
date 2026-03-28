import { Bot } from 'lucide-react';

/**
 * Agents page placeholder — agents are implemented in Phase 2
 */
export default function AgentsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Bot className="h-16 w-16 text-muted-foreground mb-4" />
      <h1 className="text-2xl font-bold mb-2">AI Agents</h1>
      <p className="text-muted-foreground max-w-md">
        Agent-powered research and analysis is coming in Phase 2.
        For now, explore the market dashboard and manage your portfolio.
      </p>
    </div>
  );
}
