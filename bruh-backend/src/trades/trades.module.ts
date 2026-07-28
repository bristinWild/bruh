import { Module } from '@nestjs/common';
import { TradesService } from './trades.service';

@Module({
  providers: [TradesService]
})
export class TradesModule {}
