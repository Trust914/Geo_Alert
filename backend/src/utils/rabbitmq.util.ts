import * as amqp from "amqplib";
import { AppError } from "./error.util.js";
import statusCodes from "http-status";
import { logger } from "./logger.util.js";
import crypto from "crypto";

import type { IAppErrorParams } from "../types/common.types.js";
import type { IRPCRequest, ISubscribeOptions } from "../types/rabbitmq.types.js";
import { rabbitmqConfig } from "../config/rabbitmq.config.js";

// Global connection management
let globalConnection: amqp.ChannelModel | null = null;
let globalChannel: amqp.Channel | null = null;
let connectionPromise: Promise<{
  connection: amqp.ChannelModel;
  channel: amqp.Channel;
}> | null = null;
let globalResponseQueue: string | null = null;

// Track active RPC requests with a simple object
const activeRPCRequests: Record<string, IRPCRequest> = {};

/**
 * Connect to RabbitMQ with connection reuse and proper error handling
 */
export const connectToRabbitMQ = async (maxAttempts = 5, delay = 2000): Promise<{ connection: amqp.ChannelModel; channel: amqp.Channel }> => {
  // Return existing connection if available
  if (globalConnection && globalChannel) {
    logger.debug(`Using existing RabbitMQ connection`);
    return { connection: globalConnection, channel: globalChannel };
  }

  // Return existing connection promise if in progress
  if (connectionPromise) {
    return connectionPromise;
  }

  // Create a new connection promise
  connectionPromise = connectWithRetries(maxAttempts, delay);

  try {
    const result = await connectionPromise;
    if (!result) {
      const errParams: IAppErrorParams = {
        name: "RabbitMQConnectionError",
        message: "Unable to connect to RabbitMQ",
        handler: "ConnectToRabbitMQUtil",
        isOperational: true,
        statusCode: statusCodes.INTERNAL_SERVER_ERROR,
      };
      throw new AppError(errParams);
    }
    return result;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
};

const connectWithRetries = async (maxAttempts: number, delay: number): Promise<{ connection: amqp.ChannelModel; channel: amqp.Channel }> => {
  let attempt = 1;
  while (attempt <= maxAttempts) {
    try {
      logger.info(`Attempt ${attempt}/${maxAttempts}: Connecting to RabbitMQ...`);
      // Connect to RabbitMQ
      const connection: amqp.ChannelModel = await amqp.connect(rabbitmqConfig.connection);
      // Handle connection events
      connection.on("error", (err) => {
        logger.error("RabbitMQ connection error", { error: err });
        resetGlobalConnection();
      });
      connection.on("close", () => {
        logger.info("RabbitMQ connection closed");
        resetGlobalConnection();
      });
      // Create channel with prefetch
      const channel: amqp.Channel = await connection.createChannel();
      await channel.prefetch(10);
      logger.info(`Successfully connected to RabbitMQ`);
      // Store connection globally
      globalConnection = connection;
      globalChannel = channel;
      return { connection, channel };
    } catch (error) {
      const errObj = error instanceof Error ? error : new Error(String(error));
      logger.error(`RabbitMQ connection attempt ${attempt} failed: ${errObj.message}`, { error: errObj });
      // Last attempt, throw error
      if (attempt === maxAttempts) {
        const errParams: IAppErrorParams = {
          name: `RabbitMQConnectionFailed`,
          message: `Failed to connect to RabbitMQ after ${maxAttempts} attempts`,
          statusCode: statusCodes.INTERNAL_SERVER_ERROR,
          handler: "RabbitMQUtil",
          isOperational: true,
          details: {
            attempts: maxAttempts,
          },
        };
        throw new AppError(errParams);
      }
      // Wait before retrying
      logger.warn(`Retrying RabbitMQ connection in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempt++;
    }
  }
  throw new Error(`Failed to connect to RabbitMQ after ${maxAttempts} attempts`);
};

/**
 * Reset global connection variables and handle in-flight requests
 */
const resetGlobalConnection = (): void => {
  globalConnection = null;
  globalChannel = null;
  connectionPromise = null;
  globalResponseQueue = null;

  for (const correlationId in activeRPCRequests) {
    const request = activeRPCRequests[correlationId];

    if (request) {
      // Clear timeout safely
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }

      // Reject the promise
      request.reject(
        new AppError({
          name: `ConnectionClosed`,
          message: `RabbitMQ connection closed while waiting for response`,
          statusCode: statusCodes.INTERNAL_SERVER_ERROR,
          handler: "RabbitMQUtil",
          isOperational: true,
        }),
      );

      delete activeRPCRequests[correlationId];
    }
  }
};
/**
 * Initialize RabbitMQ service - sets up global connection and response queue
 */
export const initializeRabbitMQ = async (): Promise<{
  channel: amqp.Channel;
  responseQueue: string;
}> => {
  try {
    const { channel } = await connectToRabbitMQ();
    // logger.debug("RabbitMQ connection established",{channel});

    // Create response queue if not already set up
    if (!globalResponseQueue) {
      const responseQueue: amqp.Replies.AssertQueue = await channel.assertQueue("", {
        exclusive: true,
        autoDelete: true,
      });

      // Set up consumer for RPC responses
      await channel.consume(responseQueue.queue, (msg) => {
        if (!msg) return;

        const correlationId = msg.properties.correlationId;
        const request = activeRPCRequests[correlationId];

        if (request) {
          try {
            const content = JSON.parse(msg.content.toString());
            request.resolve(content);

            // Clean up
            if (request.timeoutId) {
              clearTimeout(request.timeoutId);
            }
            delete activeRPCRequests[correlationId];
          } catch (error) {
            const errObj = error as Error;
            request.reject(
              new AppError({
                name: `InitialiseRabbitMQError`,
                message: `Error processing RPC response: ${errObj.message}`,
                statusCode: statusCodes.INTERNAL_SERVER_ERROR,
                handler: "RabbitMQUtil",
                isOperational: true,
              }),
            );
          }
        }

        channel.ack(msg);
      });

      globalResponseQueue = responseQueue.queue;
      logger.info(`RabbitMQ response queue initialized: ${globalResponseQueue}`);
    }

    return { channel, responseQueue: globalResponseQueue };
  } catch (error) {
    const errObj = error as Error;
    logger.error(`Failed to initialize RabbitMQ: ${errObj.message}`);
    throw new AppError({
      name: `InitialiseRabbitMQError`,
      message: `Error initialising the RabbitMQ message queue: ${errObj.message}`,
      statusCode: statusCodes.INTERNAL_SERVER_ERROR,
      handler: "RabbitMQUtil",
      isOperational: true,
      details: errObj,
    });
  }
};

/**
 * Publish a fire-and-forget event (no response expected)
 */
export const publishEvent = async (exchangeName: string, routingKey: string, message: Record<string, any>): Promise<boolean> => {
  try {
    const { channel } = await connectToRabbitMQ();

    // Ensure exchange exists
    await channel.assertExchange(exchangeName, "topic", { durable: true });

    // Publish message
    channel.publish(exchangeName, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });

    logger.debug(`Published the event ${routingKey} to the exchange ${exchangeName}.`);
    return true;
  } catch (error) {
    const errObj = error as Error;
    throw new AppError({
      name: `PublishEventError`,
      message: `Failed to publish event to ${exchangeName}.${routingKey}: ${errObj.message}`,
      statusCode: statusCodes.INTERNAL_SERVER_ERROR,
      handler: "RabbitMQUtil",
      isOperational: true,
    });
  }
};

/**
 * Send an RPC request and wait for response
 */
export const sendRPCRequest = async (exchangeName: string, routingKey: string, message: Record<string, any> | string, timeout: number = 30000): Promise<any> => {
  try {
    // Ensure connection and response queue are set up
    if (!globalResponseQueue) {
      await initializeRabbitMQ();
    }

    const { channel } = await connectToRabbitMQ();

    // Ensure exchange exists
    await channel.assertExchange(exchangeName, "topic", { durable: true });

    // Create unique correlation ID
    const correlationId = crypto.randomBytes(16).toString("hex");

    // Create promise for response handling
    const responsePromise = new Promise((resolve, reject) => {
      // Set timeout for request
      const timeoutId = setTimeout(() => {
        delete activeRPCRequests[correlationId];
        reject(
          new AppError({
            name: `RPCTimeout`,
            message: `RPC request to ${exchangeName}.${routingKey} timed out after ${timeout}ms`,
            statusCode: statusCodes.INTERNAL_SERVER_ERROR,
            handler: "RabbitMQUtil",
            isOperational: true,
          }),
        );
      }, timeout);

      // Store handlers
      activeRPCRequests[correlationId] = { resolve, reject, timeoutId };
    });

    const messageBuffer = Buffer.from(JSON.stringify(message));
    const replyQueueName = globalResponseQueue || undefined;
    // Send the request
    channel.publish(exchangeName, routingKey, messageBuffer, {
      correlationId,
      replyTo: replyQueueName,
      persistent: true,
    });

    // Wait for response
    return await responsePromise;
  } catch (error) {
    const errObj = error as Error;
    throw new AppError({
      name: `RPCRequestError`,
      message: `RPC request to ${exchangeName}.${routingKey} failed: ${errObj.message}`,
      statusCode: statusCodes.INTERNAL_SERVER_ERROR,
      handler: "RabbitMQUtil",
      isOperational: true,
    });
  }
};

/**
 * Subscribe to events with a callback for handling
 */
export const subscribeToEvent = async (exchangeName: string, routingKey: string, callbackFn: (content: any) => Promise<void | any>, options: ISubscribeOptions = {}): Promise<string> => {
  const { queueName = "", durable = true, prefetch = 10 } = options;

  try {
    const { channel } = await connectToRabbitMQ();

    // Set prefetch for this consumer
    await channel.prefetch(prefetch);

    // Ensure exchange exists
    await channel.assertExchange(exchangeName, "topic", { durable: true });

    // Create or use existing queue
    const actualQueueName = queueName || `subscriber-${exchangeName}-${routingKey}`;
    const queue = await channel.assertQueue(actualQueueName, {
      durable,
      ...(queueName ? {} : { exclusive: true, autoDelete: true }),
    });

    // Bind queue to exchange
    await channel.bindQueue(queue.queue, exchangeName, routingKey);

    logger.info(`Subscribed to ${exchangeName}.${routingKey} on queue ${queue.queue}`);

    // Set up consumer
    await channel.consume(
      queue.queue,
      async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());

          // Handle RPC requests (if replyTo is present)
          if (msg.properties.replyTo && msg.properties.correlationId) {
            const response = await callbackFn(content);

            channel.sendToQueue(msg.properties.replyTo, Buffer.from(JSON.stringify(response)), { correlationId: msg.properties.correlationId });
          } else {
            // Normal message processing
            await callbackFn(content);
          }

          channel.ack(msg);
        } catch (error) {
          const errObj = error as Error;
          logger.error(`Error processing message: ${errObj.message}`);
          // Don't requeue failed messages
          channel.nack(msg, false, false);
        }
      },
      { noAck: false },
    );

    return queue.queue;
  } catch (error) {
    const errObj = error as Error;
    throw new AppError({
      name: `SubscribeEventError`,
      message: `Failed to subscribe to ${exchangeName}.${routingKey}: ${errObj.message}`,
      statusCode: statusCodes.INTERNAL_SERVER_ERROR,
      handler: "RabbitMQUtil",
      isOperational: true,
    });
  }
};

/**
 * Gracefully shut down RabbitMQ connections
 */
export const closeRabbitMQConnection = async (): Promise<void> => {
  // Close channel first
  if (globalChannel) {
    try {
      await globalChannel.close();
      logger.info("RabbitMQ channel closed successfully");
    } catch (error) {
      const errObj = error as Error;
      logger.error(`Error closing RabbitMQ channel: ${errObj.message}`);
    }
  }

  // Then close connection
  if (globalConnection) {
    try {
      await globalConnection.close();
      logger.info("RabbitMQ connection closed successfully");
    } catch (error) {
      const errObj = error as Error;
      logger.error(`Error closing RabbitMQ connection: ${errObj.message}`);
    }
  }

  // Reset global variables
  resetGlobalConnection();
};

export const isRabbitMQConnected = (): boolean => {
  return globalConnection !== null;
};
