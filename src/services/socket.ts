import { Socket } from 'socket.io-client';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';

export const socket: typeof Socket = io(SOCKET_URL);

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('connect_error', (error: Error) => {
  console.error('Socket connection error:', error);
}); 