'use client';

/**
 * Fast Start Drills -- Interactive Rep Onboarding
 * 
 * 20 full merchant onboards (create -> Coin -> Beekeeper -> NectarPay app -> pair -> test $1 USDC -> delete -> repeat)
 * 
 * Interactive tracking:
 * - Timer on pairing (track fastest 3)
 * - Checklist for each phase
 * - Self-attest completion with timestamp
 * - Progress bar (X of 20 done)
 * - Failure modes reference
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Clock, CheckCircle2, Trash2 } from 'lucide-react';

interface DrillPhase {
  name: string;
  description: string;
  checkpoints: string[];
  completed: boolean;
}

interface Drill {
  number: number;
  merchantName: string;
  startedAt: Date | null;
  pairingStartedAt: Date | null;
  pairingEndedAt: Date | null;
  phases: DrillPhase[];
  attestedAt: Date | null;
}

const VERTICALS = [
  'coffee-shops',
  'tattoo-shops',
  'restaurants',
  'gyms',
  'auto-shops',
  'barbers',
  'nail-salons',
  'med-spas',
  'smoke-vape',
  'sports-bars',
  'game-arcades',
  'bike-shops',
  'phone-repair',
  'laundry',
  'car-wash',
  'pool-halls',
  'cigar-lounges',
  'kava-bars',
  'yoga-studios',
  'martial-arts',
  'thrift-shops',
  'collectibles',
  'electronics',
  'sneaker-shops',
  'music-studios',
  'piercing-shops',
  'dispensaries',
  'flower-shops'
];

export function FastStartDrills() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [currentDrill, setCurrentDrill] = useState<number | null>(null);
  const [pairingTimes, setPairingTimes] = useState<number[]>([]);

  const startNewDrill = () => {
    const newDrill: Drill = {
      number: drills.length + 1,
      merchantName: `Demo Merchant ${Date.now()}`,
      startedAt: new Date(),
      pairingStartedAt: null,
      pairingEndedAt: null,
      phases: [
        {
          name: 'Create Demo Merchant',
          description: 'Create a new test merchant with "Demo" in the name',
          checkpoints: [
            'Merchant name contains "Demo"',
            'Address is valid',
            'Contact email is set'
          ],
          completed: false
        },
        {
          name: 'Coin Setup',
          description: 'Set up wallet and configure blockchains',
          checkpoints: [
            'Wallet connected',
            'USDC on Base enabled',
            'Mempool configured'
          ],
          completed: false
        },
        {
          name: 'Beekeeper Configuration',
          description: 'Configure cash-out settings',
          checkpoints: [
            'Treasury address set',
            'Cash-out frequency chosen',
            'Test withdrawal initiated'
          ],
          completed: false
        },
        {
          name: 'NectarPay App Installation',
          description: 'Install APK on terminal (not browser shortcut)',
          checkpoints: [
            'APK file downloaded',
            'Installation completed',
            'App version visible'
          ],
          completed: false
        },
        {
          name: 'Terminal Pairing',
          description: 'Pair terminal to merchant account',
          checkpoints: [
            'Pairing code generated',
            'Code entered on terminal',
            'Printer test passed',
            'Pairing confirmed'
          ],
          completed: false
        },
        {
          name: 'Test $1 USDC Transaction',
          description: 'Send $1 USDC on Base network, confirm settlement',
          checkpoints: [
            'Send $1 USDC to terminal',
            'Transaction visible in mempool',
            'Block confirmation received',
            'Receipt printed',
            'Transaction marked settled'
          ],
          completed: false
        },
        {
          name: 'Delete Merchant',
          description: 'Clean up demo merchant',
          checkpoints: [
            'All data archived',
            'Merchant deleted from system',
            'Wallet cleaned up'
          ],
          completed: false
        }
      ],
      attestedAt: null
    };

    setDrills([...drills, newDrill]);
    setCurrentDrill(drills.length);
  };

  const toggleCheckpoint = (drillIdx: number, phaseIdx: number, checkpointIdx: number) => {
    setDrills(drills.map((d, di) =>
      di === drillIdx
        ? {
          ...d,
          phases: d.phases.map((p, pi) =>
            pi === phaseIdx
              ? {
                ...p,
                checkpoints: p.checkpoints.map((c, ci) =>
                  ci === checkpointIdx ? `✓ ${c}` : c
                )
              }
              : p
          )
        }
        : d
    ));
  };

  const togglePhaseComplete = (drillIdx: number, phaseIdx: number) => {
    setDrills(drills.map((d, di) =>
      di === drillIdx
        ? {
          ...d,
          phases: d.phases.map((p, pi) =>
            pi === phaseIdx ? { ...p, completed: !p.completed } : p
          )
        }
        : d
    ));
  };

  const startPairingTimer = (drillIdx: number) => {
    const newDrill = { ...drills[drillIdx], pairingStartedAt: new Date() };
    const updatedDrills = [...drills];
    updatedDrills[drillIdx] = newDrill;
    setDrills(updatedDrills);
  };

  const endPairingTimer = (drillIdx: number) => {
    const drill = drills[drillIdx];
    if (drill.pairingStartedAt) {
      const duration = Math.round((new Date().getTime() - drill.pairingStartedAt.getTime()) / 1000);
      setPairingTimes([...pairingTimes, duration].sort((a, b) => a - b).slice(-3));
      
      const newDrill = { ...drill, pairingEndedAt: new Date() };
      const updatedDrills = [...drills];
      updatedDrills[drillIdx] = newDrill;
      setDrills(updatedDrills);
    }
  };

  const attestCompletion = (drillIdx: number) => {
    const newDrill = { ...drills[drillIdx], attestedAt: new Date() };
    const updatedDrills = [...drills];
    updatedDrills[drillIdx] = newDrill;
    setDrills(updatedDrills);
  };

  const completedDrills = drills.filter(d => d.attestedAt).length;
  const progress = (completedDrills / 20) * 100;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl tracking-wider mb-2">Fast Start: 20 Merchant Drills</h1>
        <p className="text-muted-foreground mb-4">
          Practice full onboarding 20 times. Each drill: create demo merchant → Coin → Beekeeper → 
          NectarPay app → terminal pair → test $1 USDC → delete.
        </p>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm font-medium">{completedDrills} of 20 drills complete</span>
            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        {/* Pairing Times Leaderboard */}
        {pairingTimes.length > 0 && (
          <Card className="mb-6 p-4 bg-emerald-500/5 border-emerald-500/20">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-emerald-500 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm mb-2">Fastest Pairing Times</h3>
                <div className="space-y-1">
                  {pairingTimes.map((t, i) => (
                    <div key={i} className="text-sm text-emerald-600">
                      {i + 1}. {t}s {t <= 90 ? '✓ Target' : '↑ Speed up'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Start Button */}
        <Button onClick={startNewDrill} className="mb-8" size="lg">
          Start Drill {drills.length + 1} of 20
        </Button>
      </div>

      {/* Current Drill */}
      {currentDrill !== null && drills[currentDrill] && (
        <Card className="p-6 mb-8 border-blue-500/20 bg-blue-500/5">
          <div className="mb-6">
            <h2 className="font-display text-xl tracking-wider mb-2">
              Drill {drills[currentDrill].number}: {drills[currentDrill].merchantName}
            </h2>
            <p className="text-sm text-muted-foreground">
              Started at {drills[currentDrill].startedAt?.toLocaleTimeString()}
            </p>
          </div>

          {/* Phases */}
          {drills[currentDrill].phases.map((phase, phaseIdx) => (
            <div key={phaseIdx} className="mb-6 pb-6 border-b border-border/40 last:border-b-0">
              <div className="flex items-start gap-3 mb-4">
                <Checkbox
                  checked={phase.completed}
                  onCheckedChange={() => togglePhaseComplete(currentDrill, phaseIdx)}
                />
                <div className="flex-1">
                  <h3 className="font-semibold">{phase.name}</h3>
                  <p className="text-sm text-muted-foreground">{phase.description}</p>
                </div>
              </div>

              {/* Pairing Timer (for phase 5) */}
              {phaseIdx === 4 && !phase.completed && (
                <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                  <div className="flex gap-2 mb-2">
                    <Button
                      size="sm"
                      variant={drills[currentDrill].pairingStartedAt ? 'destructive' : 'default'}
                      onClick={() =>
                        drills[currentDrill].pairingStartedAt
                          ? endPairingTimer(currentDrill)
                          : startPairingTimer(currentDrill)
                      }
                    >
                      {drills[currentDrill].pairingStartedAt ? 'Stop Timer' : 'Start Pairing Timer'}
                    </Button>
                    {drills[currentDrill].pairingStartedAt && (
                      <div className="text-sm font-mono text-amber-600">
                        {Math.round((new Date().getTime() - drills[currentDrill].pairingStartedAt!.getTime()) / 1000)}s
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Target: under 90 seconds</p>
                </div>
              )}

              {/* Checkpoints */}
              <div className="space-y-2 pl-6">
                {phase.checkpoints.map((checkpoint, checkpointIdx) => (
                  <div key={checkpointIdx} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={checkpoint.startsWith('✓')}
                      onCheckedChange={() => toggleCheckpoint(currentDrill, phaseIdx, checkpointIdx)}
                    />
                    <span className={checkpoint.startsWith('✓') ? 'line-through text-muted-foreground' : ''}>
                      {checkpoint.replace('✓ ', '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Attest Completion */}
          <Button
            onClick={() => attestCompletion(currentDrill)}
            disabled={!drills[currentDrill].phases.every(p => p.completed) || drills[currentDrill].attestedAt !== null}
            className="w-full"
            size="lg"
          >
            {drills[currentDrill].attestedAt ? (
              <>
                <CheckCircle2 className="mr-2 w-4 h-4" />
                Completed at {drills[currentDrill].attestedAt!.toLocaleTimeString()}
              </>
            ) : (
              'Self-Attest Completion'
            )}
          </Button>
        </Card>
      )}

      {/* Drill History */}
      {drills.length > 0 && (
        <div>
          <h2 className="font-display text-lg tracking-wider mb-4">All Drills</h2>
          <div className="space-y-2">
            {drills.map((drill, idx) => (
              <Card key={idx} className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">Drill {drill.number}</div>
                  <div className="text-sm text-muted-foreground">{drill.merchantName}</div>
                  {drill.pairingEndedAt && drill.pairingStartedAt && (
                    <div className="text-sm text-emerald-600">
                      Pairing: {Math.round((drill.pairingEndedAt.getTime() - drill.pairingStartedAt.getTime()) / 1000)}s
                    </div>
                  )}
                </div>
                {drill.attestedAt ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-500" />
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Failure Modes Reference */}
      <Card className="mt-8 p-6 border-red-500/20 bg-red-500/5">
        <div className="flex gap-3 mb-4">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold mb-3">Common Failure Modes</h3>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Pairing code expired:</span> Generate a new one; 10-minute window</p>
              <p><span className="font-medium">Browser shortcut used:</span> Install APK instead; browser has no printer/NFC</p>
              <p><span className="font-medium">Test transaction underpaid:</span> Use exact $1 USDC; satoshi rounding can leave unpayable dust</p>
              <p><span className="font-medium">Merchant banned:</span> closeMyAccount sets BAN_FOREVER; only support can reverse</p>
              <p><span className="font-medium">Codes not arriving:</span> Check email spam folder; verify SMS carrier doesn't block</p>
              <p><span className="font-medium">Beekeeper cash-out fails:</span> USDC lookup issue; contact support with order ID</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
