import express, { Express, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createServer, Server as HTTPServer } from 'http';
import cors from 'cors';
import * as path from 'path';
import { CoHost } from './cohost';

/**
 * Web Server for CoHost Dashboard
 * Provides real-time monitoring and control via web interface
 */
export class WebServer {
  private app: Express;
  private httpServer: HTTPServer;
  private io: SocketIOServer;
  private cohost: CoHost;
  private port: number;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(cohost: CoHost, port: number = 3000) {
    this.cohost = cohost;
    this.port = port;

    // Initialize Express
    this.app = express();
    this.httpServer = createServer(this.app);

    // Initialize Socket.IO
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, '../public')));
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Serve dashboard
    this.app.get('/', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    // API: Get service status
    this.app.get('/api/status', (req: Request, res: Response) => {
      res.json(this.cohost.getServiceStatus());
    });

    // API: Get memory stats
    this.app.get('/api/memory/stats', async (req: Request, res: Response) => {
      try {
        const stats = await this.cohost.getMemoryStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get memory stats' });
      }
    });

    // API: Search memory
    this.app.post('/api/memory/search', async (req: Request, res: Response) => {
      try {
        const { query, limit } = req.body;
        const results = await this.cohost.searchMemory(query, limit || 5);
        res.json(results);
      } catch (error) {
        res.status(500).json({ error: 'Failed to search memory' });
      }
    });

    // API: Start audio capture
    this.app.post('/api/audio/start', async (req: Request, res: Response) => {
      try {
        await this.cohost.startAudioCapture();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to start audio capture' });
      }
    });

    // API: Stop audio capture
    this.app.post('/api/audio/stop', async (req: Request, res: Response) => {
      try {
        await this.cohost.stopAudioCapture();
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to stop audio capture' });
      }
    });

    // API: Send message (for testing)
    this.app.post('/api/message', async (req: Request, res: Response) => {
      try {
        const { message } = req.body;
        await this.cohost.processInput(message, 'chat', 'Dashboard');
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: 'Failed to process message' });
      }
    });
  }

  /**
   * Setup Socket.IO events
   */
  private setupSocketIO(): void {
    this.io.on('connection', (socket) => {
      console.log('[WebServer] Client connected:', socket.id);

      // Send initial status
      socket.emit('status', this.cohost.getServiceStatus());

      // Handle client requests
      socket.on('startAudio', async () => {
        try {
          await this.cohost.startAudioCapture();
          socket.emit('audioStarted');
        } catch (error) {
          socket.emit('error', { message: 'Failed to start audio' });
        }
      });

      socket.on('stopAudio', async () => {
        try {
          await this.cohost.stopAudioCapture();
          socket.emit('audioStopped');
        } catch (error) {
          socket.emit('error', { message: 'Failed to stop audio' });
        }
      });

      socket.on('sendMessage', async (data: { message: string }) => {
        try {
          await this.cohost.processInput(data.message, 'chat', 'Dashboard');
        } catch (error) {
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      socket.on('disconnect', () => {
        console.log('[WebServer] Client disconnected:', socket.id);
      });
    });

    // Setup event forwarding from CoHost to clients
    this.setupEventForwarding();
  }

  /**
   * Forward CoHost events to connected clients
   */
  private setupEventForwarding(): void {
    const services = this.cohost.getServices();

    // Audio capture events
    services.audioCapture.on('started', () => {
      this.io.emit('audioStarted');
      this.broadcastStatus();
    });

    services.audioCapture.on('stopped', () => {
      this.io.emit('audioStopped');
      this.broadcastStatus();
    });

    services.audioCapture.on('speechStart', () => {
      this.io.emit('speechStart');
      this.broadcastStatus();
    });

    services.audioCapture.on('speechEnd', (data: any) => {
      this.io.emit('speechEnd', { duration: data.duration });
      this.broadcastStatus();
    });

    // Twitch chat events
    services.twitch.on('message', (data: any) => {
      this.io.emit('chatMessage', {
        username: data.username,
        message: data.message,
        timestamp: data.timestamp,
      });
    });

    services.twitch.on('subscription', (data: any) => {
      this.io.emit('twitchEvent', {
        type: 'subscription',
        data,
      });
    });

    services.twitch.on('cheer', (data: any) => {
      this.io.emit('twitchEvent', {
        type: 'cheer',
        data,
      });
    });

    services.twitch.on('raid', (data: any) => {
      this.io.emit('twitchEvent', {
        type: 'raid',
        data,
      });
    });
  }

  /**
   * Broadcast current status to all clients
   */
  private broadcastStatus(): void {
    this.io.emit('status', this.cohost.getServiceStatus());
  }

  /**
   * Start the web server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(this.port, () => {
        console.log(`\n🌐 Dashboard available at http://localhost:${this.port}\n`);

        // Start periodic status updates
        this.updateInterval = setInterval(() => {
          this.broadcastStatus();
        }, 1000);

        resolve();
      });
    });
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    return new Promise((resolve) => {
      this.httpServer.close(() => {
        console.log('[WebServer] Stopped');
        resolve();
      });
    });
  }
}
