// sales.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateSaleDto, CreateSaleDto } from './dto/sales.dto';

import { EventsGateway } from '../common/gateways';
import { encrypt, decrypt } from '../utils/crypto.util';

@Injectable()
export class SalesService {
    constructor(private prisma: PrismaService, private eventsGateway: EventsGateway) { }

    async getSubordinateIds(managerId: number): Promise<number[]> {
        const subordinates = await this.prisma.user.findMany({
            where: { managerId: managerId },
            select: { id: true }
        });

        let ids = subordinates.map(s => s.id);

        return [managerId, ...ids];
    }

    async registerSale(dto: CreateSaleDto, userId: number, receiptUrl?: string | null) {
        return await this.prisma.$transaction(async (tx: any) => {

            let finalContactId = null;
            let isExistingContact = false;

            if (dto.contactId) {
                const contactExists = await tx.Contacts.findUnique({
                    where: { id: dto.contactId }
                });

                if (contactExists) {
                    finalContactId = contactExists.id;
                    isExistingContact = true;
                }
            }

            if (!finalContactId) {
                const newContact = await tx.Contacts.create({
                    data: {
                        userCreatorId: userId,
                        sellerId: userId,
                        names: dto.clientName,
                        lastNames: dto.clientLastName,
                        originType: 'SALES',
                        phone: dto.phone,
                        city: dto.city || null,
                        state: dto.state || null,
                        address: dto.address || null,
                        zipCode: dto.zipCode || null,
                        status: true,
                        contactStatus: 'VENTA',
                        isSale: true,
                        soldAt: new Date(),
                        autoCreated: true
                    }
                });
                finalContactId = newContact.id;
            }

            const sale = await tx.registerSales.create({
                data: {
                    userCreatorId: userId,
                    contactId: finalContactId,
                    receiptUrl: receiptUrl || dto.receiptUrl || null,
                    clientName: dto.clientName,
                    clientLastName: dto.clientLastName,
                    phone: dto.phone,
                    address: dto.address,
                    city: dto.city,
                    state: dto.state,
                    zipCode: dto.zipCode,
                    grossAmount: dto.grossAmount,
                    tax: dto.tax || 0,
                    netAmount: dto.netAmount,
                    paymentMethod: dto.paymentMethod,
                    paymentInstallments: dto.paymentInstallments || 0,
                    comments: dto.comments,
                    cardHolder: dto.cardHolder ? encrypt(dto.cardHolder) : null,
                    cardNumber: dto.cardNumber ? encrypt(dto.cardNumber) : null,
                    cardExp: dto.cardExp ? encrypt(dto.cardExp) : null,
                    cardCvc: dto.cardCvc ? encrypt(dto.cardCvc) : null,
                    purchaseDate: dto.purchaseDate,
                    products: {
                        create: (dto.products || []).map((p: any) => ({
                            productName: p.productName,
                            quantity: p.quantity,
                            price: p.price
                        }))
                    }
                },
                include: {
                    creator: { select: { name: true } }
                }
            });

            for (const p of (dto.products || [])) {
                await tx.products.updateMany({
                    where: { sku: p.productName },
                    data: {
                        stock: {
                            decrement: Number(p.quantity)
                        }
                    }
                });
            }

            if (isExistingContact) {
                await tx.Contacts.update({
                    where: { id: finalContactId },
                    data: {
                        isSale: true,
                        markSale: true,
                        soldAt: new Date(),
                        contactStatus: 'VENTA'
                    }
                });
            }

            if (dto.contactId) {
            const becameProspect = await tx.prospects.findFirst({
                where: { 
                    id: dto.contactId,
                    originType: 'BASE' 
                }
            });

            if (becameProspect) {
                await tx.prospects.update({
                    where: { id: becameProspect.id },
                    data: {
                        isSale: true,
                        soldAt: new Date(),
                        contactStatus: 'VENTA',
                        isContacted: true
                    }
                });
            }
        }

            await tx.registerChanceSales.create({
                data: {
                    userCreatorId: userId,
                    saleId: sale.id,
                    change: `Venta inicial registrada por $${dto.netAmount}`
                }
            });

            const sellerName = sale.creator?.name || "Vendedor";
            const clientFullName = `${sale.clientName} ${sale.clientLastName}`;
            const totalAmount = sale.netAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

            await tx.notifications.create({
                data: {
                    title: "Nueva Venta Registrada",
                    content: `${sellerName} cerró una venta con ${clientFullName} por ${totalAmount}`,
                    type: 'SALE',
                    userId: userId,
                    metadata: { saleId: sale.id, client: clientFullName, totalAmount: sale.netAmount }
                }
            });

            this.eventsGateway.server.to('room_management').emit('activity', {
                user: sellerName,
                change: `Registró venta de ${clientFullName} (${totalAmount})`,
                date: new Date()
            });

            this.eventsGateway.server.to(['room_management', `room_user_${userId}`]).emit('notification', {
                type: 'SALE_SUCCESS',
                data: {
                    title: "¡Venta Exitosa!",
                    message: `${clientFullName} compró por un total de ${totalAmount}`,
                    date: new Date(),
                    metadata: { saleId: sale.id, totalAmount: sale.netAmount }
                }
            });

            return sale;
        });
    }

