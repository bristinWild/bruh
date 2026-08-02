import { Injectable } from '@nestjs/common';
import { CircleService } from '../circle.service';
import { SupabaseService } from '../supabase.service';

@Injectable()
export class WalletsService {
  constructor(
    private circle: CircleService,
    private supabase: SupabaseService,
  ) {}

  private generateAgentId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return `AGT-${code}`;
  }

  async createAgentWallet(
    userAddress: string,
    strategy: string,
    agentName: string,
  ) {
    const walletSet = await this.circle.createWalletSet(`bruh-${userAddress}`);
    const wallet = await this.circle.createWallet(walletSet!.id!, userAddress);

    const { data } = await this.supabase.db
      .from('agent_wallets')
      .insert({
        user_address: userAddress,
        circle_wallet_id: wallet!.id,
        circle_wallet_address: wallet!.address,
        strategy,
        agent_name: agentName,
        agent_id: this.generateAgentId(),
        status: 'paused',
      })
      .select()
      .single();

    return data;
  }

  async getUserWallets(userAddress: string) {
    const { data } = await this.supabase.db
      .from('agent_wallets')
      .select('*')
      .eq('user_address', userAddress);
    return data;
  }

  async updateAgentStatus(walletId: string, status: 'active' | 'paused') {
    const { data } = await this.supabase.db
      .from('agent_wallets')
      .update({ status })
      .eq('id', walletId)
      .select()
      .single();
    return data;
  }

  async updateAgentConfig(
    walletId: string,
    config: {
      edge_threshold?: number;
      kelly_fraction?: number;
      max_position_usdc?: number;
    },
  ) {
    const { data } = await this.supabase.db
      .from('agent_wallets')
      .update(config)
      .eq('id', walletId)
      .select()
      .single();
    return data;
  }
}
