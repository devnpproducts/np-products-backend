import { Module } from '@nestjs/common';
import { PdfController } from './invoice-generator.controller';
import { InvoiceGeneratorService } from './invoice-generator.service';

import { SalesModule } from '../sales/sales.module'; 

@Module({
    imports: [SalesModule],
    controllers: [PdfController],
    providers: [InvoiceGeneratorService],
})
export class PdfModule {}