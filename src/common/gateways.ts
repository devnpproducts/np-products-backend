import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  path: '/socket.io', // Fuerza a que ignore el prefijo 'api' para el socket
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }

  // Método para emitir alertas desde cualquier Service
  emitAlert(type: string, message: any) {
    this.server.emit('notification', { type, message, date: new Date() });
  }

enviarNotificacion(payload: any) {
  // 1. Limpiamos el objeto para asegurar que sea JSON puro
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  
  console.log("📤 Emitiendo a todos los sockets...");
  // 2. Usamos la emisión global a todos los sockets conectados
  this.server.sockets.emit('notification', cleanPayload);
}
}