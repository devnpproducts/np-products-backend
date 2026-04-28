import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateRegisterSaleDto } from './dto/register-sales.dto';
import { EventsGateway } from '../common/gateways';

@Injectable()
export class RegisterSalesService {
    constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) { }

    // --- funcion jerarquia ---
    async getSubordinateIds(managerId: number): Promise<number[]> {
        const subordinates = await this.prisma.user.findMany({
            where: { managerId: managerId },
            select: { id: true }
        });

        let ids = subordinates.map(s => s.id);

        return [managerId, ...ids];
    }

    async findAll(userId: number) {
        let userIdsToFilter = [userId];

        const userRoleValidation = await this.prisma.user.findUnique({
            where: { id: userId }
        });

        if (!userRoleValidation) {
            throw new Error('Sin ventas');
        }

        if (userRoleValidation.role === 'ADMIN') {
            userIdsToFilter = await this.getSubordinateIds(userId);
        }

        return this.prisma.registerSales.findMany({
            where: { userCreatorId: { in: userIdsToFilter } },
            include: {
                creator: { select: { name: true, user: true } },
                products: true
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async convertToSale(dto: CreateRegisterSaleDto, userId: number) {
        const { products, prospectId, ...saleData } = dto;

        return await this.prisma.$transaction(async (tx) => {
            const newSale = await tx.registerSales.create({
                data: {
                    ...saleData,
                    userCreatorId: userId,
                    products: {
                        create: products?.map(p => ({
                            productName: p.productName,
                            quantity: p.quantity,
                            price: p.price
                        }))
                    }
                },
                include: {
                    products: true,
                    creator: { select: { name: true } }
                }
            });

            await tx.prospects.update({
                where: { id: prospectId },
                data: {
                    isSale: true,
                    isContacted: true,
                    soldAt: new Date()
                }
            });

            const sellerName = newSale.creator?.name || "Vendedor";
            const clientFullName = `${newSale.clientName} ${newSale.clientLastName}`;
            const totalAmount = newSale.netAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

            await tx.notifications.create({
                data: {
                    title: "Nueva Venta Registrada",
                    content: `${sellerName} cerró una venta con ${clientFullName} por ${totalAmount}`,
                    type: 'SALE',
                    userId: userId,
                    metadata: { saleId: newSale.id, client: clientFullName }
                }
            });

            this.eventsGateway.server.emit('activity', {
                user: sellerName,
                change: `Registró venta de ${clientFullName} (${totalAmount})`,
                date: new Date()
            });

            this.eventsGateway.server.emit('notification', {
                type: 'SALE_SUCCESS',
                data: {
                    title: "¡Venta Exitosa!",
                    message: `${clientFullName} compró por un total de ${totalAmount}`,
                    date: new Date(),
                    metadata: { saleId: newSale.id }
                }
            });

            this.eventsGateway.server.emit('refresh_prospects');

            return newSale;
        });
    }

    // --- SEARCH ---
    async searchGlobal(term: string) {
        const [salesData, prospectsData] = await Promise.all([
            this.prisma.registerSales.findMany({
                where: {
                    OR: [
                        { clientName: { contains: term, mode: 'insensitive' } },
                        { clientLastName: { contains: term, mode: 'insensitive' } },
                        { phone: { contains: term } }
                    ]
                },
                include: {
                    creator: { select: { name: true, role: true, user: true } },
                    products: { take: 1, orderBy: { id: 'desc' } }
                },
                take: 10
            }),
            this.prisma.prospects.findMany({
                where: {
                    OR: [
                        { names: { contains: term, mode: 'insensitive' } },
                        { lastNames: { contains: term, mode: 'insensitive' } },
                        { phone: { contains: term } }
                    ]
                },
                include: { seller: { select: { name: true, user: true } } },
                take: 10
            })
        ]);

        const uniqueSales = Array.from(new Map(salesData.map(s => [s.id, s])).values());
        const uniqueProspects = Array.from(new Map(prospectsData.map(p => [p.id, p])).values());

        return {
            sales: uniqueSales.map(s => ({
                id: s.id,
                fullName: `${s.clientName} ${s.clientLastName}`,
                phone: s.phone,
                address: s.address,
                city: s.city,
                sellerName: s.creator.name,
                sellerEmail: s.creator.user,
                lastProduct: s.products[0]?.productName || 'N/A',
                lastAmount: s.netAmount,
                date: s.purchaseDate,
                paymentMethod: s.paymentMethod,
                type: 'CLIENTE_VENTA'
            })),
            prospects: uniqueProspects.map(p => ({
                id: p.id,
                fullName: `${p.names} ${p.lastNames}`,
                phone: p.phone,
                address: p.address,
                sellerName: p.seller?.name || 'No asignado',
                type: 'PROSPECTO'
            }))
        };
    }
}