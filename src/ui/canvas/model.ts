import type { GameState } from '../../game/types';
import type { BodyState } from '../../game/body';

export type PanelRow =
  | { kind: 'body'; body: BodyState }
  | { kind: 'text'; text: string; emphasis?: 'heading' | 'muted'; icon?: string }
  | { kind: 'action'; label: string; action: string; disabled?: boolean; selected?: boolean }
  | { kind: 'input'; value: string; change: (value: string) => void };

export interface GamePanel {
  title: string;
  rows: PanelRow[];
  subtitle?: string;
  portrait?: string;
  dismissible?: boolean;
  skipAction?: string;
  layout?: 'dialogue' | 'folio' | 'notice' | 'creation';
  placement?: 'battle';
  hero?: GameState;
  inventory?: boolean;
  inventoryState?: GameState;
  initialSection?: string;
  sections?: {
    id: string;
    title: string;
    caption: string;
    rows: PanelRow[];
    hero?: boolean;
    icon?: string;
    quantity?: number;
    equipped?: boolean;
  }[];
}

export const paragraph = (text: string): PanelRow => ({ kind: 'text', text });
export const heading = (text: string): PanelRow => ({ kind: 'text', text, emphasis: 'heading' });
export const action = (label: string, action: string): Extract<PanelRow, { kind: 'action' }> => ({
  kind: 'action',
  label,
  action,
});
