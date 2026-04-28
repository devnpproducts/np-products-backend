import { Module } from '@nestjs/common';
import { RegisterSalesService } from './register-sales.service';
import { RegisterSalesController } from './register-sales.controller';
import { EventsModule } from '../common/events.module';

@Module({
  imports: [EventsModule],
  controllers: [RegisterSalesController],
  providers: [RegisterSalesService],
})

export class RegisterSalesModule {}