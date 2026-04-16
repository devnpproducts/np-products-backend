import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { EventsGateway } from '../common/gateways';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService,
    private eventsGateway: EventsGateway
  ) { }

  async getProducts() {
    return this.prisma.products.findMany({
      include: { creator: { select: { name: true, user: true } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createProduct(data: CreateProductDto, creatorId: number) {
    return this.prisma.products.create({
      data: {
        ...data,
        userCreatorId: creatorId,
      },
    });
  }

  async updateProduct(id: number, data: UpdateProductDto, actorId: number) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.products.findUnique({ where: { id } });
      if (!product) throw new NotFoundException('Producto no encontrado');

      const updatedProduct = await tx.products.update({
        where: { id },
        data,
      });

      await tx.registerChanceProducts.create({
        data: {
          productId: id,
          userCreatorId: actorId,
          change: `Update: ${Object.keys(data).join(', ')} | Valores: ${JSON.stringify(data)}`,
        },
      });

      return updatedProduct;
    });
  }

  async updateStock(id: number, quantity: number, userId: number) {
    const product = await this.prisma.products.update({
      where: { id },
      data: { stock: quantity }
    });

    if (product.stock < 5) {
      const title = "Alerta de Inventario";
      const content = `Producto ${product.sku} tiene stock bajo: ${product.stock} unidades.`;

      await this.prisma.notifications.create({
        data: { title, content, type: 'STOCK', userId, metadata: { sku: product.sku, stock: product.stock } }
      });

      this.eventsGateway.server.emit('notification', {
        type: 'STOCK_ALERT',
        data: {
          sku: product.sku,
          stock: product.stock,
          date: new Date(),
          metadata: { sku: product.sku, stock: product.stock }
        }
      });

      this.eventsGateway.server.emit('activity', {
        user: "Sistema",
        change: `Actualizó stock de ${product.sku}`,
        date: new Date()
      });

    }

    return product;
  }

  async toggleStatus(id: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.products.findUnique({ where: { id } });
      if (!product) throw new NotFoundException('Producto no encontrado');

      const updatedProduct = await tx.products.update({
        where: { id },
        data: { status: !product.status },
      });

      await tx.registerChanceProducts.create({
        data: {
          productId: id,
          userCreatorId: userId,
          change: `Status: ${product.status ? 'Activo' : 'Inactivo'} -> ${updatedProduct.status ? 'Activo' : 'Inactivo'}`,
        },
      });

      this.eventsGateway.server.emit('activity', {
        user: "Sistema",
        change: `Cambió estado de ${product.sku} a ${updatedProduct.status ? 'Activo' : 'Inactivo'}`,
        date: new Date()
      });

      this.eventsGateway.server.emit('notification', {
        type: 'PRODUCTS_ALERT',
        data: {
          sku: product.sku,
          date: new Date()
        }
      });

      const title = "Alerta de Inventario";
      const content = `Cambió estado de ${product.sku} a ${updatedProduct.status ? 'Activo' : 'Inactivo'}`;

      await tx.notifications.create({
        data: {
          title,
          content,
          type: 'PRODUCTS_ALERT',
          userId,
          metadata: { sku: product.sku }
        }
      });
      return updatedProduct;
    });
  }
}