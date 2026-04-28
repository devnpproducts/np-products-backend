import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:5173',
      'https://np-products-frontend-xi.vercel.app'
    ],
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    // Extraemos los datos enviados desde el frontend en la conexión
    const { role, userId } = client.handshake.query;

    console.log(`🚀 Cliente conectado: ${client.id} | Usuario: ${userId} | Rol: ${role}`);

    // 1. Si es ADMIN o SUPERVISOR, lo metemos a la sala de gerencia
    if (role === 'ADMIN' || role === 'SUPERVISOR') {
      client.join('room_management');
      console.log(`🏠 Cliente ${client.id} unido a room_management`);
    }

    // 2. Todos los usuarios (incluidos vendedores) se unen a su propia sala privada
    if (userId) {
      client.join(`room_user_${userId}`);
      console.log(`🔒 Cliente ${client.id} unido a su sala privada: room_user_${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Cliente desconectado: ${client.id}`);
  }

  /**
   * Envía una notificación solo a Admins y Supervisores
   */
  notifyManagement(type: string, payload: any) {
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    this.server.to('room_management').emit('notification', {
      type,
      message: cleanPayload,
      date: new Date()
    });
  }

  emitProspectUpdate(sellerId: number | null, payload: any) {
    const cleanPayload = JSON.parse(JSON.stringify(payload));

    this.server.to('room_management').emit('update_prospects', cleanPayload);

    if (sellerId) {
      this.server.to(`room_user_${sellerId}`).emit('update_prospects', cleanPayload);
    }

    console.log(`📡 Evento 'update_prospects' enviado a salas correspondientes`);
  }

  notifyUser(userId: number, type: string, payload: any) {
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    this.server.to(`room_user_${userId}`).emit('notification', {
      type,
      message: cleanPayload,
      date: new Date()
    });
  }

  prospectUpdateNotification(userId: number | null, payload: any) {
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    this.server.to('room_management').emit('prospect_updated', cleanPayload);

    if (userId) {
      this.server.to(`room_user_${userId}`).emit('prospect_updated', cleanPayload);
    }
  }

  enviarNotificacion(payload: any) {
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    console.log("📤 Emitiendo notificación a Gerencia...");
    this.server.to('room_management').emit('notification', cleanPayload);
  }
}