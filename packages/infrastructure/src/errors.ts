export class InfrastructureError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InfrastructureError';
  }
}
