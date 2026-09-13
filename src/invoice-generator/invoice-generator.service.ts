import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'path';
const { ZipArchive } = require('archiver');
import { PassThrough } from 'stream';

import { SalesService } from '../sales/sales.service';

const PDFDocument = require('pdfkit');

const logoPath = path.join(process.cwd(), 'assets', 'logo_boleta.png');

@Injectable()
export class InvoiceGeneratorService {
    constructor(private readonly salesService: SalesService) {}

    async generateBulkZipPDF(params: {
        sellerId?: string;
        supervisorId?: string;
        startDate: string;
        endDate: string;
    }): Promise<Buffer> {
        const sales = await this.salesService.findForBulkExport(params);

        if (!sales || sales.length === 0) {
            throw new NotFoundException(
                'No se encontraron ventas para los filtros seleccionados en este rango de fechas'
            );
        }

        const archive = new ZipArchive({ zlib: { level: 9 } });
        const chunks: Buffer[] = [];

        const passthrough = new PassThrough();

        passthrough.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
        });

        return new Promise(async (resolve, reject) => {
            passthrough.on('end', () => {
                resolve(Buffer.concat(chunks));
            });

            archive.on('error', (err: any) => {
                reject(err);
            });

            archive.pipe(passthrough);

            try {
                for (const sale of sales) {
                    const pdfBuffer = await this.generatePDF(sale);

                    archive.append(pdfBuffer, {
                        name: `orden_${sale.id}.pdf`,
                    });
                }

                const bulkPdfBuffer = await this.generateBulkPDF(sales);

                archive.append(bulkPdfBuffer, {
                    name: 'boletas_completas.pdf',
                });

                await archive.finalize();
            } catch (error) {
                reject(error);
            }
        });
    }

    async generatePDF(saleData: any): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 40,
                });

                const chunks: Buffer[] = [];

                doc.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });

                doc.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });

                doc.on('error', (err: any) => {
                    reject(err);
                });

                this.renderSale(doc, saleData);

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    async generateBulkPDF(sales: any[]): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 40,
                    autoFirstPage: false,
                });

                const chunks: Buffer[] = [];

                doc.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });

                doc.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });

                doc.on('error', (err: any) => {
                    reject(err);
                });

                sales.forEach((sale, index) => {
                    doc.addPage();

                    this.renderSale(doc, sale);
                });

                doc.end();
            } catch (error) {
                reject(error);
            }
        });
    }

    private renderSale(doc: any, saleData: any) {
        doc.image(logoPath, 60, 60, { width: 120 });

        doc
            .fontSize(20)
            .font('Helvetica-Bold')
            .text('ORDEN DE VENTA', 300, 45, {
                align: 'right',
            });

        doc
            .fontSize(10)
            .font('Helvetica')
            .text(`Nº Venta: ${saleData.id || 'N/A'}`, 300, 65, {
                align: 'right',
            });

        const drawSection = (title: string, y: number) => {
            doc
                .fontSize(10)
                .font('Helvetica-Bold')
                .text(title, 40, y);

            doc
                .moveTo(40, y + 12)
                .lineTo(550, y + 12)
                .stroke('#cccccc');
        };

        drawSection('INFORMACIÓN DE CLIENTE', 150);

        doc
            .fontSize(9)
            .font('Helvetica')
            .text(
                `${saleData.clientName || ''} ${saleData.clientLastName || ''}`,
                40,
                170
            );

        doc.text(
            `Teléfono: ${saleData.phone || 'N/A'} | Dirección: ${saleData.address || 'N/A'}`,
            40,
            182
        );

        doc.text(
            `Ciudad: ${saleData.city || 'N/A'}, ${saleData.state || 'N/A'}`,
            40,
            194
        );

        drawSection('INFORMACIÓN DEL PEDIDO', 220);

        doc
            .fontSize(9)
            .text(
                `Fecha: ${new Date(saleData.createdAt).toLocaleDateString()}`,
                40,
                240
            );

        doc.text(
            `Estado: ${saleData.packageStatus || 'INGRESADO'} | Encargado: ${saleData.sellerName || 'N/A'}`,
            40,
            252
        );

        doc.text(
            `Tracking: ${saleData.trackingNumber || 'Pendiente'}`,
            40,
            264
        );

        if (saleData.trackingLink) {
            doc
                .fillColor('blue')
                .text(
                    `Link de seguimiento: ${saleData.trackingLink}`,
                    40,
                    276,
                    {
                        link: saleData.trackingLink,
                        underline: true,
                    }
                );

            doc.fillColor('black');
        }

        drawSection('DETALLE DE PAGO', 310);

        doc
            .fontSize(9)
            .text(
                `Método: ${saleData.paymentMethod || 'N/A'} | Titular: ${saleData.cardHolder || 'N/A'}`,
                40,
                330
            );

        const isCard =
            (saleData.paymentMethod || '').trim() === 'DEBIT CREDIT';

        if (isCard) {
            doc.text(
                `Tarjeta: **** **** **** ${(saleData.cardNumber || '').slice(-4)}`,
                40,
                342
            );

            doc.text(
                `Verificación: EXP ${saleData.cardExp || 'N/A'} | CVC: ${
                    saleData.cardCvc ? '***' : 'N/A'
                }`,
                40,
                354
            );
        } else {
            doc.text(
                `Detalles: ${saleData.paymentMethod || 'N/A'}`,
                40,
                342
            );
        }

        let y = 390;

        doc
            .font('Helvetica-Bold')
            .fontSize(10)
            .text('PRODUCTO', 40, y);

        doc.text('CANTIDAD', 450, y, {
            align: 'right',
        });

        doc
            .moveTo(40, y + 15)
            .lineTo(550, y + 15)
            .stroke('#000000');

        y += 25;

        (saleData.products || []).forEach((p: any) => {
            doc
                .font('Helvetica')
                .fontSize(9)
                .text(p.productName, 40, y);

            doc.text(p.quantity.toString(), 450, y, {
                align: 'right',
            });

            y += 20;
        });

        y += 10;

        doc
            .moveTo(350, y)
            .lineTo(550, y)
            .stroke('#000000');

        doc
            .font('Helvetica-Bold')
            .text(
                `MONTO BRUTO: $${(saleData.grossAmount || 0).toFixed(2)}`,
                450,
                y + 10,
                {
                    align: 'right',
                }
            );

        doc
            .font('Helvetica-Bold')
            .text(
                `IMPUESTO: $${(saleData.tax || 0).toFixed(2)}`,
                450,
                y + 25,
                {
                    align: 'right',
                }
            );

        doc
            .font('Helvetica-Bold')
            .text(
                `MONTO NETO: $${(saleData.netAmount || 0).toFixed(2)}`,
                450,
                y + 40,
                {
                    align: 'right',
                }
            );
    }
}