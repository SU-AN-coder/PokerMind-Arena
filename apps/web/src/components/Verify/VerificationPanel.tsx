import { useState } from 'react';
import { keccak256, toUtf8Bytes } from 'ethers';
import type { VerificationData } from '@/types/game';

type Step = 'idle' | 'fetching' | 'computing' | 'comparing' | 'done';

export function VerificationPanel({ verification }: { verification: VerificationData }) {
  const [step, setStep] = useState<Step>('idle');
  const [computed, setComputed] = useState('');
  const [matched, setMatched] = useState<boolean | null>(null);

  const run = async () => {
    setStep('fetching');
    const res = await fetch(`https://w3s.link/ipfs/${verification.ipfsCid}`);
    const raw = await res.text();

    await sleep(300);
    setStep('computing');
    const h = keccak256(toUtf8Bytes(raw));
    setComputed(h);

    await sleep(300);
    setStep('comparing');
    setMatched(h.toLowerCase() === verification.onChainHash.toLowerCase());

    await sleep(200);
    setStep('done');
  };

  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
      {step === 'idle' ? (
        <button onClick={run} className="w-full py-2 rounded bg-blue-600 text-white font-bold">🔍 开始验证</button>
      ) : (
        <div className="space-y-1 text-sm">
          <div>1. IPFS 拉取: {step === 'fetching' ? '进行中' : '完成'}</div>
          <div>2. 计算哈希: {step === 'computing' ? '进行中' : ['comparing', 'done'].includes(step) ? '完成' : '等待'}</div>
          <div>3. 链上比对: {step === 'comparing' ? '进行中' : step === 'done' ? '完成' : '等待'}</div>
          {step === 'done' ? (
            <div className={`mt-2 p-2 rounded ${matched ? 'bg-green-900/40' : 'bg-red-900/40'}`}>
              <div className={matched ? 'text-green-400' : 'text-red-400'}>{matched ? '✅ 验证通过' : '❌ 验证失败'}</div>
              <div className="break-all text-xs text-gray-300 mt-1">链上: {verification.onChainHash}</div>
              <div className="break-all text-xs text-gray-300">本地: {computed}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
