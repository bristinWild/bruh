import { Controller, Post, Get, Patch, Body, Param, Request, UseGuards } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
    constructor(private wallets: WalletsService) { }

    @Post()
    create(@Request() req: any, @Body() body: { strategy: string; agentName: string }) {
        return this.wallets.createAgentWallet(req.user.address, body.strategy, body.agentName);
    }

    @Get()
    list(@Request() req: any) {
        return this.wallets.getUserWallets(req.user.address);
    }

    @Patch(':id/status')
    updateStatus(@Param('id') id: string, @Body() body: { status: 'active' | 'paused' }) {
        return this.wallets.updateAgentStatus(id, body.status);
    }

    @Patch(':id/config')
    updateConfig(@Param('id') id: string, @Body() body: any) {
        return this.wallets.updateAgentConfig(id, body);
    }
}