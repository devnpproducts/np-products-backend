import { Module } from '@nestjs/common';
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CampaignModule } from './campaign/campaign.module';
import { ProspectsModule } from './prospects/prospects.module';
import { RegisterSalesModule } from './register-sales/register-sales.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    NotificationsModule,
    CampaignModule,
    ProspectsModule,
    RegisterSalesModule
  ],
})

export class AppModule {}