    async findOne(id: number) {
        const sale = await this.prisma.registerSales.findUnique({
            where: { id },
            include: {
                creator: { select: { name: true } },
                products: true,
            },
        });

        if (!sale) {
            throw new NotFoundException(`La venta con ID ${id} no fue encontrada en el sistema.`);
        }

        if (sale.cardHolder) sale.cardHolder = decrypt(sale.cardHolder);
        if (sale.cardNumber) sale.cardNumber = decrypt(sale.cardNumber);
        if (sale.cardExp) sale.cardExp = decrypt(sale.cardExp);
        if (sale.cardCvc) sale.cardCvc = decrypt(sale.cardCvc);

        return {
            ...sale,
            sellerName: sale.creator?.name || 'N/A'
        };
    }

    async findAll(userId: number) {
        const requester = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!requester) throw new Error('Usuario no encontrado');

        const where: any = {};

        if (!['ADMIN', 'DESPACHO', 'SEGUIMIENTO'].includes(requester.role || '')) {
            const authorizedUserIds = await this.getSubordinateIds(userId);

            where.userCreatorId = { in: authorizedUserIds };
        }

        const resp = await this.prisma.registerSales.findMany({
            where,
            include: {
                creator: { select: { name: true } },
                products: true,
            },
            orderBy: { createdAt: 'desc' }
        });

        resp.forEach((sale) => {
            if (sale.cardHolder) sale.cardHolder = decrypt(sale.cardHolder);
            if (sale.cardNumber) sale.cardNumber = decrypt(sale.cardNumber);
            if (sale.cardExp) sale.cardExp = decrypt(sale.cardExp);
            if (sale.cardCvc) sale.cardCvc = decrypt(sale.cardCvc);
        });

