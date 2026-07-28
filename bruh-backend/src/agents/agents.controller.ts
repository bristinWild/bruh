import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentsController {
    constructor(private agents: AgentsService) { }

    @Post(':walletId/run')
    async run(@Param('walletId') walletId: string) {
        // Fire and forget — don't await
        this.agents.runSingleCycle(walletId).catch(console.error);
        return { message: 'Agent cycle started' };
    }

    @Get(':walletId/trades')
    trades(@Param('walletId') walletId: string) {
        return this.agents.getTradeHistory(walletId);
    }
}