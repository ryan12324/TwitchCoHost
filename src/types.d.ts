declare module 'node-record-lpcm16' {
  import { Readable } from 'stream';

  export interface RecordOptions {
    sampleRate?: number;
    channels?: number;
    audioType?: string;
    recorder?: string;
    silence?: string;
  }

  export interface Recording {
    stream(): Readable;
    stop(): void;
    pause(): void;
    resume(): void;
  }

  export function record(options?: RecordOptions): Recording;
  export function stop(): void;
}

declare module 'tmi.js' {
  export class Client {
    constructor(options: any);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    say(channel: string, message: string): Promise<void>;
    on(event: string, handler: Function): void;
  }
}