        return resp;
    }

    async findByProspectId(contactId: number) {
        const sale = await this.prisma.registerSales.findFirst({
            where: { contactId },
            include: { products: true }
        });

        if (!sale) {
            throw new NotFoundException('No hay venta registrada para este prospecto');
        }

        if (sale.cardHolder) sale.cardHolder = decrypt(sale.cardHolder);
        if (sale.cardNumber) sale.cardNumber = decrypt(sale.cardNumber);
        if (sale.cardExp) sale.cardExp = decrypt(sale.cardExp);
        if (sale.cardCvc) sale.cardCvc = decrypt(sale.cardCvc);

        return sale;
    }

    async searchSales(term: string, userId: number) {
        const requester = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!requester) throw new Error('Usuario no encontrado');

        const where: any = {
            OR: [
                { clientName: { contains: term } },
                { clientLastName: { contains: term } },
                { phone: { contains: term } },
                { trackingLink: { contains: term } }
            ]
        };

        if (!['ADMIN', 'DESPACHO', 'SEGUIMIENTO'].includes(requester.role || '')) {
            const authorizedUserIds = await this.getSubordinateIds(userId);

            where.userCreatorId = { in: authorizedUserIds };
        }

        return this.prisma.registerSales.findMany({
            where,
            include: { creator: { select: { name: true } } }
        });
    }

    async updateTracking(
        saleId: number,
        data: { trackingLink: string; packageStatus: string; dispatchDate?: string | Date | null; deliveryDate?: string | Date | null },
        userId: number
    ) {
        return await this.prisma.$transaction(async (tx) => {

            let finalDeliveryDate: Date | null | undefined = undefined;

            if (data.packageStatus === 'ENTREGADO' || data.packageStatus === 'ENTREGADO CONFORME') {
                finalDeliveryDate = data.deliveryDate ? new Date(data.deliveryDate) : new Date();
            } else {
                finalDeliveryDate = null;
            }

            const updatedSale = await tx.registerSales.update({
                where: { id: saleId },
                data: {
                    trackingLink: data.trackingLink,
                    packageStatus: data.packageStatus,
                    dispatchDate: data.dispatchDate ? new Date(data.dispatchDate) : null,
                    deliveryDate: finalDeliveryDate
                }
            });

            const linkText = data.trackingLink ? `. Link: ${data.trackingLink}` : '';

            await tx.registerChanceSales.create({
                data: {
                    userCreatorId: userId,
                    saleId: saleId,
                    change: `Envío actualizado a: ${data.packageStatus}${linkText}`
                }
            });

            return updatedSale;
        });
    }

    async globalSearch(term: string, userId: number) {
        const requester = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!requester) throw new Error('Usuario no encontrado');

        const hasFullAccess = ['ADMIN', 'DESPACHO', 'SEGUIMIENTO'].includes(requester.role || '');

        let authorizedUserIds: number[] = [];
        if (!hasFullAccess) {
            authorizedUserIds = await this.getSubordinateIds(userId);
        }

        const accessFilter = hasFullAccess ? {} : {
            AND: [
                {
                    OR: [
                        { userCreatorId: { in: authorizedUserIds } },
                        { sellerId: { in: authorizedUserIds } }
                    ]
                }
            ]
        };

        const salesAccessFilter = hasFullAccess ? {} : { userCreatorId: { in: authorizedUserIds } };

        const [sales, contacts, prospects] = await Promise.all([
            this.prisma.registerSales.findMany({
                where: {
                    status: true,
                    OR: [
                        { clientName: { contains: term, mode: 'insensitive' } },
                        { clientLastName: { contains: term, mode: 'insensitive' } },
                        { phone: { contains: term, mode: 'insensitive' } },
                    ],
                    ...salesAccessFilter
                },
                include: {
                    creator: { select: { name: true } },
                    products: true,
                    contact: true
                },
                take: 5
            }),

            this.prisma.contacts.findMany({
                where: {
                    status: true,
                    OR: [
                        { names: { contains: term, mode: 'insensitive' } },
                        { lastNames: { contains: term, mode: 'insensitive' } },
                        { phone: { contains: term, mode: 'insensitive' } },
                    ],
                    ...accessFilter
                },
                include: {
                    seller: { select: { name: true } }
                },
                take: 5
            }),

            this.prisma.prospects.findMany({
                where: {
                    status: true,
                    isSale: false,
                    OR: [
                        { names: { contains: term, mode: 'insensitive' } },
                        { lastNames: { contains: term, mode: 'insensitive' } },
                        { phone: { contains: term, mode: 'insensitive' } },
                    ],
                    ...accessFilter
                },
                include: {
                    campaign: { select: { name: true } },
                    seller: { select: { name: true } }
                },
                take: 5
            })
        ]);

        return {
            sales: sales.map(s => ({
                id: s.id,
                type: 'SALE',
                fullName: `${s.clientName} ${s.clientLastName}`,
                phone: s.phone || s.contact?.phone,
                address: s.address || s.contact?.address,
                city: s.city || s.contact?.city,
                state: s.state || s.contact?.state,
                zipCode: s.zipCode || s.contact?.zipCode,
                netAmount: s.netAmount,
                purchaseDate: s.purchaseDate,
                paymentMethod: s.paymentMethod,
                packageStatus: s.packageStatus || 'PENDIENTE',
                trackingLink: s.trackingLink,
                products: s.products,
                sellerName: s.creator?.name,
                originType: s.contact?.origin || 'Venta Directa'
            })),

            prospects: [
                ...contacts.map(c => ({
                    id: c.id,
                    type: 'CONTACT',
                    fullName: `${c.names} ${c.lastNames}`,
                    phone: c.phone,
                    address: c.address,
                    city: c.city,
                    state: c.state,
                    zipCode: c.zipCode,
                    campaignName: 'ORGANICO',
                    contactStatus: c.contactStatus,
                    originType: c.origin,
                    sellerName: c.seller?.name || 'Sin asignar'
                })),
                ...prospects.map(p => ({
                    id: p.id,
                    type: 'PROSPECT',
                    fullName: `${p.names} ${p.lastNames}`,
                    phone: p.phone,
                    address: p.address,
                    city: p.city,
                    state: p.state,
                    zipCode: p.zipCode,
                    campaignName: p.campaign?.name,
                    contactStatus: p.contactStatus,
                    originType: p.originType,
                    sellerName: p.seller?.name || 'Sin asignar'
                }))
            ]
        };
    }

    async updateSale(saleId: number, data: UpdateSaleDto, userId: number) {
        const saleExists = await this.prisma.registerSales.findUnique({
            where: { id: saleId }
        });

        if (!saleExists) {
            throw new NotFoundException(`La venta con ID #${saleId} no existe en el sistema.`);
        }

        return await this.prisma.$transaction(async (tx) => {
            const saleUpdatePayload: any = {
                clientName: data.clientName,
                clientLastName: data.clientLastName,
                phone: data.phone,
                address: data.address,
                city: data.city,
                state: data.state,
                zipCode: data.zipCode,
                grossAmount: data.grossAmount !== undefined ? Number(data.grossAmount) : undefined,
                tax: data.tax !== undefined ? Number(data.tax) : undefined,
                netAmount: data.netAmount !== undefined ? Number(data.netAmount) : undefined,
                paymentMethod: data.paymentMethod,
                paymentInstallments: data.paymentInstallments !== undefined ? Number(data.paymentInstallments) : undefined,
                comments: data.comments,

                trackingNumber: data.trackingNumber,
                trackingLink: data.trackingLink,
                packageStatus: data.packageStatus,
                status: data.status,

                deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : undefined,
                dispatchDate: data.dispatchDate ? new Date(data.dispatchDate) : undefined,
            };

            if (data.paymentMethod === "DEBIT CREDIT") {
                if (data.cardHolder) saleUpdatePayload.cardHolder = encrypt(data.cardHolder);
                if (data.cardNumber) saleUpdatePayload.cardNumber = encrypt(data.cardNumber);
                if (data.cardExp) saleUpdatePayload.cardExp = encrypt(data.cardExp);
                if (data.cardCvc) saleUpdatePayload.cardCvc = encrypt(data.cardCvc);
            } else if (data.paymentMethod !== undefined) {
                saleUpdatePayload.cardHolder = null;
                saleUpdatePayload.cardNumber = null;
                saleUpdatePayload.cardExp = null;
                saleUpdatePayload.cardCvc = null;
            }

            const auditLogs: string[] = [];

            for (const key of Object.keys(saleUpdatePayload)) {
                const newValue = saleUpdatePayload[key];
                const oldValue = (saleExists as any)[key];

                if (newValue !== undefined) {
                    let plainOld = oldValue;
                    let plainNew = newValue;

                    if (['cardHolder', 'cardNumber', 'cardExp', 'cardCvc'].includes(key)) {
                        plainOld = oldValue ? decrypt(oldValue) : null;
                        plainNew = data.paymentMethod === "DEBIT CREDIT" ? (data as any)[key] : null;
                    }

                    const normOld = (plainOld === null || plainOld === undefined || plainOld === '') ? null : plainOld;
                    const normNew = (plainNew === null || plainNew === undefined || plainNew === '') ? null : plainNew;

                    if (normOld !== normNew) {
                        if (oldValue instanceof Date && newValue instanceof Date) {
                            if (oldValue.getTime() !== newValue.getTime()) {
                                auditLogs.push(`${key}: ${oldValue.toLocaleDateString()} -> ${newValue.toLocaleDateString()}`);
                            }
                        } else if (key === 'cardNumber' && normNew) {
                            auditLogs.push(`cardNumber: Actualizada (Termina en ${String(normNew).slice(-4)})`);
                        } else if (['cardCvc', 'cardExp'].includes(key) && normNew) {
                            auditLogs.push(`${key}: Datos de tarjeta modificados`);
                        } else {
                            auditLogs.push(`${key}: ${normOld ?? 'N/A'} -> ${normNew ?? 'N/A'}`);
                        }
                    }
                }
            }

            const updatedSale = await tx.registerSales.update({
                where: { id: saleId },
                data: saleUpdatePayload
            });

            if (data.products && Array.isArray(data.products)) {
                const existingProducts = await tx.saleProducts.findMany({
                    where: { saleId: saleId }
                });

                const incomingIds = data.products
                    .map((p: any) => p.id)
                    .filter((id: any) => id != null) as number[];

                const productsToDelete = existingProducts.filter(p => !incomingIds.includes(p.id));
                if (productsToDelete.length > 0) {
                    await tx.saleProducts.deleteMany({
                        where: { id: { in: productsToDelete.map(p => p.id) } }
                    });
                }

                for (const prod of data.products) {
                    if (prod.id) {
                        await tx.saleProducts.update({
                            where: { id: Number(prod.id) },
                            data: {
                                productName: prod.productName,
                                quantity: Number(prod.quantity),
                                price: Number(prod.price)
                            }
                        });
                    } else {
                        auditLogs.push(`Añadido: ${prod.productName} (Cant: ${prod.quantity})`);

                        await tx.saleProducts.create({
                            data: {
                                saleId: saleId,
                                productName: prod.productName,
                                quantity: Number(prod.quantity),
                                price: Number(prod.price)
                            }
                        });

                        await tx.products.updateMany({
                            where: { sku: prod.productName },
                            data: {
                                stock: {
                                    decrement: Number(prod.quantity)
                                }
                            }
                        });
                    }
                }
            }

            const changeDescription = auditLogs.length > 0
                ? auditLogs.join(' | ')
                : 'Venta actualizada sin modificaciones en los valores.';

            await tx.registerChanceSales.create({
                data: {
                    saleId: saleId,
                    userCreatorId: userId,
                    change: changeDescription
                }
            });

            return updatedSale;
        });
    }

    async getDashboardMetrics(range: string, userId: number) {
        const requester = await this.prisma.user.findUnique({ where: { id: userId } });
        const isAdmin = requester?.role === 'ADMIN';

        const authorizedUserIds = isAdmin ? [] : await this.getSubordinateIds(userId);

        const now = new Date();
        let startDate = new Date();

        if (range === 'today') {
            startDate.setHours(0, 0, 0, 0);
        } else if (range === '7d') {
            startDate.setDate(now.getDate() - 7);
        } else if (range === '1m') {
            startDate.setMonth(now.getMonth() - 1);
        }

        const salesWhere: any = {
            createdAt: { gte: startDate },
            status: true
        };

        const prospectWhere: any = {
            createdAt: { gte: startDate },
            status: true
        };

        if (!isAdmin) {
            salesWhere.userCreatorId = { in: authorizedUserIds };
            prospectWhere.OR = [
                { userCreatorId: { in: authorizedUserIds } },
                { sellerId: { in: authorizedUserIds } }
            ];
        }

        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        const trendSalesWhere = {
            createdAt: { gte: fourteenDaysAgo },
            status: true,
            ...(!isAdmin ? { userCreatorId: { in: authorizedUserIds } } : {})
        };

        const [
            salesData,
            prospectsCount,
            totalSalesCount,
            topSellersGroup,
            originsGroup,
            trendSalesRaw
        ] = await Promise.all([
            this.prisma.registerSales.aggregate({ where: salesWhere, _sum: { netAmount: true } }),
            this.prisma.prospects.count({ where: prospectWhere }),
            this.prisma.registerSales.count({ where: salesWhere }),

            this.prisma.registerSales.groupBy({
                by: ['userCreatorId'],
                where: salesWhere,
                _sum: { netAmount: true },
                orderBy: { _sum: { netAmount: 'desc' } },
                take: 3
            }),

            this.prisma.prospects.groupBy({
                by: ['origin'],
                where: prospectWhere,
                _count: { id: true }
            }),

            this.prisma.registerSales.findMany({
                where: trendSalesWhere,
                select: { netAmount: true, createdAt: true }
            })
        ]);

        const topSellersUsers = await this.prisma.user.findMany({
            where: { id: { in: topSellersGroup.map(g => g.userCreatorId) } },
            select: { id: true, name: true }
        });

        const topSellers = topSellersGroup.map(g => {
            const user = topSellersUsers.find(u => u.id === g.userCreatorId);
            return {
                name: user?.name || 'Sistema',
                ventas: g._sum.netAmount || 0
            };
        });

        const originMap: Record<string, number> = {};

        originsGroup.forEach(g => {
            const rawOrigin = (g.origin || '').trim().toUpperCase();
            let normalizedOrigin = 'Orgánico / Otro';

            if (rawOrigin.includes('FACEBOOK')) {
                normalizedOrigin = 'Facebook';
            } else if (rawOrigin.includes('INSTAGRAM')) {
                normalizedOrigin = 'Instagram';
            } else if (rawOrigin.includes('WHATSAPP')) {
                normalizedOrigin = 'WhatsApp';
            } else if (rawOrigin.includes('MANUAL') || rawOrigin.includes('CARGA')) {
                normalizedOrigin = 'Carga Manual';
            } else if (rawOrigin.includes('CAMPAÑA') || rawOrigin.includes('CAMPANA')) {
                normalizedOrigin = 'Campaña';
            } else if (rawOrigin.includes('ORGÁNICO') || rawOrigin.includes('ORGANICO')) {
                normalizedOrigin = 'Orgánico / Otro';
            } else if (rawOrigin !== '') {
                normalizedOrigin = rawOrigin.charAt(0).toUpperCase() + rawOrigin.slice(1).toLowerCase();
            }

            if (!originMap[normalizedOrigin]) {
                originMap[normalizedOrigin] = 0;
            }
            originMap[normalizedOrigin] += g._count.id;
        });

        const leadOrigins = Object.keys(originMap).map(key => ({
            name: key,
            value: originMap[key]
        }));

        const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const weeklySales = daysOfWeek.map(day => ({ day, actual: 0, pasada: 0 }));

        const sevenDaysAgoTime = now.getTime() - (7 * 24 * 60 * 60 * 1000);

        trendSalesRaw.forEach(sale => {
            const saleTime = sale.createdAt.getTime();
            const dayName = daysOfWeek[sale.createdAt.getDay()];
            const targetDay = weeklySales.find(w => w.day === dayName);

            if (targetDay) {
                if (saleTime >= sevenDaysAgoTime) {
                    targetDay.actual += sale.netAmount;
                } else {
                    targetDay.pasada += sale.netAmount;
                }
            }
        });

        const todayIndex = now.getDay();
        const sortedWeeklySales = [
            ...weeklySales.slice(todayIndex + 1),
            ...weeklySales.slice(0, todayIndex + 1)
        ];

        const conversionRate = prospectsCount > 0
            ? ((totalSalesCount / prospectsCount) * 100).toFixed(1)
            : "0.0";

        return {
            totalSales: salesData._sum.netAmount || 0,
            newProspects: prospectsCount,
            conversionRate: conversionRate,
            topSellers: topSellers,
            leadOrigins: leadOrigins,
            weeklySales: sortedWeeklySales
        };
    }

    async getSaleHistory(saleId: number, userId: number) {

        const requester = await this.prisma.user.findUnique({ where: { id: userId } });
        const hasGlobalAccess = ["ADMIN", "DESPACHO", "SEGUIMIENTO"].includes(requester?.role || "");

        let allowedSellerIds: number[] = [];

        if (!hasGlobalAccess) {
            allowedSellerIds = await this.getSubordinateIds(userId);
        }

        return await this.prisma.registerChanceSales.findMany({
            where: {
                saleId: Number(saleId),
                ...(hasGlobalAccess ? {} : {
                    sale: {
                        userCreatorId: { in: allowedSellerIds }
                    }
                })
            },
            include: {
                creator: {
                    select: { id: true, name: true }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async registerBulkSales(salesData: CreateSaleDto[], userId: number) {
        return await this.prisma.$transaction(async (tx) => {
            const createdSales = [];

            for (const dto of salesData) {

                const safeCardHolder = dto.cardHolder ? encrypt(dto.cardHolder) : null;
                const safeCardNumber = dto.cardNumber ? encrypt(dto.cardNumber) : null;
                const safeCardExp = dto.cardExp ? encrypt(dto.cardExp) : null;
                const safeCardCvc = dto.cardCvc ? encrypt(dto.cardCvc) : null;

                const sale = await tx.registerSales.create({
                    data: {
                        userCreatorId: userId,
                        contactId: dto.contactId || null,
                        purchaseDate: dto.purchaseDate,
                        clientName: dto.clientName,
                        clientLastName: dto.clientLastName,
                        phone: dto.phone,
                        address: dto.address || '',
                        city: dto.city || '',
                        state: dto.state || '',
                        zipCode: dto.zipCode || '',
                        grossAmount: dto.grossAmount,
                        tax: dto.tax || 0,
                        netAmount: dto.netAmount,
                        paymentMethod: dto.paymentMethod,
                        paymentInstallments: dto.paymentInstallments || 0,
                        comments: dto.comments || 'Carga Masiva',
                        receiptUrl: null,

                        cardHolder: safeCardHolder,
                        cardNumber: safeCardNumber,
                        cardExp: safeCardExp,
                        cardCvc: safeCardCvc,

                        products: {
                            create: dto.products.map((p: any) => ({
                                productName: p.productName,
                                quantity: p.quantity,
                                price: p.price || 0
                            }))
                        }
                    }
                });

                for (const p of dto.products) {
                    const product = await tx.products.findUnique({
                        where: { sku: p.productName }
                    });

                    if (!product) {
                        throw new Error(`El producto con SKU '${p.productName}' no existe en la base de datos.`);
                    }

                    await tx.products.update({
                        where: { sku: p.productName },
                        data: {
                            stock: {
                                decrement: p.quantity
                            }
                        }
                    });
                }

                createdSales.push(sale);
            }

            return {
                success: true,
                message: `Se procesaron y guardaron ${createdSales.length} ventas correctamente.`,
                count: createdSales.length
            };
        });
    }

}