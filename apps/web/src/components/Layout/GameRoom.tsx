import { PokerTable } from '@/components/Table/PokerTable';
import { DialogueStream } from '@/components/Dialogue/DialogueStream';
import { BettingPanel } from '@/components/Market/BettingPanel';
import { LiveBetFeed } from '@/components/Market/LiveBetFeed';
import { VerificationBar } from '@/components/Verify/VerificationBar';

export function GameRoom() {
  return (
    <div className="space-y-4">
      <PokerTable />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DialogueStream />
        <div className="space-y-3">
          <BettingPanel />
          <LiveBetFeed />
        </div>
      </div>
      <VerificationBar />
    </div>
  );
}
