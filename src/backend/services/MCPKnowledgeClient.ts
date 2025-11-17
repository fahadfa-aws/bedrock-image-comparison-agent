/**
 * MCP Knowledge Client
 * 
 * Connects to the aws-knowledge-mcp-server to retrieve AWS Bedrock model documentation
 * This replaces the direct AWS Knowledge Base integration
 */

import { spawn, ChildProcess } from 'child_process';
import { logger } from '../logger.js';

export interface MCPModelDocumentation {
  modelId: string;
  modelName: string;
  provider: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    required: boolean;
    default?: any;
  }[];
  bestPractices: string[];
  examples: {
    prompt: string;
    parameters: Record<string, any>;
  }[];
}

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export class MCPKnowledgeClient {
  private mcpProcess: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  private responseBuffer = '';
  private isInitialized = false;

  constructor() {
    logger.info('MCPKnowledgeClient initialized');
  }

  /**
   * Initialize connection to MCP server
   */
  private async initializeMCPServer(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Spawn the MCP server process using npx (no global install needed)
        this.mcpProcess = spawn('npx', ['aws-knowledge-mcp-server-mcp'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });

        if (!this.mcpProcess.stdout || !this.mcpProcess.stdin) {
          throw new Error('Failed to create MCP process streams');
        }

        // Handle stdout data
        this.mcpProcess.stdout.on('data', (data: Buffer) => {
          this.handleMCPResponse(data.toString());
        });

        // Handle stderr
        this.mcpProcess.stderr?.on('data', (data: Buffer) => {
          logger.debug('MCP server stderr', { message: data.toString() });
        });

        // Handle process errors
        this.mcpProcess.on('error', (error) => {
          logger.error('MCP server process error', { error: error.message });
          reject(error);
        });

        // Handle process exit
        this.mcpProcess.on('exit', (code) => {
          logger.warn('MCP server process exited', { code });
          this.isInitialized = false;
          this.mcpProcess = null;
        });

        // Send initialize request
        this.sendMCPRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'bedrock-image-comparison-agent',
            version: '1.0.0'
          }
        }).then(() => {
          this.isInitialized = true;
          logger.info('MCP server initialized successfully');
          resolve();
        }).catch(reject);

      } catch (error) {
        logger.error('Failed to initialize MCP server', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        reject(error);
      }
    });
  }

  /**
   * Handle responses from MCP server
   */
  private handleMCPResponse(data: string): void {
    this.responseBuffer += data;

    // Try to parse complete JSON-RPC messages
    const lines = this.responseBuffer.split('\n');
    this.responseBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response: MCPResponse = JSON.parse(line);
        
        if (response.id !== undefined) {
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            
            if (response.error) {
              pending.reject(new Error(response.error.message));
            } else {
              pending.resolve(response.result);
            }
          }
        }
      } catch (error) {
        logger.debug('Failed to parse MCP response', { line });
      }
    }
  }

  /**
   * Send a request to the MCP server
   */
  private async sendMCPRequest(method: string, params?: any): Promise<any> {
    if (!this.isInitialized && method !== 'initialize') {
      await this.initializeMCPServer();
    }

    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });

      const requestStr = JSON.stringify(request) + '\n';
      
      if (this.mcpProcess?.stdin) {
        this.mcpProcess.stdin.write(requestStr);
      } else {
        reject(new Error('MCP process not available'));
      }

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('MCP request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Get Bedrock model documentation from MCP server
   */
  async getBedrockModelInfo(modelId: string): Promise<MCPModelDocumentation | null> {
    try {
      logger.debug('Querying MCP server for model info', { modelId });

      // Call the MCP server tool to search for model documentation
      const result = await this.sendMCPRequest('tools/call', {
        name: 'search_aws_docs',
        arguments: {
          query: `AWS Bedrock ${modelId} image generation model documentation parameters`
        }
      });

      if (!result || !result.content) {
        logger.warn('No documentation found for model', { modelId });
        return null;
      }

      // Parse the documentation from the result
      const documentation = this.parseModelDocumentation(modelId, result.content);
      
      logger.info('Retrieved model documentation from MCP', {
        modelId,
        hasParameters: documentation?.parameters?.length ? documentation.parameters.length > 0 : false
      });

      return documentation;

    } catch (error) {
      logger.error('Failed to get model info from MCP', {
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Parse model documentation from MCP response
   */
  private parseModelDocumentation(modelId: string, content: any): MCPModelDocumentation | null {
    try {
      // Extract text content
      const text = Array.isArray(content) 
        ? content.map(c => c.text || '').join('\n')
        : content.text || '';

      // Determine model name and provider from modelId
      let modelName = modelId;
      let provider = 'AWS';
      
      if (modelId.includes('amazon.nova-canvas')) {
        modelName = 'Amazon Nova Canvas';
        provider = 'Amazon';
      } else if (modelId.includes('stability.stable-diffusion-xl')) {
        modelName = 'Stable Diffusion XL';
        provider = 'Stability AI';
      } else if (modelId.includes('stability.stable-image-core')) {
        modelName = 'Stable Image Core';
        provider = 'Stability AI';
      } else if (modelId.includes('stability.stable-image-ultra')) {
        modelName = 'Stable Image Ultra';
        provider = 'Stability AI';
      }

      // Extract parameters from documentation
      const parameters = this.extractParameters(text, modelId);
      const bestPractices = this.extractBestPractices(text);
      const examples = this.extractExamples(text);

      return {
        modelId,
        modelName,
        provider,
        description: text.substring(0, 500),
        parameters,
        bestPractices,
        examples
      };

    } catch (error) {
      logger.error('Failed to parse model documentation', {
        modelId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Extract parameters from documentation text
   */
  private extractParameters(text: string, modelId: string): MCPModelDocumentation['parameters'] {
    const params: MCPModelDocumentation['parameters'] = [];

    // Common parameters for all models
    params.push({
      name: 'width',
      type: 'number',
      description: 'Image width in pixels',
      required: false,
      default: 1024
    });

    params.push({
      name: 'height',
      type: 'number',
      description: 'Image height in pixels',
      required: false,
      default: 1024
    });

    // Model-specific parameters
    if (modelId.includes('amazon.nova-canvas')) {
      params.push({
        name: 'quality',
        type: 'string',
        description: 'Image quality: standard or premium',
        required: false,
        default: 'standard'
      });
    } else if (modelId.includes('stability')) {
      params.push({
        name: 'cfg_scale',
        type: 'number',
        description: 'How strictly to follow the prompt (1-35)',
        required: false,
        default: 7
      });

      params.push({
        name: 'steps',
        type: 'number',
        description: 'Number of diffusion steps (10-50)',
        required: false,
        default: 30
      });
    }

    return params;
  }

  /**
   * Extract best practices from documentation
   */
  private extractBestPractices(text: string): string[] {
    const practices: string[] = [];

    // Look for common best practice patterns
    if (text.toLowerCase().includes('detailed') || text.toLowerCase().includes('descriptive')) {
      practices.push('Use detailed, descriptive prompts');
    }

    if (text.toLowerCase().includes('specific')) {
      practices.push('Be specific about desired elements');
    }

    practices.push('Include style and mood descriptors');
    practices.push('Specify lighting and composition');
    practices.push('Use clear, unambiguous language');

    return practices;
  }

  /**
   * Extract examples from documentation
   */
  private extractExamples(text: string): MCPModelDocumentation['examples'] {
    // Return default examples
    return [
      {
        prompt: 'A photorealistic portrait of a person in natural lighting',
        parameters: { width: 1024, height: 1024 }
      }
    ];
  }

  /**
   * Cleanup MCP server connection
   */
  async cleanup(): Promise<void> {
    if (this.mcpProcess) {
      this.mcpProcess.kill();
      this.mcpProcess = null;
      this.isInitialized = false;
      logger.info('MCP server connection closed');
    }
  }
}
