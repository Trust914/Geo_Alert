export interface ISubscribeOptions {
  queueName?: string;
  durable?: boolean;
  prefetch?: number;
}

export interface IRPCRequest {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  timeoutId: NodeJS.Timeout;
}