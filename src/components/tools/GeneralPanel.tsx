import { Info } from 'lucide-react';
import { tr } from '../../i18n';
import { Card } from './ui';

const APP_VERSION = typeof __APP_VERSION__ === 'undefined' ? '' : __APP_VERSION__;

export function GeneralPanel() {
  return (
    <Card title={tr('Geral')} Icon={Info} accent="text-indigo-400">
      <div className="flex flex-col gap-1 py-1">
        <p className="text-sm font-bold text-[var(--text-main)]">NexusMIDI Pro</p>
        <p className="text-[11px] text-[var(--text-muted)]">
          {APP_VERSION ? `Versão v${APP_VERSION}` : 'Versão de desenvolvimento'}
        </p>
      </div>
    </Card>
  );
}
